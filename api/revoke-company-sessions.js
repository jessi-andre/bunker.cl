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

const isMissingRoleColumn = (message = "") =>
  /column .*role.* does not exist/i.test(String(message));

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
    const authInfo = await requireAuth(req, res, { route: "/api/revoke-company-sessions" });
    if (!authInfo) return;

    const company = await requireTenant(req, res, authInfo, { route: "/api/revoke-company-sessions" });
    if (!company) return;

    const supabase = getSupabaseAdmin();

    let role = null;
    let roleSupported = true;

    const roleResult = await supabase
      .from("company_admins")
      .select("role")
      .eq("id", authInfo.session.admin_id)
      .eq("company_id", company.id)
      .maybeSingle();

    if (roleResult.error) {
      if (isMissingRoleColumn(roleResult.error.message)) {
        roleSupported = false;
      } else {
        return json(res, 500, {
          error: roleResult.error.message,
          request_id: authInfo.requestId,
        });
      }
    } else {
      role = String(roleResult.data?.role || "").toLowerCase();
    }

    if (roleSupported && role !== "owner" && role !== "superadmin") {
      await writeAuditLog({
        request_id: authInfo.requestId,
        route: "/api/revoke-company-sessions",
        company_id: company.id,
        admin_id: authInfo.session.admin_id,
        action: "revoke_company_sessions",
        result: "reject",
        error_code: "INSUFFICIENT_ROLE",
        metadata: { role },
      });
      return json(res, 403, { error: "Forbidden", request_id: authInfo.requestId });
    }

    const revokedAt = new Date().toISOString();

    const { error: companyUpdateError } = await supabase
      .from("companies")
      .update({ sessions_revoked_at: revokedAt })
      .eq("id", company.id);

    if (companyUpdateError) {
      return json(res, 500, {
        error: companyUpdateError.message,
        request_id: authInfo.requestId,
      });
    }

    const { error: deleteError } = await supabase
      .from("admin_sessions")
      .delete()
      .eq("company_id", company.id)
      .neq("id", authInfo.session.id);

    if (deleteError) {
      return json(res, 500, { error: deleteError.message, request_id: authInfo.requestId });
    }

    await writeAuditLog({
      request_id: authInfo.requestId,
      route: "/api/revoke-company-sessions",
      company_id: company.id,
      admin_id: authInfo.session.admin_id,
      action: "revoke_company_sessions",
      result: "ok",
    });

    return json(res, 200, { ok: true, request_id: authInfo.requestId });
  } catch (error) {
    return json(res, 500, { error: error.message || "Revoke error" });
  }
};
