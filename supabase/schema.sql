-- ============================================================================
-- BirdieGives — Supabase schema
-- Run this once in a brand-new Supabase project (SQL Editor → New query → Run)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- CHARITIES
-- ----------------------------------------------------------------------------
create table public.charities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  category    text not null default '',
  icon        text not null default '💚',
  events      jsonb not null default '[]',
  raised      numeric not null default 0,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PLATFORM SETTINGS (singleton row — keeps pricing/splits admin-configurable
-- rather than hard-coded, per the PRD's scalability requirement)
-- ----------------------------------------------------------------------------
create table public.platform_settings (
  id               int primary key default 1,
  monthly_price    numeric not null default 12.99,
  yearly_price     numeric not null default 9.99,   -- effective £/month
  pool_share       numeric not null default 0.55,   -- % of revenue → prize pool
  tier5_share      numeric not null default 0.40,
  tier4_share      numeric not null default 0.35,
  tier3_share      numeric not null default 0.25,
  min_charity_pct  numeric not null default 10,
  jackpot_balance  numeric not null default 0,       -- rolled-over 5-match pool
  constraint single_row check (id = 1)
);
insert into public.platform_settings (id) values (1);

-- ----------------------------------------------------------------------------
-- PROFILES (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  name                    text not null,
  email                   text not null,
  role                    text not null default 'user' check (role in ('user','admin')),
  plan                    text check (plan in ('monthly','yearly')),
  subscription_status     text not null default 'inactive' check (subscription_status in ('inactive','active','lapsed','cancelled')),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  charity_id              uuid references public.charities(id),
  charity_pct             numeric not null default 10 check (charity_pct between 10 and 100),
  notif_draws             boolean not null default true,
  notif_winners           boolean not null default true,
  notif_renewal           boolean not null default true,
  notif_charity           boolean not null default false,
  created_at              timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent a non-admin from promoting themselves / forging subscription state
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role                   := old.role;
    new.subscription_status    := old.subscription_status;
    new.stripe_customer_id     := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.current_period_end     := old.current_period_end;
  end if;
  return new;
end;
$$;

create trigger trg_protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ----------------------------------------------------------------------------
-- SCORES — Stableford 1–45, one per date, rolling window of 5
-- ----------------------------------------------------------------------------
create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  score      int not null check (score between 1 and 45),
  played_on  date not null,
  created_at timestamptz not null default now(),
  unique (user_id, played_on)   -- "only one score entry per date"
);

-- "A new score replaces the oldest stored score automatically" (max 5 kept)
create or replace function public.enforce_score_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.scores
  where user_id = new.user_id
    and id not in (
      select id from public.scores
      where user_id = new.user_id
      order by played_on desc, created_at desc
      limit 5
    );
  return new;
end;
$$;

create trigger trg_enforce_score_limit
  after insert on public.scores
  for each row execute function public.enforce_score_limit();

-- ----------------------------------------------------------------------------
-- DRAWS — one row per month
-- ----------------------------------------------------------------------------
create table public.draws (
  id             uuid primary key default gen_random_uuid(),
  month          text not null unique,         -- e.g. '2026-06'
  numbers        int[] not null,
  logic          text not null check (logic in ('random','algorithmic')),
  pool_total     numeric not null default 0,
  pool_5         numeric not null default 0,
  pool_4         numeric not null default 0,
  pool_3         numeric not null default 0,
  jackpot_in     numeric not null default 0,   -- jackpot carried INTO this draw
  jackpot_rolled boolean not null default false,
  published      boolean not null default false,
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- WINNERS
-- ----------------------------------------------------------------------------
create table public.winners (
  id               uuid primary key default gen_random_uuid(),
  draw_id          uuid not null references public.draws(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  tier             text not null check (tier in ('5-match','4-match','3-match')),
  matched_numbers  int[] not null default '{}',
  amount           numeric not null default 0,
  proof_url        text,
  status           text not null default 'pending' check (status in ('pending','paid','rejected')),
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);

create or replace function public.protect_winner_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    -- a player may only attach proof while still pending; nothing else
    if old.status <> 'pending' then
      raise exception 'This claim has already been reviewed.';
    end if;
    new.tier         := old.tier;
    new.amount        := old.amount;
    new.status        := old.status;
    new.draw_id       := old.draw_id;
    new.user_id        := old.user_id;
    new.matched_numbers := old.matched_numbers;
    new.submitted_at  := now();
  end if;
  return new;
end;
$$;

create trigger trg_protect_winner_fields
  before update on public.winners
  for each row execute function public.protect_winner_fields();

-- ----------------------------------------------------------------------------
-- DONATIONS — independent, gameplay-unrelated giving
-- ----------------------------------------------------------------------------
create table public.donations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  charity_id uuid not null references public.charities(id),
  amount     numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles          enable row level security;
alter table public.charities         enable row level security;
alter table public.scores            enable row level security;
alter table public.draws             enable row level security;
alter table public.winners           enable row level security;
alter table public.donations         enable row level security;
alter table public.platform_settings enable row level security;

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- charities (public read; admin write)
create policy "charities_select_all" on public.charities for select using (true);
create policy "charities_admin_write" on public.charities for all
  using (public.is_admin()) with check (public.is_admin());

-- platform_settings (public read; admin write)
create policy "settings_select_all" on public.platform_settings for select using (true);
create policy "settings_admin_write" on public.platform_settings for update
  using (public.is_admin());

-- scores: a subscriber manages their own scores; admin manages all
create policy "scores_select_own_or_admin" on public.scores
  for select using (auth.uid() = user_id or public.is_admin());
create policy "scores_insert_own_active_or_admin" on public.scores
  for insert with check (
    public.is_admin()
    or (
      auth.uid() = user_id
      and exists (select 1 from public.profiles where id = auth.uid() and subscription_status = 'active')
    )
  );
create policy "scores_update_own_or_admin" on public.scores
  for update using (auth.uid() = user_id or public.is_admin());
create policy "scores_delete_own_or_admin" on public.scores
  for delete using (auth.uid() = user_id or public.is_admin());

-- draws: subscribers see published draws only; admin sees/runs everything
create policy "draws_select_published_or_admin" on public.draws
  for select using (published = true or public.is_admin());
create policy "draws_admin_write" on public.draws for all
  using (public.is_admin()) with check (public.is_admin());

-- winners: a user sees their own wins; admin sees/manages all
create policy "winners_select_own_or_admin" on public.winners
  for select using (auth.uid() = user_id or public.is_admin());
create policy "winners_insert_admin_only" on public.winners
  for insert with check (public.is_admin());
create policy "winners_update_own_or_admin" on public.winners
  for update using (auth.uid() = user_id or public.is_admin());

-- donations
create policy "donations_select_own_or_admin" on public.donations
  for select using (auth.uid() = user_id or public.is_admin());
create policy "donations_insert_own" on public.donations
  for insert with check (auth.uid() = user_id);

-- ============================================================================
-- STORAGE — winner proof screenshots (private bucket)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('winner-proof', 'winner-proof', false)
on conflict (id) do nothing;

create policy "proof_upload_own_folder" on storage.objects
  for insert with check (
    bucket_id = 'winner-proof'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "proof_read_own_or_admin" on storage.objects
  for select using (
    bucket_id = 'winner-proof'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
