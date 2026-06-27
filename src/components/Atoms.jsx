import { C } from "../lib/tokens.js";

/* ─── PILL ───────────────────────────────────────────────────────────────── */
export function Pill({ color, bg, children, style = {} }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 11px",
        borderRadius: "9999px",
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.2px",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ─── ALERT ──────────────────────────────────────────────────────────────── */
const ALERT_MAP = {
  success: { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
  error:   { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  warn:    { bg: C.goldLight, color: C.gold, border: C.goldBorder },
};

export function Alert({ type = "warn", children }) {
  const cfg = ALERT_MAP[type] || ALERT_MAP.warn;
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: cfg.bg,
        color: cfg.color,
        fontSize: 13,
        border: `1px solid ${cfg.border}`,
        marginBottom: "1rem",
      }}
    >
      {children}
    </div>
  );
}

/* ─── BUTTON ─────────────────────────────────────────────────────────────── */
const BTN_VARIANTS = {
  primary:   { background: C.emerald, color: C.white, border: "none", padding: "9px 20px", fontSize: 13 },
  secondary: { background: "transparent", color: C.emerald, border: `1.5px solid ${C.emerald}`, padding: "8px 18px", fontSize: 13 },
  danger:    { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "5px 12px", fontSize: 12 },
  small:     { background: C.emeraldLight, color: C.emerald, border: "none", padding: "5px 12px", fontSize: 12 },
  ghost:     { background: "transparent", color: C.inkSoft, border: "none", padding: "6px 12px", fontSize: 13 },
};

export function Btn({ variant = "primary", onClick, children, style = {}, disabled = false, type = "button" }) {
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.primary;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...v,
        borderRadius: 10,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        whiteSpace: "nowrap",
        transition: "opacity 0.15s, filter 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ─── TOGGLE ─────────────────────────────────────────────────────────────── */
export function Toggle({ on, onChange }) {
  return (
    <div
      onClick={() => onChange && onChange(!on)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: on ? C.emerald : C.border,
        position: "relative", cursor: "pointer", flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          width: 16, height: 16, borderRadius: "50%",
          background: C.white, position: "absolute", top: 2,
          left: on ? 18 : 2, transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}

/* ─── CARD ───────────────────────────────────────────────────────────────── */
export function Card({ children, style = {}, accent = false, highlighted = false }) {
  return (
    <div
      style={{
        background: C.white,
        borderRadius: 16,
        border: `${highlighted ? "1.5" : "1"}px solid ${accent ? "#9FE1CB" : highlighted ? C.emerald : C.border}`,
        padding: "1.25rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── STAT BOX ───────────────────────────────────────────────────────────── */
export function StatBox({ label, value, sub, color = C.emerald, accent = false }) {
  return (
    <div
      style={{
        background: accent ? C.emeraldLight : C.surface,
        borderRadius: 12,
        padding: "1rem",
        border: `1px solid ${accent ? "#9FE1CB" : C.border}`,
      }}
    >
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.4px" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, margin: "6px 0 2px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>}
    </div>
  );
}

/* ─── DIVIDER ────────────────────────────────────────────────────────────── */
export function Divider({ style = {} }) {
  return <div style={{ height: 1, background: C.border, margin: "1rem 0", ...style }} />;
}

/* ─── BADGE ──────────────────────────────────────────────────────────────── */
export function Badge({ ok, rejected, children }) {
  const bg    = rejected ? "#fef2f2" : ok ? "#dcfce7" : "#fef9c3";
  const color = rejected ? "#dc2626" : ok ? "#15803d" : "#854d0e";
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "9999px", fontSize: 11, fontWeight: 600, background: bg, color }}>
      {children}
    </span>
  );
}

/* ─── TABLE CELLS ────────────────────────────────────────────────────────── */
export function TH({ children }) {
  return (
    <th style={{ textAlign: "left", padding: "9px 12px", background: C.surface, color: C.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
      {children}
    </th>
  );
}

export function TD({ children, style = {} }) {
  return (
    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.inkSoft, verticalAlign: "middle", fontSize: 13, ...style }}>
      {children}
    </td>
  );
}

/* ─── TAB BAR ────────────────────────────────────────────────────────────── */
export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, background: C.white, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ display: "flex", padding: "0 1.5rem", minWidth: "max-content" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: "11px 13px", border: "none", background: "transparent",
              borderBottom: `2px solid ${active === t.id ? C.emerald : "transparent"}`,
              color: active === t.id ? C.emerald : C.inkSoft,
              fontWeight: active === t.id ? 600 : 400,
              fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
            }}
          >
            {t.label}
            {t.badge ? (
              <span style={{ marginLeft: 5, background: C.coral, color: C.white, borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── PAGE WRAPPER ───────────────────────────────────────────────────────── */
export function Page({ children }) {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem" }} className="fade-in">
      {children}
    </div>
  );
}

/* ─── LABEL + INPUT COMBO ────────────────────────────────────────────────── */
export function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: C.muted, display: "block", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

/* ─── SPINNER ────────────────────────────────────────────────────────────── */
export function Spinner({ size = 22 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        border: `2.5px solid ${C.border}`, borderTopColor: C.emerald,
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

/* ─── FULL PAGE LOADER ───────────────────────────────────────────────────── */
export function PageLoader({ label = "Loading…" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "4rem 0" }}>
      <Spinner size={28} />
      <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
    </div>
  );
}

/* ─── DRAW BALL ──────────────────────────────────────────────────────────── */
export function DrawBall({ number, filled = true, matched = null, size = 46 }) {
  let bg, color, border;
  if (matched === true)  { bg = C.emerald; color = C.white; border = `2px solid ${C.emerald}`; }
  else if (matched === false) { bg = C.surface; color = C.muted; border = `2px solid ${C.border}`; }
  else if (filled) { bg = C.emerald; color = C.white; border = "none"; }
  else { bg = "transparent"; color = C.muted; border = `2px dashed ${C.border}`; }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: bg, color, border,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: size * 0.34, flexShrink: 0,
        boxShadow: (matched || filled) ? "0 2px 8px rgba(15,110,86,0.28)" : "none",
        transition: "all 0.2s", userSelect: "none",
      }}
    >
      {number || (filled ? "" : "+")}
    </div>
  );
}
