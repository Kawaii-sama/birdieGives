export const fmt = (n) =>
  Number(n || 0).toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 });

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const today = () => new Date().toISOString().split("T")[0];

export const scoreColor = (s) => {
  if (s >= 36) return "#15803d";
  if (s >= 28) return "#0F6E56";
  if (s >= 20) return "#BA7517";
  return "#D85A30";
};

export const monthLabel = (ym) => {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};
