import { getAdminClient } from "./_supabaseAdmin.js";
import { sendEmail } from "./_email.js";

async function requireAdmin(req, admin) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  if (!data?.user) return null;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).single();
  return profile?.role === "admin" ? data.user : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const admin = getAdminClient();
  const caller = await requireAdmin(req, admin);
  if (!caller) return res.status(403).json({ error: "Admin only." });

  const { type, payload } = req.body;

  try {
    if (type === "draw_published") {
      const { month, recipients } = payload; // recipients: [{email,name,won,tier,amount}]
      for (const r of recipients) {
        if (r.won) {
          await sendEmail({
            to: r.email,
            subject: `🎉 You matched ${r.tier} in the ${month} draw!`,
            text: `Hi ${r.name}, great news — you matched the ${r.tier} tier in the ${month} draw and won £${r.amount}. Log in to your dashboard and upload proof of your scores to claim your prize.`,
          });
        } else {
          await sendEmail({
            to: r.email,
            subject: `${month} draw results are in`,
            text: `Hi ${r.name}, the ${month} draw has been published. No match this time — your numbers are already in for next month. Good luck!`,
          });
        }
      }
    } else if (type === "winner_status") {
      const { email, name, status, amount } = payload;
      await sendEmail({
        to: email,
        subject: status === "paid" ? "Your prize has been paid 🏆" : "Update on your prize claim",
        text:
          status === "paid"
            ? `Hi ${name}, your prize of £${amount} has been approved and paid out. Congratulations!`
            : `Hi ${name}, unfortunately we couldn't verify your prize claim. Please contact support if you think this is a mistake.`,
      });
    } else {
      return res.status(400).json({ error: "Unknown notification type." });
    }

    res.status(200).json({ sent: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send notification(s)." });
  }
}
