const {
  json,
  getStripe,
  requireAuthAndTenant,
  getSupabaseAdmin,
  getBaseUrl,
  createRequestId,
  logEvent,
} = require("../lib/_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const requestId = createRequestId(req);
    const { company, company_id, admin_id } = await requireAuthAndTenant(req);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("company_subscriptions")
      .select("stripe_customer_id")
      .eq("company_id", company_id)
      .maybeSingle();

    if (error) {
      return json(res, 500, { error: error.message || "Database query failed" });
    }

    const stripeCustomerId = String(data?.stripe_customer_id || "").trim();
    if (!stripeCustomerId) {
      return json(res, 409, { error: "NO_STRIPE_CUSTOMER" });
    }

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${getBaseUrl()}/index.html#planes`,
    });

    logEvent({
      request_id: requestId,
      route: "/api/create-portal-session",
      company_id: company_id || company?.id,
      result: "ok",
    });

    return json(res, 200, { url: portalSession.url });
  } catch (err) {
    const status = Number(err?.status) || 500;
    return json(res, status, { error: err?.message || "Internal server error" });
  }
};
