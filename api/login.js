const bcrypt = require("bcryptjs");
const {
  getSupabaseAdmin,
  getCompanyByReqHost,
  randomToken,
  sha256Hex,
  cookieSerialize,
  setSecurityHeaders,
  validateRequestOrigin,
  requireJsonBody,
  getClientIp,
  createRequestId,
  logEvent,
  writeAuditLog,
} = require("./_lib");

const LOCKOUT_STEPS = [
  { threshold: 5, minutes: 15 },
  { threshold: 8, minutes: 60 },
  { threshold: 12, minutes: 240 },
];

const getLockoutMinutes = (attempts) => {
  let lockoutMinutes = 0;
  for (const step of LOCKOUT_STEPS) {
    if (attempts >= step.threshold) {
      lockoutMinutes = step.minutes;
    }
  }
  return lockoutMinutes;
};

const tableMissing = (error) =>
  /relation .*login_attempts.* does not exist|Could not find the table/i.test(
    String(error?.message || "")
  );

const buildLoginKey = (ip, email) => sha256Hex(`${ip}|${email}`);

async function getLoginAttemptRow(supabase, key) {
  const { data, error } = await supabase
    .from("login_attempts")
    .select("key, attempts, first_attempt_at, locked_until")
    .eq("key", key)
    .maybeSingle();

  if (error && !tableMissing(error)) throw error;
  if (error && tableMissing(error)) return null;
  return data || null;
}

async function registerFailedLogin(supabase, key, previousRow) {
  const now = new Date();
  const attempts = Number(previousRow?.attempts || 0) + 1;
  const firstAttemptAt = previousRow?.first_attempt_at || now.toISOString();
  const lockoutMinutes = getLockoutMinutes(attempts);
  const lockedUntil =
    lockoutMinutes > 0 ? new Date(now.getTime() + lockoutMinutes * 60 * 1000).toISOString() : null;

  const { error } = await supabase.from("login_attempts").upsert(
    {
      key,
      attempts,
      first_attempt_at: firstAttemptAt,
      locked_until: lockedUntil,
      updated_at: now.toISOString(),
    },
    { onConflict: "key" }
  );

  if (error && !tableMissing(error)) throw error;
}

async function clearLoginAttempts(supabase, key) {
  const { error } = await supabase.from("login_attempts").delete().eq("key", key);
  if (error && !tableMissing(error)) throw error;
}

module.exports = async (req, res) => {
  setSecurityHeaders(res);

  if (!validateRequestOrigin(req, res)) {
    return;
  }

  if (!requireJsonBody(req, res)) {
    return;
  }

  const requestId = createRequestId(req);

  const sendJson = (status, data) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ...data, request_id: requestId }));
  };

  if (req.method !== "POST") {
    return sendJson(405, { error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return sendJson(400, { error: "Missing email or password" });
    }

    const supabase = getSupabaseAdmin();
    const company = await getCompanyByReqHost(req);
    if (!company?.id) {
      return sendJson(404, { error: "Company not found for host" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const ip = getClientIp(req);
    const loginKey = buildLoginKey(ip, normalizedEmail);

    const loginAttempt = await getLoginAttemptRow(supabase, loginKey);
    const lockedUntilMs = new Date(loginAttempt?.locked_until || 0).getTime();
    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now()) {
      await writeAuditLog({
        request_id: requestId,
        route: "/api/login",
        company_id: company.id,
        action: "login",
        result: "reject",
        error_code: "LOGIN_LOCKED",
        metadata: { ip },
      });
      return sendJson(429, { error: "Credenciales inválidas" });
    }

    const { data: admin, error } = await supabase
      .from("company_admins")
      .select("id, email, password_hash, company_id")
      .eq("email", normalizedEmail)
      .eq("company_id", company.id)
      .maybeSingle();

    if (error) {
      return sendJson(500, { error: error.message });
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
        return sendJson(500, { error: otherTenantError.message });
      }

      await registerFailedLogin(supabase, loginKey, loginAttempt);
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
        return sendJson(401, { error: "Credenciales inválidas" });
      }

      return sendJson(401, { error: "Credenciales inválidas" });
    }

    const validPassword = await bcrypt.compare(String(password), admin.password_hash);
    if (!validPassword) {
      await registerFailedLogin(supabase, loginKey, loginAttempt);
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
      return sendJson(401, { error: "Credenciales inválidas" });
    }

    await clearLoginAttempts(supabase, loginKey);

    const token = randomToken(32);
    const tokenHash = sha256Hex(token);
    const maxAge = 7 * 24 * 60 * 60;
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();
    const userAgentHash = sha256Hex(String(req.headers["user-agent"] || ""));

    if (String(process.env.LOGIN_INVALIDATE_PREVIOUS_SESSIONS || "").toLowerCase() === "true") {
      await supabase
        .from("admin_sessions")
        .delete()
        .eq("admin_id", admin.id)
        .eq("company_id", company.id);
    }

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
      return sendJson(500, { error: sessionError.message });
    }

    const isHttps =
      String(req.headers["x-forwarded-proto"] || "").includes("https") ||
      process.env.NODE_ENV === "production";

    const sessionCookie = cookieSerialize("bunker_session", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "Lax",
      path: "/",
      maxAge,
    });

    res.setHeader("Set-Cookie", sessionCookie);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        admin_id: admin.id,
        company_id: company.id,
        request_id: requestId,
      })
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
