const {
  getSupabaseAdmin,
  setSecurityHeaders,
  validateRequestOrigin,
  requireJsonBody,
  requireCsrf,
  requireAuthAndTenant,
  json,
} = require("./_lib");

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
    const { company, session } = await requireAuthAndTenant(req);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("admin_sessions")
      .delete()
      .eq("company_id", company.id);

    if (error) {
      return json(res, 500, { error: error.message || "Revoke error" });
    }

    console.log("company_sessions_revoked", {
      company_id: company.id,
      admin_id: session.admin_id,
    });

    return json(res, 200, { ok: true });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return json(res, status, { error: error?.message || "Revoke error" });
  }
};
