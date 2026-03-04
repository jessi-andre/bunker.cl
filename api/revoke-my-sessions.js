const {
  getSupabaseAdmin,
  setSecurityHeaders,
  validateRequestOrigin,
  requireJsonBody,
  requireCsrf,
  requireAuthAndTenant,
  createRequestId,
  json,
  writeAuditLog,
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

  try {
    const requestId = createRequestId(req);
    const { company, company_id, admin_id, session } = await requireAuthAndTenant(req);
    const resolvedCompanyId = company_id || company?.id;

    const supabase = getSupabaseAdmin();
    const revokedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("company_admins")
      .update({ sessions_revoked_at: revokedAt })
      .eq("id", admin_id)
      .eq("company_id", resolvedCompanyId);

    if (updateError) {
      return json(res, 500, { error: updateError.message, request_id: requestId });
    }

    const { error: deleteError } = await supabase
      .from("admin_sessions")
      .delete()
      .eq("admin_id", admin_id)
      .eq("company_id", resolvedCompanyId)
      .neq("id", session.id);

    if (deleteError) {
      return json(res, 500, { error: deleteError.message, request_id: requestId });
    }

    await writeAuditLog({
      request_id: requestId,
      route: "/api/revoke-my-sessions",
      company_id: resolvedCompanyId,
      admin_id,
      action: "revoke_my_sessions",
      result: "ok",
    });

    return json(res, 200, { ok: true, request_id: requestId });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return json(res, status, { error: error?.message || "Revoke error" });
  }
};
