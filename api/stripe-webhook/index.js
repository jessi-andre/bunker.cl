const {
  getRequiredEnv,
  getStripe,
  getSupabaseAdmin,
  normalizePlanFromPriceId,
  setSecurityHeaders,
  logEvent,
} = require("../_lib");

const { buffer } = require("micro");

const upsertAlumno = async (payload, onConflict = "email,company_id") => {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("alumnos")
    .upsert(payload, { onConflict });

  if (error) throw new Error(error.message);
};

const upsertCompanySubscription = async (payload) => {
  const supabase = getSupabaseAdmin();
  const row = {
    ...payload,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("company_subscriptions")
    .upsert(row, { onConflict: "company_id" });

  if (error) throw new Error(error.message);
};

const getCompanyIdFromMetadata = (object) =>
  object?.metadata?.company_id || object?.metadata?.companyId || null;

const resolveCompanyIdForEventObject = async (stripe, object) => {
  const metadataCompanyId = getCompanyIdFromMetadata(object);
  if (metadataCompanyId) return String(metadataCompanyId);

  const customerId = object?.customer;
  if (customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer?.deleted) {
      const customerCompanyId = getCompanyIdFromMetadata(customer);
      if (customerCompanyId) return String(customerCompanyId);
    }
  }

  const subscriptionId = object?.subscription || object?.id;
  if (subscriptionId && (object?.object === "invoice" || object?.object === "subscription")) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionCompanyId = getCompanyIdFromMetadata(subscription);
    if (subscriptionCompanyId) return String(subscriptionCompanyId);
  }

  return null;
};

const getAlumnoByCustomerAndCompany = async (customerId, company_id) => {
  if (!customerId || !company_id) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("alumnos")
    .select("email, company_id")
    .eq("stripeCustomerId", customerId)
    .eq("company_id", company_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
};

module.exports = async (req, res) => {
  setSecurityHeaders(res);

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
        const company_id = await resolveCompanyIdForEventObject(stripe, session);

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
          }, "email,company_id");
        }

        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await upsertCompanySubscription({
            company_id,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            status: subscription.status,
            price_id: subscription.items?.data?.[0]?.price?.id || null,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
          });
        }

        logEvent({ route: "/api/stripe-webhook", result: "ok", event_type: event.type, company_id });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const company_id = await resolveCompanyIdForEventObject(stripe, subscription);

        if (!company_id) {
          return res.status(200).json({ received: true });
        }

        const priceId = subscription.items?.data?.[0]?.price?.id;
        const customerId = subscription.customer;
        const status = subscription.status;

        const alumno = await getAlumnoByCustomerAndCompany(customerId, company_id);

        if (alumno?.email) {
          await upsertAlumno({
            company_id,
            email: alumno.email,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            status,
            plan: normalizePlanFromPriceId(priceId),
          });
        }

        await upsertCompanySubscription({
          company_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status,
          price_id: priceId || null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
        });

        logEvent({ route: "/api/stripe-webhook", result: "ok", event_type: event.type, company_id });
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
