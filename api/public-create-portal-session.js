const {
  getStripe,
  getSupabaseAdmin,
  getCompanyByReqHost,
  validateRequestOrigin,
  requireJsonBody,
  json,
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
    const { email } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return json(res, 400, { error: "Missing email" });
    }

    const company = await getCompanyByReqHost(req);
    if (!company?.id) {
      return json(res, 404, { error: "company not found for host" });
    }

    const stripe = getStripe();
    const customers = await stripe.customers.list({
      email: normalizedEmail,
      limit: 1,
    });

    const customer = customers?.data?.[0] || null;
    if (!customer?.id) {
      return json(res, 404, { error: "customer not found" });
    }

    // Verificar que el customer pertenece a esta company
    const { data: companyCheck } = await getSupabaseAdmin()
      .from("companies")
      .select("id")
      .eq("id", company.id)
      .eq("stripe_customer_id", customer.id)
      .maybeSingle();

    if (!companyCheck?.id) {
      return json(res, 404, { error: "customer not found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `https://${req.headers.host}/portal.html`,
    });

    return json(res, 200, { url: session.url });
  } catch (error) {
    return json(res, 500, { error: error?.message || "Server error" });
  }
};
