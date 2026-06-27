import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../lib/tokens.js";
import { Card, Pill, PageLoader } from "../components/Atoms.jsx";
import { fmt } from "../lib/clientUtils.js";
import { supabase } from "../lib/supabaseClient.js";

const HOW_IT_WORKS = [
  { icon: "💳", n: "01", title: "Subscribe", body: "Choose monthly or yearly. Part of every subscription funds your charity and the prize pool." },
  { icon: "⛳", n: "02", title: "Enter scores", body: "Log your last 5 Stableford scores. Each score becomes one of your draw numbers." },
  { icon: "🎯", n: "03", title: "Win prizes", body: "Match 3, 4, or all 5 numbers in the monthly draw to win from the prize pool." },
  { icon: "💚", n: "04", title: "Support causes", body: "At least 10% of your subscription goes directly to your chosen charity every month." },
];

const PRIZE_TIERS = [
  { tier: "5-Number Match", share: "40%", desc: "Jackpot — rolls over if unclaimed", c: C.emerald, bg: C.emeraldLight },
  { tier: "4-Number Match", share: "35%", desc: "Split equally among winners", c: C.gold, bg: C.goldLight },
  { tier: "3-Number Match", share: "25%", desc: "Split equally among winners", c: C.coral, bg: C.coralLight },
];

export function Home() {
  const navigate = useNavigate();
  const [charities, setCharities] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: ch } = await supabase.from("charities").select("*").order("raised", { ascending: false }).limit(4);
      setCharities(ch || []);

      const [{ count: subCount }, { data: charAll }] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("subscription_status", "active"),
        supabase.from("charities").select("raised"),
      ]);
      const totalRaised = (charAll || []).reduce((sum, c) => sum + Number(c.raised || 0), 0);
      const { data: settings } = await supabase.from("platform_settings").select("jackpot_balance").single();
      setStats([
        { value: fmt(totalRaised), label: "Donated to charity" },
        { value: `${subCount ?? 0}+`, label: "Active members" },
        { value: fmt(settings?.jackpot_balance || 0), label: "Current jackpot" },
        { value: `${(charAll || []).length}`, label: "Charities supported" },
      ]);
    })();
  }, []);

  return (
    <div className="fade-in">
      <div style={{ background: "linear-gradient(135deg,#0d1a13 0%,#1a1f2e 100%)", color: C.white, padding: "4.5rem 2rem 4rem", textAlign: "center" }}>
        <Pill color={C.emeraldMid} bg="rgba(29,158,117,0.18)" style={{ marginBottom: "1.5rem", fontSize: 12 }}>
          ✦ Monthly prize draws · Powered by your game
        </Pill>

        <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-2.5px", lineHeight: 1.05, margin: "0 0 1.25rem" }}>
          Play golf.<br />
          <span style={{ color: C.emeraldMid }}>Change lives.</span><br />
          Win together.
        </h1>

        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.6)", maxWidth: 480, margin: "0 auto 2.5rem", lineHeight: 1.75 }}>
          Enter your Stableford scores, join the monthly draw, and direct your contribution to a cause that matters — every month, every round.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => navigate("/subscribe")} style={{ background: C.emerald, color: C.white, border: "none", borderRadius: 12, padding: "13px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            Start playing for good →
          </button>
          <button onClick={() => navigate("/charities")} style={{ background: "transparent", color: "rgba(255,255,255,0.75)", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 12, padding: "13px 22px", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            See charities
          </button>
        </div>

        <div style={{ display: "flex", gap: "2.5rem", justifyContent: "center", marginTop: "3.5rem", flexWrap: "wrap" }}>
          {stats
            ? stats.map(({ value, label }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.emeraldMid }}>{value}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{label}</div>
                </div>
              ))
            : <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Loading live stats…</div>}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>How it works</p>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px" }}>Simple by design. Meaningful by purpose.</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1rem", marginBottom: "3rem" }}>
          {HOW_IT_WORKS.map(({ icon, n, title, body }) => (
            <div key={n} style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "1.25rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 10, right: 14, fontSize: 36, opacity: 0.05, fontWeight: 900, color: C.emerald }}>{n}</div>
              <div style={{ fontSize: 28, marginBottom: "0.6rem" }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5 }}>{title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{body}</div>
            </div>
          ))}
        </div>

        <Card accent style={{ marginBottom: "2.5rem" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: "1rem" }}>Monthly prize pool structure</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "0.75rem" }}>
            {PRIZE_TIERS.map(({ tier, share, desc, c, bg }) => (
              <div key={tier} style={{ background: bg, borderRadius: 12, padding: "1rem" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: c }}>{share}</div>
                <div style={{ fontWeight: 600, fontSize: 14, margin: "3px 0" }}>{tier}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{desc}</div>
              </div>
            ))}
          </div>
        </Card>

        <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "1.25rem" }}>
          Charities you can support
        </p>
        {!charities ? (
          <PageLoader label="Loading charities…" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
            {charities.map((c) => (
              <Card key={c.id}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{c.name}</div>
                <Pill color={C.muted} bg={C.surface} style={{ fontSize: 11, marginBottom: 8 }}>{c.category}</Pill>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 8 }}>{c.description.slice(0, 80)}…</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.emerald }}>{fmt(c.raised)} raised</div>
              </Card>
            ))}
          </div>
        )}

        <div style={{ background: C.ink, borderRadius: 20, padding: "3rem 2rem", textAlign: "center", color: C.white }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 10 }}>Ready to play for good?</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: "2rem" }}>
            Join thousands of golfers turning their game into impact. From £9.99/month.
          </div>
          <button onClick={() => navigate("/subscribe")} style={{ background: C.emerald, color: C.white, border: "none", borderRadius: 12, padding: "13px 36px", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            Subscribe now →
          </button>
        </div>
      </div>
    </div>
  );
}
