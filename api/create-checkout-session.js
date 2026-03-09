const {
  getStripe,
  requireAuthAndTenant,
  getSupabaseAdmin,
  getBaseUrl,
  normalizeHost,
  validateRequestOrigin,
  requireJsonBody,
  json,
  createRequestId,
  logEvent,
} = require("../lib/_lib");

module.exports = async (req, res) => {
  if (!validateRequestOrigin(req, res)) {
    return;
  }

  if (!requireJsonBody(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const requestId = createRequestId(req);
    const { company, session } = await requireAuthAndTenant(req);
    const supabase = getSupabaseAdmin();

    const stripe = getStripe();
    const { plan, planId, customer_email, email, admin_name } = req.body || {};
    const requestedPlan = String(plan || planId || "").toLowerCase().trim();
    if (!requestedPlan) {
      return json(res, 400, { error: "Missing plan", request_id: requestId });
    }

    if (req?.query?.company_id || req?.body?.company_id) {
      return json(res, 400, { error: "company_id is not allowed", request_id: requestId });
    }

    if (req?.query?.customer_id || req?.body?.customer_id) {
      return json(res, 400, { error: "customer_id is not allowed", request_id: requestId });
    }

    if (req?.query?.price_id || req?.body?.price_id || req?.body?.priceId) {
      return json(res, 400, { error: "price_id is not allowed", request_id: requestId });
    }

    if (!process.env.STRIPE_PRICE_ID_STARTER || !process.env.STRIPE_PRICE_ID_PRO || !process.env.STRIPE_PRICE_ID_ELITE) {
      return json(res, 500, {
        error: "Missing STRIPE_PRICE_ID_* env vars",
        request_id: requestId,
      });
    }

    const priceByPlan = {
      starter: process.env.STRIPE_PRICE_ID_STARTER,
      pro: process.env.STRIPE_PRICE_ID_PRO,
      elite: process.env.STRIPE_PRICE_ID_ELITE,
    };

    const price = priceByPlan[requestedPlan];
    if (!price) {
      return json(res, 400, { error: `Unknown plan: ${requestedPlan}`, request_id: requestId });
    }

    const normalizedPlan = requestedPlan;
    const normalizedEmail = String(customer_email || email || "").trim().toLowerCase();
    const normalizedAdminName = String(admin_name || "").trim().slice(0, 120);
    const baseUrl = getBaseUrl();
    const companyDomain = normalizeHost(company?.domain || req?.headers?.host || "");
    const companyName = String(company?.name || "").trim();

    const { data: subData, error: subError } = await supabase
      .from("company_subscriptions")
      .select("stripe_customer_id")
      .eq("company_id", company.id)
      .maybeSingle();

    if (subError) {
      return json(res, 500, { error: "Database query failed", request_id: requestId });
    }

    const { data: adminRow, error: adminError } = await supabase
      .from("company_admins")
      .select("email")
      .eq("id", session.admin_id)
      .eq("company_id", company.id)
      .maybeSingle();

    if (adminError) {
      return json(res, 500, { error: "Database query failed", request_id: requestId });
    }

    const adminEmail = String(normalizedEmail || adminRow?.email || "").trim().toLowerCase();
    const stripeCustomerId = String(subData?.stripe_customer_id || "").trim();
    const onboardingMeta = {
      company_id: String(company.id),
      company_domain: companyDomain || null,
      company_name: companyName || null,
      plan: normalizedPlan,
      email: normalizedEmail || null,
      admin_email: adminEmail || null,
      admin_name: normalizedAdminName || null,
      admin_id: String(session.admin_id),
      source: "admin_checkout",
    };

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${baseUrl}/gracias.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/index.html#planes`,
      customer: stripeCustomerId || undefined,
      customer_email: stripeCustomerId ? undefined : (normalizedEmail || undefined),
      subscription_data: {
        metadata: onboardingMeta,
      },
      metadata: {
        ...onboardingMeta,
        planId: normalizedPlan,
      },
    });

    logEvent({
      request_id: requestId,
      route: "/api/create-checkout-session",
      company_id: company.id,
      result: "ok",
    });

    return json(res, 200, { url: checkoutSession.url, request_id: requestId });
  } catch (err) {
    const status = Number(err?.status) || 500;
    return json(res, status, { error: err.message || "Server error" });
  }
};
