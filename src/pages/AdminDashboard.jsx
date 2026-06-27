import { useState, useEffect, useCallback } from "react";
import { C } from "../lib/tokens.js";
import {
  Alert, Btn, Card, StatBox, Pill, Badge, Divider,
  TabBar, Page, DrawBall, TH, TD, Field, Spinner, PageLoader,
} from "../components/Atoms.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { runDraw, calcPrizePools } from "../lib/draws.js";
import { fmt, fmtDate, monthLabel } from "../lib/clientUtils.js";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

// ─── helpers ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",  label: "Overview" },
  { id: "users",     label: "Users" },
  { id: "draws",     label: "Draw Engine" },
  { id: "charities", label: "Charities" },
  { id: "winners",   label: "Winners" },
];

function ym(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ─── component ────────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const [tab, setTab]       = useState("overview");
  const [toast, setToast]   = useState(null);
  const [busy, setBusy]     = useState(false);

  // Data state
  const [stats,     setStats]     = useState(null);
  const [users,     setUsers]     = useState([]);
  const [draws,     setDraws]     = useState([]);
  const [charities, setCharities] = useState([]);
  const [winners,   setWinners]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Draw engine state
  const [drawMode,    setDrawMode]    = useState("random");
  const [simResult,   setSimResult]   = useState(null);
  const [publishedDraw, setPublishedDraw] = useState(null);

  // Charity form state
  const [charityForm, setCharityForm] = useState({ name: "", description: "", category: "", icon: "💚" });
  const [editingCharity, setEditingCharity] = useState(null);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── guard: must be admin ────────────────────────────────────────────────────
  useEffect(() => {
    if (profile && profile.role !== 'admin') navigate("/dashboard");
  }, [profile, navigate]);

  // ── load all data ───────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: usersData },
        { data: drawsData },
        { data: charitiesData },
        { data: winnersData },
      ] = await Promise.all([
        supabase.from("profiles").select("*, subscriptions(plan, status, charity_pct, renewal_date)").order("created_at", { ascending: false }),
        supabase.from("draws").select("*").order("month", { ascending: false }),
        supabase.from("charities").select("*").order("name"),
        supabase.from("winners").select("*, profiles(name, email), draws(month, published)").order("created_at", { ascending: false }),
      ]);

      const u = usersData || [];
      const activeCount = u.filter(x => x.subscriptions?.[0]?.status === "active").length;
      // Build a simple profiles array for the pool calculator
      const activeSubs  = u.filter(x => x.subscriptions?.[0]?.status === "active");
      const profilesForCalc = activeSubs.map(x => ({ plan: x.subscriptions?.[0]?.plan || "monthly" }));
      const SETTINGS    = { monthly_price: 9.99, yearly_price: 99, pool_share: 0.55, tier5_share: 0.40, tier4_share: 0.35, tier3_share: 0.25 };
      const prizeData   = calcPrizePools(profilesForCalc, SETTINGS);

      setUsers(u);
      setDraws(drawsData || []);
      setCharities(charitiesData || []);
      setWinners(winnersData || []);
      setStats({
        totalUsers:    u.length,
        activeUsers:   activeCount,
        totalPool:     prizeData.total,
        jackpot:       prizeData.match5,
        charityTotal:  u.reduce((acc, x) => {
          const sub = x.subscriptions?.[0];
          if (sub?.status === "active") acc += 9.99 * (sub.charity_pct || 10) / 100;
          return acc;
        }, 0),
      });
    } catch (e) {
      notify("Failed to load data: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── DRAW ENGINE ──────────────────────────────────────────────────────────
  const runSimulation = async () => {
    setBusy(true);
    setSimResult(null);
    try {
      // Get active subscriber IDs
      const { data: activeSubs } = await supabase
        .from("profiles")
        .select("id")
        .eq("subscription_status", "active");
      const activeIds = (activeSubs || []).map(p => p.id);

      // Fetch their latest 5 scores
      const { data: scores } = await supabase
        .from("scores")
        .select("score, user_id")
        .in("user_id", activeIds.length ? activeIds : ["00000000-0000-0000-0000-000000000000"])
        .order("played_on", { ascending: false });

      // Remap user_id → profile_id for runDraw compatibility
      const remapped = (scores || []).map(s => ({ ...s, profile_id: s.user_id }));
      const result = runDraw(remapped, drawMode);
      setSimResult(result);
      notify("Simulation complete — review results before publishing.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const publishDraw = async () => {
    if (!simResult) return;
    setBusy(true);
    try {
      const currentMonth = ym();
      // Upsert draw record
      const { data: drawRow, error: drawErr } = await supabase
        .from("draws")
        .upsert({
          month:        currentMonth,
          numbers:      simResult.drawnNumbers,
          logic:        drawMode === "random" ? "random" : "algorithmic",
          published:    true,
          published_at: new Date().toISOString(),
          pool_total:   0,
          pool_5:       0,
          pool_4:       0,
          pool_3:       0,
          jackpot_in:   0,
          jackpot_rolled: simResult.winners?.filter(w => w.tier === "5-match").length === 0,
        }, { onConflict: "month" })
        .select()
        .single();
      if (drawErr) throw drawErr;

      // Mark winning entries
      if (simResult.winners?.length) {
        const winnerRows = simResult.winners.map(w => ({
          draw_id:         drawRow.id,
          user_id:         w.profileId,
          tier:            w.tier,
          matched_numbers: w.matchedNumbers || [],
          amount:          w.prizeAmount || 0,
          status:          "pending",
        }));
        await supabase.from("winners").insert(winnerRows);
      }

      // Notify via API
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ action: "draw_published", drawId: drawRow.id }),
      });

      setPublishedDraw(drawRow);
      notify("Draw published and subscribers notified! 🎉");
      await loadAll();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  // ─── CHARITY CRUD ─────────────────────────────────────────────────────────
  const saveCharity = async () => {
    if (!charityForm.name.trim()) return notify("Charity name is required.", "error");
    setBusy(true);
    try {
      if (editingCharity) {
        const { error } = await supabase.from("charities").update(charityForm).eq("id", editingCharity);
        if (error) throw error;
        notify("Charity updated.");
      } else {
        const { error } = await supabase.from("charities").insert(charityForm);
        if (error) throw error;
        notify("Charity added.");
      }
      setCharityForm({ name: "", description: "", category: "", icon: "💚" });
      setEditingCharity(null);
      await loadAll();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteCharity = async (id) => {
    if (!window.confirm("Delete this charity? This cannot be undone.")) return;
    const { error } = await supabase.from("charities").delete().eq("id", id);
    if (error) return notify(error.message, "error");
    notify("Charity removed.");
    await loadAll();
  };

  // ─── WINNER VERIFICATION ──────────────────────────────────────────────────
  const updateWinnerStatus = async (entryId, paidStatus) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("winners")
        .update({ status: paidStatus, reviewed_at: paidStatus === "paid" ? new Date().toISOString() : null })
        .eq("id", entryId);
      if (error) throw error;

      if (paidStatus === "paid") {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
          body: JSON.stringify({ action: "winner_paid", entryId }),
        });
      }
      notify(paidStatus === "paid" ? "Marked as paid ✓" : "Status updated.");
      await loadAll();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (loading) return <PageLoader label="Loading admin data…" />;

  return (
    <div style={{ minHeight: "100vh", background: C.surface }}>
      {/* Admin header */}
      <div style={{ background: C.adminDark, color: C.white, padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.2px" }}>BirdieGives Admin</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          Signed in as {profile?.name || profile?.email}
        </span>
      </div>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "12px 18px", borderRadius: 12,
          background: toast.type === "error" ? "#dc2626" : C.emerald,
          color: C.white, fontSize: 13, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", maxWidth: 340 }}>
          {toast.msg}
        </div>
      )}

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }} className="fade-in">

        {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
        {tab === "overview" && stats && (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: "1.25rem" }}>Platform Overview</h2>
            <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
              <StatBox label="Total Users"    value={stats.totalUsers}  sub="all time"         color={C.ink} />
              <StatBox label="Active Subs"    value={stats.activeUsers} sub="paying this month" color={C.emerald} accent />
              <StatBox label="Monthly Pool"   value={fmt(stats.totalPool)}  sub="prize funds"  color={C.gold} />
              <StatBox label="Charity Total"  value={fmt(stats.charityTotal)} sub="this cycle" color={C.coral} />
            </div>
            <div className="grid-2">
              <Card>
                <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Prize Pool Breakdown</div>
                {[
                  { label: "5-Match Jackpot (40%)", val: fmt(stats.jackpot) },
                  { label: "4-Match Pool (35%)",    val: fmt(stats.totalPool * 0.35) },
                  { label: "3-Match Pool (25%)",    val: fmt(stats.totalPool * 0.25) },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                    <span style={{ color: C.inkSoft }}>{r.label}</span>
                    <span style={{ fontWeight: 600 }}>{r.val}</span>
                  </div>
                ))}
              </Card>
              <Card>
                <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Recent Draws</div>
                {draws.slice(0, 5).map(d => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                    <span style={{ color: C.inkSoft }}>{monthLabel(d.month)}</span>
                    <Badge ok={d.published === true}>{d.published ? "published" : "draft"}</Badge>
                  </div>
                ))}
                {draws.length === 0 && <p style={{ fontSize: 13, color: C.muted }}>No draws yet.</p>}
              </Card>
            </div>
          </div>
        )}

        {/* ── USERS ─────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: "1.25rem" }}>User Management</h2>
            <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${C.border}`, background: C.white }}>
              <table>
                <thead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Email</TH>
                    <TH>Plan</TH>
                    <TH>Status</TH>
                    <TH>Charity %</TH>
                    <TH>Renewal</TH>
                    <TH>Admin</TH>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const sub = u.subscriptions?.[0];
                    return (
                      <tr key={u.id}>
                        <TD><span style={{ fontWeight: 500 }}>{u.name || "—"}</span></TD>
                        <TD>{u.email}</TD>
                        <TD>
                          {sub?.plan
                            ? <Pill bg={C.emeraldLight} color={C.emerald}>{sub.plan}</Pill>
                            : <Pill bg={C.surface} color={C.muted}>none</Pill>
                          }
                        </TD>
                        <TD>
                          <Badge ok={sub?.status === "active"} rejected={sub?.status === "cancelled"}>
                            {sub?.status || "inactive"}
                          </Badge>
                        </TD>
                        <TD>{sub?.charity_pct ?? "—"}%</TD>
                        <TD>{sub?.renewal_date ? fmtDate(sub.renewal_date) : "—"}</TD>
                        <TD>
                          <Badge ok={u.role === 'admin'}>{u.role === 'admin' ? "Admin" : "User"}</Badge>
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {users.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: C.muted, fontSize: 13 }}>No users yet.</div>}
            </div>
          </div>
        )}

        {/* ── DRAW ENGINE ───────────────────────────────────────────────── */}
        {tab === "draws" && (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: "1.25rem" }}>Draw Engine</h2>
            <div className="grid-2" style={{ gap: "1.5rem" }}>
              {/* Controls */}
              <Card>
                <div style={{ fontWeight: 600, marginBottom: "1rem" }}>Configure Draw — {monthLabel(ym())}</div>
                <Field label="Draw Algorithm">
                  <select value={drawMode} onChange={e => setDrawMode(e.target.value)} style={{ marginBottom: "1rem" }}>
                    <option value="random">Random (lottery-style)</option>
                    <option value="weighted_freq">Weighted by most-frequent scores</option>
                    <option value="weighted_rare">Weighted by least-frequent scores</option>
                  </select>
                </Field>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn variant="secondary" onClick={runSimulation} disabled={busy}>
                    {busy ? <><Spinner size={14}/> Running…</> : "▶ Run Simulation"}
                  </Btn>
                  <Btn onClick={publishDraw} disabled={!simResult || busy}>
                    📢 Publish Draw
                  </Btn>
                </div>
                {simResult && (
                  <Alert type="success" style={{ marginTop: "1rem", marginBottom: 0 }}>
                    Simulation ready — {simResult.winners?.length || 0} winner(s) found.
                    Review numbers below, then publish.
                  </Alert>
                )}
              </Card>

              {/* Simulation result */}
              {simResult && (
                <Card accent>
                  <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Drawn Numbers</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
                    {simResult.drawnNumbers.map((n, i) => <DrawBall key={i} number={n} size={40} />)}
                  </div>
                  <Divider />
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: 13 }}>Winners</div>
                  {simResult.winners?.length ? simResult.winners.map((w, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: C.inkSoft }}>{w.name || w.profileId}</span>
                      <span style={{ fontWeight: 600 }}>
                        <Badge ok>{w.tier}</Badge>
                        <span style={{ marginLeft: 8 }}>{fmt(w.prizeAmount)}</span>
                      </span>
                    </div>
                  )) : (
                    <p style={{ fontSize: 13, color: C.muted }}>No winners this draw. Jackpot rolls over.</p>
                  )}
                </Card>
              )}
            </div>

            {/* Draw history */}
            <div style={{ marginTop: "1.5rem" }}>
              <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Draw History</div>
              <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${C.border}`, background: C.white }}>
                <table>
                  <thead>
                    <tr>
                      <TH>Month</TH>
                      <TH>Mode</TH>
                      <TH>Numbers</TH>
                      <TH>Status</TH>
                      <TH>Published</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {draws.map(d => (
                      <tr key={d.id}>
                        <TD>{monthLabel(d.month)}</TD>
                        <TD><Pill bg={C.surface} color={C.inkSoft}>{d.logic || "random"}</Pill></TD>
                        <TD>
                          <div style={{ display: "flex", gap: 4 }}>
                            {(d.numbers || []).map((n, i) => <DrawBall key={i} number={n} size={28} />)}
                          </div>
                        </TD>
                        <TD><Badge ok={d.published === true}>{d.published ? "published" : "draft"}</Badge></TD>
                        <TD>{d.published_at ? fmtDate(d.published_at) : "—"}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {draws.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: C.muted, fontSize: 13 }}>No draws run yet.</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── CHARITIES ─────────────────────────────────────────────────── */}
        {tab === "charities" && (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: "1.25rem" }}>Charity Management</h2>
            <div className="grid-2" style={{ gap: "1.5rem", alignItems: "start" }}>
              {/* Add / Edit form */}
              <Card>
                <div style={{ fontWeight: 600, marginBottom: "1rem" }}>
                  {editingCharity ? "Edit Charity" : "Add New Charity"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <Field label="Charity Name *">
                    <input
                      value={charityForm.name}
                      onChange={e => setCharityForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Swing for Life"
                    />
                  </Field>
                  <Field label="Category">
                    <input
                      value={charityForm.category}
                      onChange={e => setCharityForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Health, Environment, Youth"
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      rows={3}
                      value={charityForm.description}
                      onChange={e => setCharityForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Briefly describe the charity's mission…"
                    />
                  </Field>
                  <Field label="Icon (emoji)">
                    <input
                      value={charityForm.icon}
                      onChange={e => setCharityForm(f => ({ ...f, icon: e.target.value }))}
                      placeholder="💚"
                      style={{ maxWidth: 80 }}
                    />
                  </Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn onClick={saveCharity} disabled={busy}>
                      {busy ? <Spinner size={14}/> : editingCharity ? "Save Changes" : "Add Charity"}
                    </Btn>
                    {editingCharity && (
                      <Btn variant="secondary" onClick={() => { setEditingCharity(null); setCharityForm({ name: "", description: "", category: "", icon: "💚" }); }}>
                        Cancel
                      </Btn>
                    )}
                  </div>
                </div>
              </Card>

              {/* Charity list */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Listed Charities ({charities.length})</div>
                {charities.map(c => (
                  <Card key={c.id} style={{ marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                        {c.category && <Pill bg={C.emeraldLight} color={C.emerald} style={{ marginTop: 4, marginBottom: 4 }}>{c.category}</Pill>}
                        {c.description && <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginTop: 4 }}>{c.description}</p>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <Btn variant="small" onClick={() => {
                          setEditingCharity(c.id);
                          setCharityForm({ name: c.name, description: c.description || "", category: c.category || "", website: c.website || "" });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}>Edit</Btn>
                        <Btn variant="danger" onClick={() => deleteCharity(c.id)}>Delete</Btn>
                      </div>
                    </div>
                  </Card>
                ))}
                {charities.length === 0 && <p style={{ fontSize: 13, color: C.muted }}>No charities listed yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── WINNERS ───────────────────────────────────────────────────── */}
        {tab === "winners" && (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: "1.25rem" }}>
              Winners & Verification
              {winners.filter(w => w.status === "pending").length > 0 && (
                <span style={{ marginLeft: 10, background: C.coral, color: C.white, borderRadius: 10, padding: "2px 9px", fontSize: 12, fontWeight: 700 }}>
                  {winners.filter(w => w.status === "pending").length} pending
                </span>
              )}
            </h2>
            <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${C.border}`, background: C.white }}>
              <table>
                <thead>
                  <tr>
                    <TH>Winner</TH>
                    <TH>Draw Month</TH>
                    <TH>Tier</TH>
                    <TH>Prize</TH>
                    <TH>Payment</TH>
                    <TH>Verified</TH>
                    <TH>Actions</TH>
                  </tr>
                </thead>
                <tbody>
                  {winners.map(w => (
                    <tr key={w.id}>
                      <TD>
                        <div style={{ fontWeight: 500 }}>{w.profiles?.name || "—"}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{w.profiles?.email}</div>
                      </TD>
                      <TD>{w.draws?.month ? monthLabel(w.draws.month) : "—"}</TD>
                      <TD>
                        <Pill
                          bg={w.tier === '5-match' ? C.goldLight : w.tier === '4-match' ? C.emeraldLight : C.surface}
                          color={w.tier === '5-match' ? C.gold : w.tier === '4-match' ? C.emerald : C.inkSoft}
                        >
                          {w.tier || "—"}
                        </Pill>
                      </TD>
                      <TD><span style={{ fontWeight: 600 }}>{w.amount ? fmt(w.amount) : "—"}</span></TD>
                      <TD>
                        <Badge
                          ok={w.status === "paid"}
                          rejected={w.status === "rejected"}
                        >
                          {w.status || "pending"}
                        </Badge>
                      </TD>
                      <TD>{w.reviewed_at ? fmtDate(w.reviewed_at) : "—"}</TD>
                      <TD>
                        <div style={{ display: "flex", gap: 6 }}>
                          {w.status !== "paid" && (
                            <Btn variant="small" onClick={() => updateWinnerStatus(w.id, "paid")} disabled={busy}>
                              Mark Paid
                            </Btn>
                          )}
                          {w.status === "pending" && (
                            <Btn variant="danger" onClick={() => updateWinnerStatus(w.id, "rejected")} disabled={busy}>
                              Reject
                            </Btn>
                          )}
                          {w.proof_url && (
                            <a href={w.proof_url} target="_blank" rel="noreferrer">
                              <Btn variant="ghost">View Proof</Btn>
                            </a>
                          )}
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
              {winners.length === 0 && (
                <div style={{ padding: "2rem", textAlign: "center", color: C.muted, fontSize: 13 }}>
                  No winners to verify yet.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
