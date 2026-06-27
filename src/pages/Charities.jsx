import { useEffect, useMemo, useState } from "react";
import { C } from "../lib/tokens.js";
import { Card, Pill, PageLoader } from "../components/Atoms.jsx";
import { fmt } from "../lib/clientUtils.js";
import { supabase } from "../lib/supabaseClient.js";

export function Charities() {
  const [charities, setCharities] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    supabase
      .from("charities")
      .select("*")
      .order("raised", { ascending: false })
      .then(({ data }) => setCharities(data || []));
  }, []);

  const categories = useMemo(() => {
    if (!charities) return ["All"];
    return ["All", ...new Set(charities.map((c) => c.category).filter(Boolean))];
  }, [charities]);

  const filtered = useMemo(() => {
    if (!charities) return [];
    return charities.filter((c) => {
      const matchesQuery = !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.description.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "All" || c.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [charities, query, category]);

  return (
    <div className="fade-in" style={{ maxWidth: 1000, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 8 }}>Charity directory</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>Every BirdieGives subscriber directs at least 10% of their plan to a cause of their choice.</p>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search charities…"
          style={{ flex: 1, minWidth: 220 }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 160 }}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {!charities ? (
        <PageLoader label="Loading charities…" />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: C.muted, padding: "3rem 0" }}>No charities match your search.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1rem" }}>
          {filtered.map((c) => (
            <Card key={c.id}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 30 }}>{c.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                  <Pill color={C.muted} bg={C.surface} style={{ fontSize: 10, marginTop: 3 }}>{c.category}</Pill>
                </div>
              </div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>{c.description}</p>
              {Array.isArray(c.events) && c.events.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.emerald, marginBottom: 5 }}>Upcoming events</div>
                  {c.events.map((e) => (
                    <div key={e} style={{ fontSize: 12, color: C.muted, padding: "3px 0" }}>📅 {e}</div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 600, color: C.emerald }}>{fmt(c.raised)} raised to date</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
