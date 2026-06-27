# BirdieGives — Deployment Guide

## Prerequisites
- Node.js 18+ installed
- A **new** Vercel account (create at vercel.com)
- A **new** Supabase project (create at supabase.com)
- A Stripe account (test mode is fine for evaluation)
- Optionally: a Resend account for real email delivery

---

## Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New project  
2. Note down your **Project URL** and both API keys (anon + service_role) from  
   **Settings → API**
3. In the **SQL Editor**, open a new query and paste the entire contents of  
   `supabase/schema.sql`, then click **Run**
4. Open another query and paste `supabase/seed.sql`, then click **Run**  
   (seeds starter charities)
5. In **Authentication → Providers**, make sure **Email** is enabled  
6. In **Authentication → URL Configuration**, set:
   - Site URL: `https://your-app.vercel.app` (update after deploy)
   - Redirect URL: `https://your-app.vercel.app/**`

---

## Step 2 — Stripe Setup

1. Log in to [stripe.com](https://stripe.com) → Test mode
2. **Products → Add product**:
   - Name: "BirdieGives Monthly"
   - Recurring price: £9.99 / month → copy the **Price ID** (`price_…`)
3. **Add another product**:
   - Name: "BirdieGives Annual"
   - Recurring price: £99 / year → copy the **Price ID**
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://your-app.vercel.app/api/stripe-webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copy the **Signing secret** (`whsec_…`)

---

## Step 3 — Environment Variables

Create a `.env.local` file at the project root (never commit this):

```
# Browser-side (Vite only exposes VITE_ prefixed vars)
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY

# Server-side (api/ serverless functions — never VITE_ prefix)
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
PUBLIC_URL=https://your-app.vercel.app

# Optional — emails are logged to console if unset
RESEND_API_KEY=re_...
EMAIL_FROM=BirdieGives <notifications@yourdomain.com>
```

---

## Step 4 — Local Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.  
Serverless functions (`/api/*`) require `vercel dev` instead of `vite`:

```bash
npm install -g vercel
vercel dev          # runs both Vite and the /api functions
```

---

## Step 5 — Deploy to Vercel

```bash
vercel login        # or use the Vercel dashboard import
vercel              # follow the prompts — framework: Vite
```

Then in **Vercel → Project → Settings → Environment Variables**, add every
variable from your `.env.local` (all three environments: Production, Preview, Development).

Trigger a redeploy after adding env vars.

---

## Step 6 — Create Demo Accounts

After deploying, visit your live URL and:

1. **Sign up** as a regular user (e.g. `player@demo.com` / `Demo1234!`)
2. Complete the subscription flow (use Stripe test card `4242 4242 4242 4242`)
3. Enter 5 golf scores from the dashboard

To create an **admin** account:
1. Sign up normally, then run this in Supabase SQL Editor:
   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'admin@demo.com';
   ```
2. Admin panel is at `/admin`

---

## Step 7 — Test Checklist (matches PRD §16)

| Area | What to verify |
|------|---------------|
| Auth | Sign up, log in, log out, password reset |
| Subscription | Monthly & yearly checkout via Stripe, webhook updates DB |
| Scores | Enter 5 scores; 6th replaces oldest (rolling); one per date enforced |
| Dashboard | All tabs: subscription, scores, charity, draw numbers, winnings |
| Draws | Admin: run simulation → review → publish; jackpot rollover if no 5-match |
| Prize pool | Auto-calculated from active sub count; splits 40/35/25% |
| Charities | Public page with search; admin add/edit/delete |
| Winners | Entry created on publish; admin mark paid / reject; proof URL shown |
| Emails | Draw published + winner paid notifications sent (check console if no Resend key) |
| Mobile | All pages responsive at 375px+ |
| Errors | Try duplicate score date, expired card, invalid scores |

---

## Architecture Notes

```
birdiegives/
├── api/                   Vercel serverless functions (Node 18)
│   ├── _supabaseAdmin.js  service-role client (never in browser bundle)
│   ├── _email.js          Resend wrapper
│   ├── create-checkout-session.js
│   ├── create-portal-session.js
│   ├── stripe-webhook.js  keeps DB in sync with Stripe events
│   └── notify.js          admin-triggered notification endpoint
├── supabase/
│   ├── schema.sql         full DB schema with RLS + triggers
│   └── seed.sql           starter charities
└── src/
    ├── lib/
    │   ├── tokens.js       design tokens (colours, type, spacing)
    │   ├── clientUtils.js  pure formatting helpers
    │   ├── draws.js        draw engine + prize pool logic (pure functions)
    │   └── supabaseClient.js  browser Supabase client
    ├── hooks/
    │   └── useAuth.jsx     auth context (session + profile row)
    ├── components/
    │   ├── Atoms.jsx       design system primitives
    │   ├── Nav.jsx         top navigation
    │   ├── LoginModal.jsx  sign in / sign up modal
    │   └── Guards.jsx      route protection HOCs
    ├── pages/
    │   ├── Home.jsx        public landing page
    │   ├── Charities.jsx   public charity directory
    │   ├── Subscribe.jsx   plan + charity → Stripe Checkout
    │   ├── Dashboard.jsx   subscriber dashboard (scores, draw, settings)
    │   └── AdminDashboard.jsx  full admin panel
    ├── App.jsx             router + auth provider
    ├── main.jsx            React entry point
    └── global.css          global styles + animations
```

### Key data rules enforced at DB level
- **Rolling 5 scores**: trigger automatically deletes oldest when a 6th is inserted
- **One score per date**: unique constraint on `(profile_id, played_on)`
- **Score range 1–45**: check constraint in `golf_scores`
- **Prize splits**: calculated server-side from `draws.js` (same file as client preview)
- **Jackpot rollover**: admin run next month's draw; previous pool carried via `jackpot_carryover` column
- **RLS**: users can only read/write their own rows; admin bypass via service-role key in `/api`
