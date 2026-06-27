import { useNavigate, useLocation } from "react-router-dom";
import { C } from "../lib/tokens.js";
import { Pill, Btn } from "./Atoms.jsx";
import { useAuth } from "../hooks/useAuth.jsx";

export function Nav({ onLogin }) {
  const { profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <nav
      style={{
        background: C.white,
        borderBottom: `1px solid ${C.border}`,
        padding: "0 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 54,
        position: "sticky",
        top: 0,
        zIndex: 200,
      }}
    >
      <div style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.emerald, letterSpacing: "-0.5px", lineHeight: 1 }}>
          BirdieGives
        </div>
        <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.6px", textTransform: "uppercase", marginTop: 2 }}>
          Golf · Charity · Draws
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {!profile && (
          <>
            <NavLink active={pathname === "/"} onClick={() => navigate("/")}>Home</NavLink>
            <NavLink active={pathname === "/charities"} onClick={() => navigate("/charities")}>Charities</NavLink>
            <NavLink onClick={onLogin}>Sign in</NavLink>
            <Btn onClick={() => navigate("/subscribe")} style={{ padding: "7px 16px", fontSize: 13 }}>
              Subscribe
            </Btn>
          </>
        )}

        {profile && !isAdmin && (
          <>
            <span style={{ fontSize: 13, color: C.muted, marginRight: 6 }}>
              Hi, {profile.name?.split(" ")[0]}
            </span>
            <Pill
              color={profile.subscription_status === "active" ? C.emeraldMid : C.coral}
              bg={profile.subscription_status === "active" ? "rgba(29,158,117,0.15)" : C.coralLight}
              style={{ fontSize: 11 }}
            >
              {profile.subscription_status === "active" ? "Active" : profile.subscription_status}
            </Pill>
            <Btn variant="secondary" onClick={() => navigate("/dashboard")} style={{ marginLeft: 8, padding: "6px 14px", fontSize: 12 }}>
              Dashboard
            </Btn>
            <Btn variant="ghost" onClick={handleSignOut} style={{ padding: "6px 10px", fontSize: 12 }}>
              Sign out
            </Btn>
          </>
        )}

        {profile && isAdmin && (
          <>
            <Pill color={C.white} bg={C.adminDark} style={{ fontSize: 11 }}>Admin</Pill>
            <Btn variant="secondary" onClick={() => navigate("/admin")} style={{ marginLeft: 8, padding: "6px 14px", fontSize: 12 }}>
              Admin panel
            </Btn>
            <Btn variant="danger" onClick={handleSignOut}>Sign out</Btn>
          </>
        )}
      </div>
    </nav>
  );
}

function NavLink({ children, onClick, active = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 13,
        background: active ? C.emeraldLight : "transparent",
        color: active ? C.emerald : C.inkSoft,
        fontWeight: active ? 600 : 400,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
