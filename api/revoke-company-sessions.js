const {
  getSupabaseAdmin,
  setSecurityHeaders,
  validateRequestOrigin,
  requireJsonBody,
  requireCsrf,
  requireAuthAndTenant,
  json,
} = require("../lib/_lib");

module.exports = async (req, res) => {
  setSecurityHeaders(res);

  if (!validateRequestOrigin(req, res)) {
    return;
  }

  if (!requireJsonBody(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!requireCsrf(req, res)) {
    return;
  }

  if (req?.query?.company_id || req?.body?.company_id) {
    return json(res, 400, { error: "company_id is not allowed" });
  }

  try {
    const { company, company_id, admin_id, session } = await requireAuthAndTenant(req);
    const resolvedCompanyId = company_id || company?.id;
    const supabase = getSupabaseAdmin();

    // Set revocation timestamp on the company so future token checks also catch pre-existing sessions
    await supabase
      .from("companies")
      .update({ sessions_revoked_at: new Date().toISOString() })
      .eq("id", resolvedCompanyId);

    // Delete all sessions for the company except the current one so the requesting admin stays logged in
    const { error } = await supabase
      .from("admin_sessions")
      .delete()
      .eq("company_id", resolvedCompanyId)
      .neq("id", session.id);

    if (error) {
      return json(res, 500, { error: "Internal server error" });
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return json(res, status, { error: error?.message || "Revoke error" });
  }
};
