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

/**
 * Resolve a Supabase profile row from a Stripe event.
 * Tries metadata.supabase_id first (fastest), then falls back to
 * stripe_customer_id, then email — so it works even if metadata was
 * missing from an earlier checkout.
 */
async function findProfile(admin, { supabaseId, customerId, email }) {
  if (supabaseId) {
    const { data } = await admin.from("profiles").select("*").eq("id", supabaseId).single();
    if (data) return data;
  }
  if (customerId) {
    const { data } = await admin.from("profiles").select("*").eq("stripe_customer_id", customerId).single();
    if (data) return data;
  }
  if (email) {
    const { data } = await admin.from("profiles").select("*").eq("email", email).single();
    if (data) return data;
  }
  return null;
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

        // Resolve customer email from Stripe if not on the session directly
        let customerEmail = session.customer_details?.email || session.customer_email;
        if (!customerEmail && session.customer) {
          const customer = await stripe.customers.retrieve(session.customer);
          customerEmail = customer.email;
        }

        const profile = await findProfile(admin, {
          supabaseId:  session.metadata?.supabase_id,
          customerId:  session.customer,
          email:       customerEmail,
        });

        if (!profile) {
          console.error("checkout.session.completed: no profile found", { customerEmail });
          break;
        }

        // Retrieve subscription to get period end
        let periodEnd = null;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }

        const update = {
          subscription_status:    "active",
          plan:                   session.metadata?.plan || "monthly",
          stripe_customer_id:     session.customer,
          stripe_subscription_id: session.subscription,
          current_period_end:     periodEnd,
        };
        if (session.metadata?.charity_id)  update.charity_id  = session.metadata.charity_id;
        if (session.metadata?.charity_pct) update.charity_pct = Number(session.metadata.charity_pct);

        await admin.from("profiles").update(update).eq("id", profile.id);
        console.log("✅ Activated subscription for", profile.email);

        if (profile.notif_renewal) {
          await sendEmail({
            to:      profile.email,
            subject: "Welcome to BirdieGives 🏌️",
            text:    `Hi ${profile.name}, your subscription is now active. Good luck in this month's draw!`,
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "invoice.payment_succeeded": {
        const obj = event.data.object;
        // For subscription events the object IS the subscription;
        // for invoice events we need to fetch it.
        const sub = obj.object === "subscription"
          ? obj
          : await stripe.subscriptions.retrieve(obj.subscription);

        const profile = await findProfile(admin, {
          supabaseId: sub.metadata?.supabase_id,
          customerId: sub.customer,
        });
        if (!profile) break;

        await admin.from("profiles").update({
          subscription_status: sub.status === "active" ? "active" : "lapsed",
          current_period_end:  new Date(sub.current_period_end * 1000).toISOString(),
          stripe_customer_id:  sub.customer,
        }).eq("id", profile.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const profile = await findProfile(admin, {
          customerId: invoice.customer,
        });
        if (profile) {
          await admin.from("profiles").update({ subscription_status: "lapsed" }).eq("id", profile.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const profile = await findProfile(admin, {
          supabaseId: sub.metadata?.supabase_id,
          customerId: sub.customer,
        });
        if (profile) {
          await admin.from("profiles").update({ subscription_status: "cancelled" }).eq("id", profile.id);
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
