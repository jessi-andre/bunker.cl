const bcrypt = require("bcryptjs");
const {
  getSupabaseAdmin,
  getCompanyByReqHost,
  randomToken,
  sha256Hex,
  cookieSerialize,
  validateRequestOrigin,
  requireJsonBody,
  getClientIp,
  createRequestId,
  json,
  logEvent,
  writeAuditLog,
} = require("../lib/_lib");

const LOGIN_MAX_ATTEMPTS = 5;

module.exports = async (req, res) => {
  if (!validateRequestOrigin(req, res)) {
    return;
  }

  if (!requireJsonBody(req, res)) {
    return;
  }

  const requestId = createRequestId(req);

  const sendJson = (status, data) => {
    return json(res, status, { ...data, request_id: requestId });
  };

  if (req.method !== "POST") {
    return sendJson(405, { error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return sendJson(400, { error: "Missing email or password" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email))) {
      return sendJson(400, { error: "Invalid email format" });
    }

    const supabase = getSupabaseAdmin();
    const company = await getCompanyByReqHost(req);
if (!company?.id) {
      return sendJson(404, { error: "Company not found for host" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const host = String(req?.headers?.host || "");
    const ip = getClientIp(req);
    let cnt = 0;
    try {
      const windowStartIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count: failedAttempts, error: attemptsError } = await supabase
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("ip", ip)
        .gt("updated_at", windowStartIso);

      if (attemptsError) {
        throw attemptsError;
      }

      cnt = Number(failedAttempts || 0);
    } catch (rateLimitError) {
      console.error("rateLimit check error", {
        host,
        company_id: company.id,
        ip,
        error: rateLimitError?.message || String(rateLimitError),
      });
    }

    if (cnt >= LOGIN_MAX_ATTEMPTS) {
      return sendJson(429, { error: "Too many attempts" });
    }

    const { data: admin, error } = await supabase
      .from("company_admins")
      .select("id, email, password_hash, company_id")
      .eq("email", normalizedEmail)
      .eq("company_id", company.id)
      .maybeSingle();

    if (error) {
      return sendJson(500, { error: "Internal server error" });
    }

    if (!admin?.password_hash) {
      const { data: otherTenantAdmin, error: otherTenantError } = await supabase
        .from("company_admins")
        .select("id, company_id")
        .eq("email", normalizedEmail)
        .neq("company_id", company.id)
        .limit(1)
        .maybeSingle();

      if (otherTenantError) {
        return sendJson(500, { error: "Internal server error" });
      }

      try {
        await supabase.from("login_attempts").insert({
          company_id: company.id,
          ip,
          updated_at: new Date().toISOString(),
        });
      } catch (rateLimitInsertError) {
        console.error("rateLimit insert error", {
          host,
          company_id: company.id,
          ip,
          error: rateLimitInsertError?.message || String(rateLimitInsertError),
        });
      }
      await writeAuditLog({
        request_id: requestId,
        route: "/api/login",
        company_id: company.id,
        action: "login",
        result: "reject",
        error_code: "INVALID_CREDENTIALS",
        metadata: { ip },
      });

      if (otherTenantAdmin?.id) {
        return sendJson(401, { error: "Credenciales invalidas" });
      }

      return sendJson(401, { error: "Credenciales invalidas" });
    }

    const validPassword = await bcrypt.compare(String(password), admin.password_hash);
    if (!validPassword) {
      try {
        await supabase.from("login_attempts").insert({
          company_id: company.id,
          ip,
          updated_at: new Date().toISOString(),
        });
      } catch (rateLimitInsertError) {
        console.error("rateLimit insert error", {
          host,
          company_id: company.id,
          ip,
          error: rateLimitInsertError?.message || String(rateLimitInsertError),
        });
      }
      await writeAuditLog({
        request_id: requestId,
        route: "/api/login",
        company_id: company.id,
        admin_id: admin.id,
        action: "login",
        result: "reject",
        error_code: "INVALID_CREDENTIALS",
        metadata: { ip },
      });
      return sendJson(401, { error: "Credenciales invalidas" });
    }

    await supabase.from("login_attempts").delete().eq("company_id", company.id).eq("ip", ip);

    const token = randomToken(32);
    const tokenHash = sha256Hex(token);
    const maxAge = 7 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();
    const userAgentHash = sha256Hex(String(req.headers["user-agent"] || ""));

    if (String(process.env.LOGIN_INVALIDATE_PREVIOUS_SESSIONS || "").toLowerCase() === "true") {
      await supabase
        .from("admin_sessions")
        .delete()
        .eq("admin_id", admin.id)
        .eq("company_id", company.id);
    }

    const nowIso = new Date().toISOString();

    let { error: sessionError } = await supabase.from("admin_sessions").insert({
      admin_id: admin.id,
      company_id: company.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: nowIso,
      last_seen_at: nowIso,
      user_agent_hash: userAgentHash,
    });

    if (sessionError) {
      const fallback = await supabase.from("admin_sessions").insert({
        admin_id: admin.id,
        company_id: company.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
      sessionError = fallback.error;
    }

    if (sessionError) {
      return sendJson(500, { error: "Internal server error" });
    }

    const isHttps =
      String(req.headers["x-forwarded-proto"] || "").toLowerCase() === "https" ||
      req.connection?.encrypted === true;
    const secureCookie = process.env.NODE_ENV === "production" || isHttps;

    const sessionCookie = cookieSerialize("bunker_session", token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "Lax",
      path: "/",
      maxAge,
    });

    json(
      res,
      200,
      {
        admin_id: admin.id,
        company_id: company.id,
        request_id: requestId,
      },
      { "Set-Cookie": sessionCookie }
    );

    logEvent({
      request_id: requestId,
      route: "/api/login",
      company_id: company.id,
      admin_id: admin.id,
      result: "ok",
    });

    await writeAuditLog({
      request_id: requestId,
      route: "/api/login",
      company_id: company.id,
      admin_id: admin.id,
      action: "login",
      result: "ok",
      metadata: { ip },
    });

    return;
  } catch (error) {
    return sendJson(500, { error: error.message || "Server error" });
  }
};
