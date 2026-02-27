const {
  getSupabaseAdmin,
  parseCookies,
  sha256Hex,
  cookieSerialize,
  setSecurityHeaders,
  validateRequestOrigin,
  requireCsrf,
  logEvent,
  createRequestId,
} = require("./_lib");

module.exports = async (req, res) => {
  setSecurityHeaders(res);

  if (!validateRequestOrigin(req, res, { enforceForAllMethods: true })) {
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    if (!requireCsrf(req, res)) {
      return;
    }

    const requestId = createRequestId(req);
    const cookies = parseCookies(req);
    const token = cookies.bunker_session;

    if (token) {
      const tokenHash = sha256Hex(token);
      const supabase = getSupabaseAdmin();

      const { error } = await supabase
        .from("admin_sessions")
        .delete({ count: "exact" })
        .eq("token_hash", tokenHash);
      if (error) {
        throw new Error(error.message || "Failed to delete session");
      }
    }

    const isHttps =
      String(req.headers["x-forwarded-proto"] || "").includes("https") ||
      process.env.NODE_ENV === "production";

    const sessionCookie = cookieSerialize("bunker_session", "", {
      httpOnly: true,
      secure: isHttps,
      sameSite: "Lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    res.setHeader("Set-Cookie", [sessionCookie]);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, request_id: requestId }));

    logEvent({
      request_id: requestId,
      route: "/api/logout",
      result: "ok",
    });

    return;
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: error.message || "Logout error" }));
  }
};
