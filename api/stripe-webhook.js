const { json, getStripe, getSupabaseAdmin } = require("../lib/_lib");

const readRawBody = (req) =>
  new Promise((resolve, reject) => {
    if (Buffer.isBuffer(req.body)) {
      return resolve(req.body);
    }

    if (typeof req.body === "string") {
      return resolve(Buffer.from(req.body));
    }

    if (req.rawBody) {
      return resolve(Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody));
    }

    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", (err) => {
      reject(err);
    });
  });

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.id) return String(value.id);
  return String(value);
};

const getCompanyByCustomerId = async (supabase, customerId) => {
  if (!customerId) return null;

  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Failed to fetch company");
  return data || null;
};

const updateCompany = async (supabase, companyId, patch) => {
  const { error } = await supabase.from("companies").update(patch).eq("id", companyId);
  if (error) throw new Error(error.message || "Failed to update company");
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return json(res, 400, { error: "Missing stripe-signature header" });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    return json(res, 400, { error: err?.message || "Invalid payload" });
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return json(res, 400, { error: err?.message || "Invalid signature" });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Idempotency: skip already-processed events (Stripe can retry)
    const { data: existing } = await supabase
      .from("stripe_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existing) {
      return json(res, 200, { received: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerId = normalizeId(session.customer);
      const subscriptionId = normalizeId(session.subscription);

      const company = await getCompanyByCustomerId(supabase, customerId);
      if (!company?.id) {
        console.warn("stripe-webhook: company not found for customer", {
          event_type: event.type,
          customer_id: customerId,
        });
        return json(res, 200, { received: true });
      }

      const status = session.subscription_status
        ? String(session.subscription_status).toLowerCase()
        : "active";

      const patch = {
        stripe_customer_id: customerId,
        subscription_status: status,
      };

      if (subscriptionId) {
        patch.stripe_subscription_id = subscriptionId;
      }

      await updateCompany(supabase, company.id, patch);
      return json(res, 200, { received: true });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object;
      const customerId = normalizeId(subscription.customer);

      const company = await getCompanyByCustomerId(supabase, customerId);
      if (!company?.id) {
        console.warn("stripe-webhook: company not found for customer", {
          event_type: event.type,
          customer_id: customerId,
        });
        return json(res, 200, { received: true });
      }

      const patch = {
        subscription_status: subscription.status ? String(subscription.status).toLowerCase() : null,
        stripe_subscription_id: normalizeId(subscription.id),
      };

      if (Number.isFinite(subscription.current_period_end)) {
        patch.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
      }

      await updateCompany(supabase, company.id, patch);
      return json(res, 200, { received: true });
    }

    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const customerId = normalizeId(invoice.customer);

      const company = await getCompanyByCustomerId(supabase, customerId);
      if (!company?.id) {
        console.warn("stripe-webhook: company not found for customer", {
          event_type: event.type,
          customer_id: customerId,
        });
        return json(res, 200, { received: true });
      }

      await updateCompany(supabase, company.id, {
        subscription_status: event.type === "invoice.payment_succeeded" ? "active" : "past_due",
      });

      return json(res, 200, { received: true });
    }

    // Mark event as processed
    await supabase.from("stripe_events").insert({
      event_id: event.id,
      event_type: event.type,
    }).then(() => {});

    return json(res, 200, { received: true });
  } catch (err) {
    return json(res, 500, { error: err?.message || "Webhook processing error" });
  }
};
