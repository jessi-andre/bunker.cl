const {
  json,
  getStripe,
  requireAuthAndTenant,
  getSupabaseAdmin,
  getBaseUrl,
} = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const { company, session } = await requireAuthAndTenant(req);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("company_subscriptions")
      .select("stripe_customer_id")
      .eq("company_id", company.id)
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

    console.log("portal_session_created", {
      company_id: company.id,
      admin_id: session.admin_id,
    });

    return json(res, 200, { url: portalSession.url });
  } catch (err) {
    const status = Number(err?.status) || 500;
    return json(res, status, { error: err?.message || "Internal server error" });
  }
};
