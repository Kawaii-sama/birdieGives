import { useState } from "react";
import { C } from "../lib/tokens.js";
import { Alert, Btn, Spinner } from "./Atoms.jsx";
import { useAuth } from "../hooks/useAuth.jsx";

export function LoginModal({ onClose, onSuccess }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    setInfo("");
    if (!email || !pass || (mode === "signup" && !name)) {
      setErr("Please fill in all fields.");
      return;
    }
    setBusy(true);
    if (mode === "signin") {
      const { error } = await signIn({ email, password: pass });
      setBusy(false);
      if (error) return setErr(error.message);
      onSuccess?.();
      onClose();
    } else {
      const { error } = await signUp({ email, password: pass, name });
      setBusy(false);
      if (error) return setErr(error.message);
      setInfo("Account created! Check your inbox to confirm your email, then sign in.");
      setMode("signin");
    }
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.50)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 300, padding: "1rem",
      }}
    >
      <div
        style={{
          background: C.white, borderRadius: 20, padding: "1.75rem",
          maxWidth: 400, width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.ink }}>
            {mode === "signin" ? "Sign in" : "Create your account"}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.muted, lineHeight: 1, padding: "0 4px", fontFamily: "inherit" }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {[["signin", "Sign in"], ["signup", "Sign up"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => { setMode(val); setErr(""); setInfo(""); }}
              style={{
                flex: 1, padding: "9px",
                border: `1.5px solid ${mode === val ? C.emerald : C.border}`,
                borderRadius: 10,
                background: mode === val ? C.emeraldLight : "transparent",
                color: mode === val ? C.emerald : C.muted,
                fontWeight: mode === val ? 600 : 400,
                cursor: "pointer", fontSize: 13, fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {err && <Alert type="error">{err}</Alert>}
        {info && <Alert type="success">{info}</Alert>}

        {mode === "signup" && (
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5 }}>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" />
          </div>
        )}

        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5 }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5 }}>Password</label>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••••••"
          />
        </div>

        <Btn style={{ width: "100%", padding: "12px", fontSize: 14, justifyContent: "center" }} onClick={submit} disabled={busy}>
          {busy ? <Spinner size={16} /> : mode === "signin" ? "Sign in →" : "Create account →"}
        </Btn>
      </div>
    </div>
  );
}
