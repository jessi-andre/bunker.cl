const {
  validateRequestOrigin,
  requireAuthAndTenant,
  getSupabaseAdmin,
  json,
} = require("./_lib");

module.exports = async (req, res) => {
  if (!validateRequestOrigin(req, res, { enforceForAllMethods: true })) {
    return;
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (req?.query?.company_id || req?.body?.company_id) {
    return json(res, 400, { error: "company_id is not allowed" });
  }

  try {
    const { company, session } = await requireAuthAndTenant(req);

    const supabase = getSupabaseAdmin();
    const { data: companyRow, error: companyError } = await supabase
      .from("companies")
      .select("subscription_status")
      .eq("id", company.id)
      .maybeSingle();

    if (companyError) {
      return json(res, 500, { error: "Subscription check error" });
    }

    const subscriptionStatus = String(companyRow?.subscription_status || "").toLowerCase();
    if (!["active", "trialing"].includes(subscriptionStatus)) {
      return json(res, 402, {
        error: "subscription_inactive",
        status: companyRow?.subscription_status ?? null,
      });
    }

    return json(res, 200, {
      ok: true,
      company_id: company.id,
      admin_id: session.admin_id,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return json(res, status, { error: error?.message || "Auth check error" });
  }
};
