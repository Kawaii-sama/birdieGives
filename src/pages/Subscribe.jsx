import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../lib/tokens.js";
import { Alert, Btn, Card, Pill, Field, Spinner, PageLoader } from "../components/Atoms.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { LoginModal } from "../components/LoginModal.jsx";

export function Subscribe() {
  const navigate = useNavigate();
  const { session, profile, signUp, signIn } = useAuth();

  const [settings, setSettings] = useState(null);
  const [charities, setCharities] = useState(null);
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState("yearly");
  const [charityId, setCharityId] = useState(null);
  const [pct, setPct] = useState(10);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    supabase.from("platform_settings").select("*").single().then(({ data }) => setSettings(data));
    supabase.from("charities").select("*").then(({ data }) => setCharities(data || []));
  }, []);

  if (!settings || !charities) return <PageLoader label="Loading plans…" />;

  const price = plan === "yearly" ? settings.yearly_price : settings.monthly_price;
  const pool = +(price * settings.pool_share).toFixed(2);
  const charity = +(price * pct / 100).toFixed(2);
  const platform = +(price - pool - charity).toFixed(2);
  const selCharity = charities.find((c) => c.id === charityId);

  const STEPS = ["Choose plan", "Select charity", "Checkout"];

  async function startCheckout() {
    setErr("");
    if (!session) return setErr("Please sign in or create an account first.");
    setBusy(true);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan, charityId, charityPct: pct }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url; // hand off to Stripe's hosted Checkout page
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.5rem" }} className="fade-in">
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap" }}>
        {STEPS.map((label, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: step >= i + 1 ? C.emerald : C.border, color: step >= i + 1 ? C.white : C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 13, fontWeight: step === i + 1 ? 600 : 400, color: step === i + 1 ? C.ink : C.muted }}>{label}</span>
            {i < 2 && <div style={{ width: 24, height: 1, background: C.border }} />}
          </div>
        ))}
      </div>

      {err && <Alert type="error">{err}</Alert>}

      {step === 1 && (
        <div className="fade-in">
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: "1.5rem", letterSpacing: "-0.5px" }}>Choose your plan</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {[
              { key: "monthly", label: "Monthly", price: settings.monthly_price, saving: null },
              { key: "yearly", label: "Yearly", price: settings.yearly_price, saving: "Save 23%" },
            ].map((p) => (
              <div key={p.key} onClick={() => setPlan(p.key)} style={{ background: C.white, borderRadius: 16, border: `2px solid ${plan === p.key ? C.emerald : C.border}`, padding: "1.25rem", cursor: "pointer", position: "relative" }}>
                {p.saving && <Pill color={C.white} bg={C.emerald} style={{ position: "absolute", top: 10, right: 10, fontSize: 10 }}>{p.saving}</Pill>}
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{p.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>
                  £{p.price}<span style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>/month</span>
                </div>
                {p.key === "yearly" && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Billed £{(p.price * 12).toFixed(2)}/year</div>}
              </div>
            ))}
          </div>

          <Card style={{ background: C.surface, marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "0.75rem" }}>Where your money goes</div>
            <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ width: `${settings.pool_share * 100}%`, background: C.emerald }} />
              <div style={{ width: `${pct}%`, background: C.gold }} />
              <div style={{ flex: 1, background: C.border }} />
            </div>
            <div style={{ display: "flex", gap: "1.25rem", fontSize: 12, flexWrap: "wrap" }}>
              <span><span style={{ color: C.emerald, fontWeight: 600 }}>{(settings.pool_share * 100).toFixed(0)}%</span> Prize pool (£{pool})</span>
              <span><span style={{ color: C.gold, fontWeight: 600 }}>{pct}%</span> Charity (£{charity})</span>
              <span><span style={{ color: C.muted, fontWeight: 600 }}>{(100 - settings.pool_share * 100 - pct).toFixed(0)}%</span> Platform (£{platform})</span>
            </div>
          </Card>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={() => setStep(2)}>Next: Choose charity →</Btn>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="fade-in">
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.5px" }}>Choose your charity</h2>
          <p style={{ color: C.muted, marginBottom: "1.25rem", fontSize: 13 }}>
            A minimum of {settings.min_charity_pct}% of your subscription goes directly to your chosen charity.
          </p>

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: C.muted, display: "block", marginBottom: 5 }}>
              Charity contribution: <strong style={{ color: C.emerald }}>{pct}% — £{charity}/month</strong>
            </label>
            <input type="range" min={settings.min_charity_pct} max={50} step={5} value={pct} onChange={(e) => setPct(+e.target.value)} style={{ width: "100%" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginTop: 3 }}>
              <span>{settings.min_charity_pct}% min</span><span>50% max</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {charities.map((c) => (
              <div key={c.id} onClick={() => setCharityId(c.id)} style={{ background: C.white, borderRadius: 14, border: `2px solid ${charityId === c.id ? C.emerald : C.border}`, padding: "1rem", cursor: "pointer" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{c.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                    <Pill color={C.muted} bg={C.surface} style={{ fontSize: 10, marginTop: 3 }}>{c.category}</Pill>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 5, lineHeight: 1.5 }}>{c.description.slice(0, 65)}…</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
            <Btn variant="secondary" onClick={() => setStep(1)}>← Back</Btn>
            <Btn onClick={() => { if (!charityId) return setErr("Please select a charity."); setErr(""); setStep(3); }}>
              Next: Checkout →
            </Btn>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="fade-in">
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: "1.25rem", letterSpacing: "-0.5px" }}>Confirm & checkout</h2>

          <Card style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Order summary</span>
              <Pill color={C.emerald} bg={C.emeraldLight} style={{ fontSize: 11 }}>{plan === "yearly" ? "Yearly" : "Monthly"}</Pill>
            </div>
            {[
              ["Prize pool contribution", `£${pool}`],
              [`Charity (${selCharity?.name})`, `£${charity}`],
              ["Platform fee", `£${platform}`],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.muted, marginBottom: 5 }}>
                <span>{l}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, color: C.ink, paddingTop: 8, borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
              <span>Total</span><span>£{price}/month</span>
            </div>
          </Card>

          {!session ? (
            <Card style={{ marginBottom: "1.25rem", background: C.goldLight, border: `1px solid ${C.goldBorder}` }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Sign in to continue</div>
              <p style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
                You'll need an account before checkout — it's how you'll log scores and track your draws.
              </p>
              <Btn onClick={() => setShowLogin(true)}>Sign in / create account</Btn>
            </Card>
          ) : (
            <Card style={{ marginBottom: "1.25rem", background: C.emeraldLight }}>
              <div style={{ fontSize: 13 }}>Signed in as <strong>{profile?.email || session.user.email}</strong></div>
            </Card>
          )}

          <div style={{ fontSize: 11, color: C.muted, marginBottom: "1.25rem" }}>
            🔒 You'll be redirected to Stripe's secure checkout. We never see or store your card details.
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
            <Btn variant="secondary" onClick={() => setStep(2)}>← Back</Btn>
            <Btn style={{ padding: "11px 28px", fontSize: 14 }} onClick={startCheckout} disabled={!session || busy}>
              {busy ? <Spinner size={16} /> : "Continue to secure payment →"}
            </Btn>
          </div>
        </div>
      )}

      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />
      )}
    </div>
  );
}
