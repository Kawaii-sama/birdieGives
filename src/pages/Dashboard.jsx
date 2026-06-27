import { useEffect, useState, useCallback } from "react";
import { C } from "../lib/tokens.js";
import {
  Alert, Btn, Card, StatBox, Pill, Badge, Divider, TabBar, Page, Toggle, DrawBall, Field, PageLoader, Spinner,
} from "../components/Atoms.jsx";
import { fmt, fmtDate, scoreColor, today, monthLabel } from "../lib/clientUtils.js";
import { validateScore, countMatches } from "../lib/draws.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { supabase } from "../lib/supabaseClient.js";

export function Dashboard() {
  const { profile, session, refreshProfile } = useAuth();
  const [tab, setTab] = useState("overview");
  const [scores, setScores] = useState(null);
  const [draws, setDraws] = useState(null);
  const [winners, setWinners] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [ns, setNs] = useState({ score: "", date: "" });
  const [cpct, setCpct] = useState(profile?.charity_pct ?? 10);
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);

  const userId = profile?.id;

  const loadAll = useCallback(async () => {
    if (!userId) return;
    const [{ data: sc }, { data: dr }, { data: wn }] = await Promise.all([
      supabase.from("scores").select("*").eq("user_id", userId).order("played_on", { ascending: false }),
      supabase.from("draws").select("*").eq("published", true).order("month", { ascending: false }),
      supabase.from("winners").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setScores(sc || []);
    setDraws(dr || []);
    setWinners(wn || []);
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { setCpct(profile?.charity_pct ?? 10); }, [profile?.charity_pct]);

  function toast(type, msg) {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 3500);
  }

  if (!profile || !scores || !draws || !winners) return <PageLoader label="Loading your dashboard…" />;

  const charity = profile.charity;
  const planLabel = profile.plan === "yearly" ? "Yearly" : profile.plan === "monthly" ? "Monthly" : "—";
  const price = profile.plan === "yearly" ? 9.99 : profile.plan === "monthly" ? 12.99 : 0;
  const totalWon = winners.filter((w) => w.status === "paid").reduce((s, w) => s + Number(w.amount), 0);
  const pendingClaims = winners.filter((w) => w.status === "pending");
  const latestDraw = draws[0];

  async function addScore() {
    const err = validateScore(ns.score, ns.date, scores);
    if (err) return toast("error", err);
    setBusy(true);
    const { error } = await supabase.from("scores").insert({ user_id: userId, score: parseInt(ns.score, 10), played_on: ns.date });
    setBusy(false);
    if (error) return toast("error", error.message.includes("duplicate") ? "A score for this date already exists." : error.message);
    setNs({ score: "", date: "" });
    setAdding(false);
    toast("success", "Score added. Your draw numbers have been updated.");
    loadAll();
  }

  async function saveEdit() {
    const err = validateScore(editing.score, editing.played_on, scores, editing.id);
    if (err) return toast("error", err);
    setBusy(true);
    const { error } = await supabase
      .from("scores")
      .update({ score: parseInt(editing.score, 10), played_on: editing.played_on })
      .eq("id", editing.id);
    setBusy(false);
    if (error) return toast("error", error.message);
    setEditing(null);
    toast("success", "Score updated.");
    loadAll();
  }

  async function removeScore(id) {
    const { error } = await supabase.from("scores").delete().eq("id", id);
    if (error) return toast("error", error.message);
    toast("success", "Score removed.");
    loadAll();
  }

  async function saveCharityPct() {
    const { error } = await supabase.from("profiles").update({ charity_pct: cpct }).eq("id", userId);
    if (error) return toast("error", error.message);
    await refreshProfile();
    toast("success", `Contribution updated to ${cpct}%.`);
  }

  async function toggleNotif(key, value) {
    await supabase.from("profiles").update({ [key]: value }).eq("id", userId);
    refreshProfile();
  }

  async function openBillingPortal() {
    setBusy(true);
    try {
      const res = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e) {
      toast("error", e.message);
      setBusy(false);
    }
  }

  async function uploadProof(winnerId, file) {
    setBusy(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/${winnerId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("winner-proof").upload(path, file);
    if (upErr) {
      setBusy(false);
      return toast("error", upErr.message);
    }
    const { error } = await supabase.from("winners").update({ proof_url: path }).eq("id", winnerId);
    setBusy(false);
    if (error) return toast("error", error.message);
    toast("success", "Proof uploaded — an admin will review it shortly.");
    loadAll();
  }

  const sorted = scores;
  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "scores", label: "My Scores" },
    { id: "draws", label: "Draw History" },
    { id: "wins", label: "My Wins", badge: pendingClaims.length || null },
    { id: "charity", label: "Charity" },
    { id: "account", label: "Account" },
  ];

  return (
    <div className="fade-in">
      <div style={{ background: "linear-gradient(135deg,#0d1a13,#1a1f2e)", padding: "1.5rem", color: C.white }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Welcome back, {profile.name?.split(" ")[0]} 👋</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
              {planLabel} subscriber {latestDraw ? `· Last draw: ${monthLabel(latestDraw.month)}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill color={profile.subscription_status === "active" ? C.emeraldMid : C.coral} bg={profile.subscription_status === "active" ? "rgba(29,158,117,0.2)" : "rgba(216,90,48,0.2)"} style={{ fontSize: 11 }}>
              ● {profile.subscription_status}
            </Pill>
            <Pill color="rgba(255,255,255,0.6)" bg="rgba(255,255,255,0.08)" style={{ fontSize: 11 }}>{scores.length}/5 scores</Pill>
          </div>
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <Page>
        {flash && <Alert type={flash.type}>{flash.msg}</Alert>}
        {profile.subscription_status !== "active" && (
          <Alert type="warn">
            Your subscription isn't active, so score entry and draw eligibility are paused.{" "}
            <a href="/subscribe" style={{ color: C.gold, fontWeight: 600 }}>Reactivate your plan →</a>
          </Alert>
        )}

        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <StatBox label="Plan" value={planLabel} sub={price ? `£${price}/month` : "—"} />
              <StatBox label="Scores logged" value={`${scores.length}/5`} sub="Rolling window" accent />
              <StatBox label="Draws entered" value={draws.length} sub="Published so far" />
              <StatBox label="Total won" value={fmt(totalWon)} sub="All time" color={C.gold} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
              <Card>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "0.75rem" }}>Your current draw numbers</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "0.75rem" }}>
                  {sorted.map((s) => <DrawBall key={s.id} number={s.score} filled />)}
                  {Array(Math.max(0, 5 - scores.length)).fill(0).map((_, i) => <DrawBall key={i} filled={false} />)}
                </div>
                <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
                  These are your numbers for the next draw. Fill all 5 slots to maximise your chances.
                </p>
                <Btn variant="small" onClick={() => setTab("scores")}>Manage scores →</Btn>
              </Card>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Card>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Supporting</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ fontSize: 24 }}>{charity?.icon}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{charity?.name || "No charity selected"}</div>
                      {price > 0 && <div style={{ fontSize: 11, color: C.muted }}>{profile.charity_pct}% · £{(price * profile.charity_pct / 100).toFixed(2)}/mo</div>}
                    </div>
                  </div>
                </Card>
                {pendingClaims.length > 0 && (
                  <Card style={{ background: C.goldLight, border: `1px solid ${C.goldBorder}` }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: C.gold, marginBottom: 4 }}>🏆 You have a pending claim</div>
                    <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>Upload proof to claim your prize.</div>
                    <Btn variant="small" onClick={() => setTab("wins")}>Go to My Wins →</Btn>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "scores" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>My Stableford Scores</h2>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Only your 5 most recent scores are retained. Adding a 6th removes the oldest.</p>
              </div>
              {!adding && profile.subscription_status === "active" && <Btn onClick={() => setAdding(true)}>+ Add score</Btn>}
            </div>

            {adding && (
              <Card highlighted style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "0.75rem" }}>New score</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.75rem", alignItems: "flex-end" }}>
                  <Field label="Stableford score (1–45)">
                    <input type="number" min={1} max={45} value={ns.score} onChange={(e) => setNs((p) => ({ ...p, score: e.target.value }))} placeholder="e.g. 32" />
                  </Field>
                  <Field label="Date of round">
                    <input type="date" value={ns.date} max={today()} onChange={(e) => setNs((p) => ({ ...p, date: e.target.value }))} />
                  </Field>
                  <div style={{ display: "flex", gap: 6, paddingBottom: 1 }}>
                    <Btn onClick={addScore} disabled={busy}>{busy ? <Spinner size={14} /> : "Save"}</Btn>
                    <Btn variant="secondary" onClick={() => { setAdding(false); setNs({ score: "", date: "" }); }}>Cancel</Btn>
                  </div>
                </div>
              </Card>
            )}

            <Card>
              {sorted.length === 0 && (
                <div style={{ textAlign: "center", color: C.muted, padding: "2rem", fontSize: 13 }}>
                  No scores yet — add your first round to enter the draw.
                </div>
              )}
              {sorted.map((sc, i) => (
                <div key={sc.id}>
                  {i > 0 && <Divider />}
                  {editing?.id === sc.id ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.75rem", alignItems: "flex-end" }}>
                      <Field label="Score">
                        <input type="number" min={1} max={45} value={editing.score} onChange={(e) => setEditing((p) => ({ ...p, score: e.target.value }))} />
                      </Field>
                      <Field label="Date">
                        <input type="date" value={editing.played_on} max={today()} onChange={(e) => setEditing((p) => ({ ...p, played_on: e.target.value }))} />
                      </Field>
                      <div style={{ display: "flex", gap: 6, paddingBottom: 1 }}>
                        <Btn variant="small" onClick={saveEdit}>Save</Btn>
                        <Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <div style={{ width: 46, height: 46, borderRadius: "50%", background: scoreColor(sc.score), color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                          {sc.score}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{sc.score} points</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{fmtDate(sc.played_on)}</div>
                          <div style={{ width: 100, height: 5, borderRadius: 3, background: `linear-gradient(90deg,${scoreColor(sc.score)} ${(sc.score / 45) * 100}%,${C.border} 0%)`, marginTop: 5 }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Btn variant="small" onClick={() => setEditing({ ...sc })}>Edit</Btn>
                        <Btn variant="danger" onClick={() => removeScore(sc.id)}>Remove</Btn>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </Card>

            <Card style={{ marginTop: "0.75rem", background: C.goldLight, border: `1px solid ${C.goldBorder}` }}>
              <strong style={{ fontSize: 12, color: C.gold }}>📋 Score rules</strong>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6, lineHeight: 2.1 }}>
                · Scores must be Stableford format (1–45) &nbsp;·&nbsp; Each score must include the date played<br />
                · Only one score per date allowed &nbsp;·&nbsp; Adding a 6th score removes the oldest automatically
              </div>
            </Card>
          </div>
        )}

        {tab === "draws" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: "1.25rem" }}>Draw History</h2>
            {draws.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, padding: "2rem" }}>No draws have been published yet — check back after the next monthly cycle.</div>
            ) : (
              <>
                <Alert type="warn">Numbers shown in green match your current scores.</Alert>
                {draws.map((d) => (
                  <Card key={d.id} style={{ marginBottom: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{monthLabel(d.month)}</div>
                      {d.jackpot_rolled && <Pill color={C.gold} bg={C.goldLight} style={{ fontSize: 11 }}>Jackpot rolled over</Pill>}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem", flexWrap: "wrap" }}>
                      {d.numbers.map((n, i) => {
                        const hit = scores.some((s) => s.score === n);
                        return <DrawBall key={i} number={n} matched={hit} />;
                      })}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem" }}>
                      {[["5-Match", d.pool_5], ["4-Match", d.pool_4], ["3-Match", d.pool_3]].map(([tier, p]) => (
                        <div key={tier} style={{ background: C.surface, borderRadius: 10, padding: "0.75rem", textAlign: "center", border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 11, color: C.muted }}>{tier}</div>
                          <div style={{ fontSize: 11, color: C.emerald, fontWeight: 600, marginTop: 4 }}>{fmt(p)}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "wins" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: "1.25rem" }}>My Wins</h2>
            {winners.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, padding: "2rem" }}>No wins yet — keep logging your scores for a chance at next month's draw.</div>
            ) : (
              winners.map((w) => (
                <Card key={w.id} style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <Pill color={C.muted} bg={C.surface} style={{ fontSize: 11, marginBottom: 6 }}>{w.tier}</Pill>
                      <div style={{ fontWeight: 700, fontSize: 18, color: C.emerald }}>{fmt(w.amount)}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Matched: {w.matched_numbers.join(", ")}</div>
                    </div>
                    <Badge ok={w.status === "paid"} rejected={w.status === "rejected"}>{w.status}</Badge>
                  </div>
                  {w.status === "pending" && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                      {w.proof_url ? (
                        <span style={{ fontSize: 12, color: C.emerald, fontWeight: 600 }}>✓ Proof submitted — awaiting admin review</span>
                      ) : (
                        <div>
                          <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6 }}>
                            Upload a screenshot of your scores to claim this prize
                          </label>
                          <input type="file" accept="image/*" disabled={busy} onChange={(e) => e.target.files[0] && uploadProof(w.id, e.target.files[0])} />
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {tab === "charity" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: "1.25rem" }}>Your Charity</h2>
            {!charity ? (
              <Alert type="warn">You haven't selected a charity yet. Pick one from the <a href="/charities" style={{ color: C.gold, fontWeight: 600 }}>charity directory</a>.</Alert>
            ) : (
              <Card accent style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: "1rem" }}>
                  <div style={{ fontSize: 36 }}>{charity.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{charity.name}</div>
                    <Pill color={C.muted} bg={C.surface} style={{ fontSize: 11, marginTop: 4 }}>{charity.category}</Pill>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: "1rem" }}>{charity.description}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <StatBox label="Your monthly gift" value={price ? `£${(price * cpct / 100).toFixed(2)}` : "—"} accent />
                  <StatBox label="Total raised" value={fmt(charity.raised)} color={C.gold} />
                </div>
              </Card>
            )}
            <Card>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "0.75rem" }}>Adjust contribution</div>
              <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5 }}>
                Percentage: <strong style={{ color: C.emerald }}>{cpct}%</strong>
              </label>
              <input type="range" min={10} max={50} step={5} value={cpct} onChange={(e) => setCpct(+e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: C.muted, marginBottom: "1rem" }}>
                Monthly gift: <strong style={{ color: C.emerald }}>£{price ? (price * cpct / 100).toFixed(2) : "0.00"}</strong>
              </div>
              <Btn onClick={saveCharityPct}>Save preference</Btn>
            </Card>
          </div>
        )}

        {tab === "account" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: "1.25rem" }}>Account Settings</h2>
            <Card style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "0.75rem" }}>Profile</div>
              <div style={{ marginBottom: "0.75rem" }}><Field label="Full name"><input value={profile.name} readOnly /></Field></div>
              <div><Field label="Email address"><input value={profile.email} readOnly /></Field></div>
            </Card>

            <Card style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "0.75rem" }}>Subscription</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{planLabel} plan{price ? ` — £${price}/month` : ""}</div>
                  {profile.current_period_end && (
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Renews {fmtDate(profile.current_period_end)}</div>
                  )}
                </div>
                <Badge ok={profile.subscription_status === "active"}>{profile.subscription_status}</Badge>
              </div>
              <Divider />
              <Btn variant="secondary" onClick={openBillingPortal} disabled={busy}>
                {busy ? <Spinner size={14} /> : "Manage billing / cancel"}
              </Btn>
            </Card>

            <Card>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "0.75rem" }}>Email notifications</div>
              {[
                ["notif_draws", "Draw results"],
                ["notif_winners", "Winner announcements"],
                ["notif_renewal", "Renewal reminders"],
                ["notif_charity", "Charity updates"],
              ].map(([key, label]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.inkSoft }}>{label}</span>
                  <Toggle on={profile[key]} onChange={(v) => toggleNotif(key, v)} />
                </div>
              ))}
            </Card>
          </div>
        )}
      </Page>
    </div>
  );
}
