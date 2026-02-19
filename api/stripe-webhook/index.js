const {
  getRequiredEnv,
  getStripe,
  getSupabaseAdmin,
  normalizePlanFromPriceId,
} = require("../_lib");

const { buffer } = require("micro");

const upsertAlumno = async (payload, onConflict = "email") => {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("alumnos")
    .upsert(payload, { onConflict });

  if (error) throw new Error(error.message);
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = getStripe();
  const webhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");

  let event;

  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).send("Webhook Error: Missing stripe-signature header");
    }

    // ✅ RAW BODY real (CRÍTICO para que constructEvent valide firma)
    const rawBody = await buffer(req);

    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const company_id = session.metadata?.company_id;

        if (!company_id) {
          return res.status(200).json({ received: true });
        }

        const email =
          session.customer_details?.email ||
          session.customer_email;

        if (email) {
          await upsertAlumno({
            company_id,
            email: String(email).toLowerCase(),
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            status: "active",
            plan: session.metadata?.plan || session.metadata?.planId || null,
          }, "company_id,email");
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        const priceId = subscription.items?.data?.[0]?.price?.id;
        const customerId = subscription.customer;
        const status = subscription.status;

        const supabase = getSupabaseAdmin();
        const { data: alumno, error } = await supabase
          .from("alumnos")
          .select("email")
          .eq("stripeCustomerId", customerId)
          .maybeSingle();

        if (error) throw new Error(error.message);

        if (alumno?.email) {
          await upsertAlumno({
            email: alumno.email,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            status,
            plan: normalizePlanFromPriceId(priceId),
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;

        const customerId = invoice.customer;

        const supabase = getSupabaseAdmin();
        const { data: alumno, error } = await supabase
          .from("alumnos")
          .select("email")
          .eq("stripeCustomerId", customerId)
          .maybeSingle();

        if (error) throw new Error(error.message);

        if (alumno?.email) {
          await upsertAlumno({
            email: alumno.email,
            status: "past_due",
          });
        }
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    return res
      .status(500)
      .json({ error: error.message || "Webhook processing error" });
  }
};
