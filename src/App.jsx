import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { Nav }          from "./components/Nav.jsx";
import { LoginModal }   from "./components/LoginModal.jsx";
import { RequireAuth, RequireAdmin } from "./components/Guards.jsx";

// Pages
import { Home }           from "./pages/Home.jsx";
import { Charities }      from "./pages/Charities.jsx";
import { Subscribe }      from "./pages/Subscribe.jsx";
import { Dashboard }      from "./pages/Dashboard.jsx";
import { AdminDashboard } from "./pages/AdminDashboard.jsx";

import "./global.css";

// ─── Inner app (has access to auth context) ──────────────────────────────────
function AppInner() {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <Nav onLogin={() => setShowLogin(true)} />

      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />
      )}

      <Routes>
        {/* Public */}
        <Route path="/"           element={<Home />} />
        <Route path="/charities"  element={<Charities />} />
        <Route path="/subscribe"  element={<Subscribe />} />

        {/* Auth-gated subscriber area */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth fallback={() => setShowLogin(true)}>
              <Dashboard />
            </RequireAuth>
          }
        />

        {/* Admin-only */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />

        {/* Stripe return URLs */}
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/cancel"  element={<Navigate to="/subscribe" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

// ─── Simple post-checkout landing ─────────────────────────────────────────────
function SuccessPage() {
  const { C } = { C: { emerald: "#0F6E56", emeraldLight: "#E1F5EE", ink: "#1a1f2e", muted: "#6b7280", white: "#ffffff" } };
  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem" }}>
      <div>
        <div style={{ fontSize: 56, marginBottom: "1rem" }}>🎉</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.ink, marginBottom: "0.5rem" }}>
          You're in!
        </h1>
        <p style={{ color: C.muted, marginBottom: "1.5rem", fontSize: 15 }}>
          Your subscription is active. Head to your dashboard to enter scores and check your draw numbers.
        </p>
        <a
          href="/dashboard"
          style={{ display: "inline-block", background: C.emerald, color: C.white, padding: "10px 24px", borderRadius: 12, fontWeight: 600, fontSize: 14, textDecoration: "none" }}
        >
          Go to my dashboard →
        </a>
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </BrowserRouter>
  );
}
