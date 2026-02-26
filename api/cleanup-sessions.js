const {
  getSupabaseAdmin,
  setSecurityHeaders,
  validateRequestOrigin,
  requireJsonBody,
  json,
  createRequestId,
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

  const requestId = createRequestId(req);
  const expectedSecret = process.env.SESSION_CLEANUP_SECRET;
  const providedSecret = req.headers["x-cleanup-secret"];

  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return json(res, 401, { error: "Unauthorized", request_id: requestId });
  }

  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { count, error } = await supabase
      .from("admin_sessions")
      .delete({ count: "exact" })
      .lte("expires_at", nowIso);

    if (error) {
      return json(res, 500, { error: error.message, request_id: requestId });
    }

    await writeAuditLog({
      request_id: requestId,
      route: "/api/cleanup-sessions",
      action: "cleanup_sessions",
      result: "ok",
      metadata: { deleted: count || 0 },
    });

    return json(res, 200, { ok: true, deleted: count || 0, request_id: requestId });
  } catch (error) {
    return json(res, 500, { error: error.message || "Cleanup error", request_id: requestId });
  }
};
