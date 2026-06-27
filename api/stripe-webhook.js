import Stripe from "stripe";
import { getAdminClient } from "./_supabaseAdmin.js";
import { sendEmail } from "./_email.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe needs the raw, unparsed request body to verify the signature.
export const config = { api: { bodyParser: false } };

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const admin = getAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const supabaseId = session.metadata?.supabase_id;
        if (!supabaseId) break;

        const update = {
          plan: session.metadata.plan,
          subscription_status: "active",
          stripe_subscription_id: session.subscription,
        };
        if (session.metadata.charity_id) update.charity_id = session.metadata.charity_id;
        if (session.metadata.charity_pct) update.charity_pct = Number(session.metadata.charity_pct);

        await admin.from("profiles").update(update).eq("id", supabaseId);

        const { data: profile } = await admin.from("profiles").select("email,name,notif_renewal").eq("id", supabaseId).single();
        if (profile?.notif_renewal) {
          await sendEmail({
            to: profile.email,
            subject: "Welcome to BirdieGives 🏌️",
            text: `Hi ${profile.name}, your subscription is now active. Good luck in this month's draw!`,
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const supabaseId = sub.metadata?.supabase_id;
        if (!supabaseId) break;
        await admin
          .from("profiles")
          .update({
            subscription_status: "active",
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq("id", supabaseId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const supabaseId = sub.metadata?.supabase_id;
        if (supabaseId) {
          await admin.from("profiles").update({ subscription_status: "lapsed" }).eq("id", supabaseId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const supabaseId = sub.metadata?.supabase_id;
        if (supabaseId) {
          await admin.from("profiles").update({ subscription_status: "cancelled" }).eq("id", supabaseId);
        }
        break;
      }

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: "Webhook handler failed." });
  }
}
