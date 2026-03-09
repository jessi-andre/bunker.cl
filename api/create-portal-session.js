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
    const { company, company_id, admin_id } = await requireAuthAndTenant(req, {
      allowInactiveSubscription: true,
    });
    const providedEmail = String(req?.body?.email || "").trim().toLowerCase();
    if (!providedEmail) {
      return json(res, 400, { error: "MISSING_EMAIL" });
    }

    const supabase = getSupabaseAdmin();
    const { data: adminRow, error: adminError } = await supabase
      .from("company_admins")
      .select("email")
      .eq("id", admin_id)
      .eq("company_id", company_id)
      .maybeSingle();

    if (adminError) {
      return json(res, 500, { error: adminError.message || "Database query failed" });
    }

    const expectedEmail = String(adminRow?.email || "").trim().toLowerCase();
    if (!expectedEmail) {
      return json(res, 403, { error: "EMAIL_NOT_ALLOWED" });
    }

    if (providedEmail !== expectedEmail) {
      return json(res, 403, { error: "EMAIL_MISMATCH" });
    }

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
