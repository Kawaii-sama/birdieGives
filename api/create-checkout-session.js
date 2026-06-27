import Stripe from "stripe";
import { getAdminClient } from "./_supabaseAdmin.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  yearly: process.env.STRIPE_PRICE_YEARLY,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { plan, charityId, charityPct } = req.body;
    if (!["monthly", "yearly"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan." });
    }

    // Identify the caller from their Supabase access token (sent as Bearer)
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated." });

    const admin = getAdminClient();
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: "Invalid session." });

    const user = userData.user;
    const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { supabase_id: user.id } });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${process.env.PUBLIC_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.PUBLIC_URL}/subscribe?checkout=cancelled`,
      metadata: {
        supabase_id: user.id,
        plan,
        charity_id: charityId || "",
        charity_pct: String(charityPct || 10),
      },
      subscription_data: {
        metadata: { supabase_id: user.id, plan },
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not start checkout." });
  }
}
