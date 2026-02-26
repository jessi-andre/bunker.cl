const {
  setSecurityHeaders,
  validateRequestOrigin,
  requireAuth,
  requireTenant,
  logEvent,
} = require("./_lib");

module.exports = async (req, res) => {
  setSecurityHeaders(res);

  if (!validateRequestOrigin(req, res, { enforceForAllMethods: true })) {
    return;
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    const authInfo = await requireAuth(req, res, { route: "/api/test-cookie" });
    if (!authInfo) return;

    const company = await requireTenant(req, res, authInfo, { route: "/api/test-cookie" });
    if (!company) return;

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        admin_id: authInfo.session.admin_id,
        company_id: authInfo.session.company_id,
        request_id: authInfo.requestId,
      })
    );

    logEvent({
      request_id: authInfo.requestId,
      route: "/api/test-cookie",
      company_id: authInfo.session.company_id,
      admin_id: authInfo.session.admin_id,
      result: "ok",
    });

    return;
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: error.message || "Session check error" }));
  }
};
