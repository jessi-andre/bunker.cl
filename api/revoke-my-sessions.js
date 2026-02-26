const {
  getSupabaseAdmin,
  setSecurityHeaders,
  validateRequestOrigin,
  requireJsonBody,
  requireCsrf,
  requireAuth,
  requireTenant,
  json,
  writeAuditLog,
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

  try {
    const authInfo = await requireAuth(req, res, { route: "/api/revoke-my-sessions" });
    if (!authInfo) return;

    const company = await requireTenant(req, res, authInfo, { route: "/api/revoke-my-sessions" });
    if (!company) return;

    const supabase = getSupabaseAdmin();
    const revokedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("company_admins")
      .update({ sessions_revoked_at: revokedAt })
      .eq("id", authInfo.session.admin_id)
      .eq("company_id", company.id);

    if (updateError) {
      return json(res, 500, { error: updateError.message, request_id: authInfo.requestId });
    }

    const { error: deleteError } = await supabase
      .from("admin_sessions")
      .delete()
      .eq("admin_id", authInfo.session.admin_id)
      .eq("company_id", company.id)
      .neq("id", authInfo.session.id);

    if (deleteError) {
      return json(res, 500, { error: deleteError.message, request_id: authInfo.requestId });
    }

    await writeAuditLog({
      request_id: authInfo.requestId,
      route: "/api/revoke-my-sessions",
      company_id: company.id,
      admin_id: authInfo.session.admin_id,
      action: "revoke_my_sessions",
      result: "ok",
    });

    return json(res, 200, { ok: true, request_id: authInfo.requestId });
  } catch (error) {
    return json(res, 500, { error: error.message || "Revoke error" });
  }
};
