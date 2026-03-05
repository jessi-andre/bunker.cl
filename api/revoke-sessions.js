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

  if (!validateRequestOrigin(req, res)) return;
  if (!requireJsonBody(req, res)) return;

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!requireCsrf(req, res)) return;

  if (req?.query?.company_id || req?.body?.company_id) {
    return json(res, 400, { error: "company_id is not allowed" });
  }

  try {
    const requestId = createRequestId(req);
    const { company, company_id, admin_id, session } = await requireAuthAndTenant(req);
    const resolvedCompanyId = company_id || company?.id;
    const supabase = getSupabaseAdmin();
    const scope = String(req.body?.scope || "").toLowerCase();

    if (scope === "company") {
      // Revoca todas las sesiones de la company (menos la actual)
      await supabase
        .from("companies")
        .update({ sessions_revoked_at: new Date().toISOString() })
        .eq("id", resolvedCompanyId);

      const { error } = await supabase
        .from("admin_sessions")
        .delete()
        .eq("company_id", resolvedCompanyId)
        .neq("id", session.id);

      if (error) {
        return json(res, 500, { error: "Internal server error", request_id: requestId });
      }

      await writeAuditLog({
        request_id: requestId,
        route: "/api/revoke-sessions",
        company_id: resolvedCompanyId,
        admin_id,
        action: "revoke_company_sessions",
        result: "ok",
      });
    } else {
      // Revoca solo las sesiones del admin actual (menos la actual)
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
        route: "/api/revoke-sessions",
        company_id: resolvedCompanyId,
        admin_id,
        action: "revoke_my_sessions",
        result: "ok",
      });
    }

    return json(res, 200, { ok: true, request_id: requestId });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return json(res, status, { error: error?.message || "Revoke error" });
  }
};
