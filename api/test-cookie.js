const {
  validateRequestOrigin,
  requireAuth,
  requireTenant,
  getSupabaseAdmin,
  json,
  logEvent,
} = require("./_lib");

module.exports = async (req, res) => {
  if (!validateRequestOrigin(req, res, { enforceForAllMethods: true })) {
    return;
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const authInfo = await requireAuth(req, res, { route: "/api/test-cookie" });
    if (!authInfo) return;

    const company = await requireTenant(req, res, authInfo, { route: "/api/test-cookie" });
    if (!company) return;
    if (!company.id) return;

    const supabase = getSupabaseAdmin();
    const { data: companyRow, error: companyError } = await supabase
      .from("companies")
      .select("subscription_status")
      .eq("id", company.id)
      .maybeSingle();

    if (companyError) {
      throw new Error(companyError.message);
    }

    const subscriptionStatus = String(companyRow?.subscription_status || "").toLowerCase();
    if (!["active", "trialing"].includes(subscriptionStatus)) {
      return json(res, 402, {
        error: "subscription_inactive",
        status: companyRow?.subscription_status ?? null,
      });
    }

    json(res, 200, {
      admin_id: authInfo.session.admin_id,
      company_id: authInfo.session.company_id,
      request_id: authInfo.requestId,
    });

    logEvent({
      request_id: authInfo.requestId,
      route: "/api/test-cookie",
      company_id: authInfo.session.company_id,
      admin_id: authInfo.session.admin_id,
      result: "ok",
    });

    return;
  } catch (error) {
    return json(res, 500, { error: error.message || "Session check error" });
  }
};
