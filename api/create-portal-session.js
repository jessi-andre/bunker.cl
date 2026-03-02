const {
  json,
  getStripe,
  getCompanyByReqHost,
  getSupabaseAdmin,
  getBaseUrl,
} = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const company = await getCompanyByReqHost(req);
    if (!company || !company.id) {
      return json(res, 404, { error: "Company not found for host" });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("companies")
      .select("subscription_status, stripe_customer_id")
      .eq("id", company.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Database query failed");
    }

    if (!data) {
      return json(res, 404, { error: "Company not found" });
    }

    const subscriptionStatus = String(data.subscription_status || "").toLowerCase();
    const isActive = subscriptionStatus === "active" || subscriptionStatus === "trialing";

    if (!isActive) {
      return json(res, 403, {
        code: "PLAN_INACTIVE",
        subscription_status: data.subscription_status || null,
      });
    }

    const stripeCustomerId = String(data.stripe_customer_id || "").trim();
    if (!stripeCustomerId) {
      return json(res, 409, { error: "Missing stripe_customer_id" });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${getBaseUrl()}/index.html#planes`,
    });

    return json(res, 200, { url: session.url });
  } catch (err) {
    return json(res, 500, { error: err?.message || "Internal server error" });
  }
};
