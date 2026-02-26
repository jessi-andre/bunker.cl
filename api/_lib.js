const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

const isProduction = () =>
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

const getStripe = () => {
  const secretKey = getRequiredEnv("STRIPE_SECRET_KEY");
  return new Stripe(secretKey);
};

const getSupabaseAdmin = () => {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRole = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRole);
};

const normalizeHost = (host = "") =>
  String(host).toLowerCase().split(":")[0].replace(/^www\./, "");

const setSecurityHeaders = (res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "script-src 'self' https://js.stripe.com https://www.googletagmanager.com https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://*.supabase.co",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "form-action 'self'",
    ].join("; ")
  );
};

const parseCookies = (cookieHeader = "") => {
  const out = {};

  for (const part of String(cookieHeader).split(";")) {
    const chunk = part.trim();
    if (!chunk) continue;

    const eqIndex = chunk.indexOf("=");
    if (eqIndex === -1) continue;

    const key = chunk.slice(0, eqIndex).trim();
    const rawValue = chunk.slice(eqIndex + 1).trim();

    try {
      out[key] = decodeURIComponent(rawValue);
    } catch (_) {
      out[key] = rawValue;
    }
  }

  return out;
};

const getOriginHost = (origin = "") => {
  try {
    return normalizeHost(new URL(String(origin)).host);
  } catch (_) {
    return null;
  }
};

const setCorsHeaders = (res, allowedOrigin) => {
  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-csrf-token, x-request-id, x-reset-secret, x-cleanup-secret"
  );
};

const validateRequestOrigin = (req, res, opts = {}) => {
  const { enforceForAllMethods = false } = opts;
  const method = String(req?.method || "GET").toUpperCase();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (!enforceForAllMethods && !isMutation && method !== "OPTIONS") {
    return true;
  }

  const origin = req?.headers?.origin;
  const reqHost = normalizeHost(req?.headers?.host || "");

  if (origin) {
    const originHost = getOriginHost(origin);
    if (!originHost || !reqHost || originHost !== reqHost) {
      json(res, 403, { error: "Origin not allowed" });
      return false;
    }
    setCorsHeaders(res, origin);
  } else {
    setCorsHeaders(res, null);
  }

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return false;
  }

  return true;
};

const requireJsonBody = (req, res) => {
  const method = String(req?.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return true;
  }

  const contentType = String(req?.headers?.["content-type"] || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    json(res, 415, { error: "Content-Type must be application/json" });
    return false;
  }

  return true;
};

const getCompanyByReqHost = async (req) => {
  const rawHost = req?.headers?.host;
  if (!rawHost) return null;

  const host = normalizeHost(rawHost);
  if (!host) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, domain")
    .eq("domain", host)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
};

const getBaseUrl = () => process.env.APP_BASE_URL || "http://localhost:3000";

const PLAN_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_ID_STARTER,
  pro: process.env.STRIPE_PRICE_ID_PRO,
  elite: process.env.STRIPE_PRICE_ID_ELITE,
};

const getPriceIdFromPlan = (planId) => {
  const priceId = PLAN_PRICE_IDS[planId];
  if (!priceId) throw new Error("Plan inválido o no configurado en env");
  return priceId;
};

const normalizePlanFromPriceId = (priceId) => {
  if (priceId === PLAN_PRICE_IDS.starter) return "starter";
  if (priceId === PLAN_PRICE_IDS.pro) return "pro";
  if (priceId === PLAN_PRICE_IDS.elite) return "elite";
  return "unknown";
};

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function cookieSerialize(name, value, opts = {}) {
  const {
    httpOnly = true,
    secure = isProduction(),
    sameSite = "Lax",
    path = "/",
    maxAge,
    expires,
  } = opts;

  let str = `${name}=${encodeURIComponent(value)}`;
  if (path) str += `; Path=${path}`;
  if (httpOnly) str += `; HttpOnly`;
  if (secure) str += `; Secure`;
  if (sameSite) str += `; SameSite=${sameSite}`;
  if (typeof maxAge === "number") str += `; Max-Age=${maxAge}`;
  if (expires instanceof Date) str += `; Expires=${expires.toUTCString()}`;
  return str;
}

function getSessionCookieValue(req) {
  const cookies = parseCookies(req?.headers?.cookie || "");
  return cookies.bunker_session || null;
}

function getClientIp(req) {
  const forwardedFor = req?.headers?.["x-forwarded-for"];
  if (forwardedFor) {
    return String(forwardedFor).split(",")[0].trim();
  }
  return String(req?.socket?.remoteAddress || "unknown");
}

function createRequestId(req) {
  const fromHeader = req?.headers?.["x-request-id"];
  if (fromHeader) return String(fromHeader).slice(0, 128);
  return randomToken(12);
}

function logEvent(payload = {}) {
  const line = {
    ts: new Date().toISOString(),
    ...payload,
  };
  console.log(JSON.stringify(line));
}

async function writeAuditLog({
  request_id,
  route,
  company_id = null,
  admin_id = null,
  action,
  result,
  error_code = null,
  metadata = null,
}) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("audit_logs").insert({
      request_id,
      route,
      company_id,
      admin_id,
      action,
      result,
      error_code,
      metadata,
    });
  } catch (_) {}
}

async function requireAuth(req, res, opts = {}) {
  const {
    route = "unknown",
    slidingEnabled = true,
    writeAudit = true,
  } = opts;

  const requestId = createRequestId(req);
  const token = getSessionCookieValue(req);
  if (!token) {
    if (writeAudit) {
      await writeAuditLog({
        request_id: requestId,
        route,
        action: "auth_check",
        result: "reject",
        error_code: "NO_SESSION_COOKIE",
      });
    }
    json(res, 401, { error: "No session", request_id: requestId });
    return null;
  }

  const tokenHash = sha256Hex(token);
  const supabase = getSupabaseAdmin();

  const { data: session, error } = await supabase
    .from("admin_sessions")
    .select("id, admin_id, company_id, token_hash, expires_at, created_at, last_seen_at, user_agent_hash")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    json(res, 500, { error: error.message, request_id: requestId });
    return null;
  }

  if (!session) {
    if (writeAudit) {
      await writeAuditLog({
        request_id: requestId,
        route,
        action: "auth_check",
        result: "reject",
        error_code: "SESSION_NOT_FOUND",
      });
    }
    json(res, 401, { error: "No session", request_id: requestId });
    return null;
  }

  const now = Date.now();
  const expiresAtMs = new Date(session.expires_at).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
    await supabase.from("admin_sessions").delete().eq("id", session.id);
    if (writeAudit) {
      await writeAuditLog({
        request_id: requestId,
        route,
        company_id: session.company_id,
        admin_id: session.admin_id,
        action: "auth_check",
        result: "reject",
        error_code: "SESSION_EXPIRED",
      });
    }
    json(res, 401, { error: "No session", request_id: requestId });
    return null;
  }

  let shouldInvalidateForRevocation = false;

  try {
    const { data: adminRow } = await supabase
      .from("company_admins")
      .select("sessions_revoked_at")
      .eq("id", session.admin_id)
      .eq("company_id", session.company_id)
      .maybeSingle();

    const sessionCreatedAtMs = new Date(session.created_at || 0).getTime();
    const adminRevokedAtMs = new Date(adminRow?.sessions_revoked_at || 0).getTime();
    if (
      Number.isFinite(sessionCreatedAtMs) &&
      Number.isFinite(adminRevokedAtMs) &&
      adminRevokedAtMs > 0 &&
      sessionCreatedAtMs < adminRevokedAtMs
    ) {
      shouldInvalidateForRevocation = true;
    }
  } catch (_) {}

  try {
    const { data: companyRow } = await supabase
      .from("companies")
      .select("sessions_revoked_at")
      .eq("id", session.company_id)
      .maybeSingle();

    const sessionCreatedAtMs = new Date(session.created_at || 0).getTime();
    const companyRevokedAtMs = new Date(companyRow?.sessions_revoked_at || 0).getTime();
    if (
      Number.isFinite(sessionCreatedAtMs) &&
      Number.isFinite(companyRevokedAtMs) &&
      companyRevokedAtMs > 0 &&
      sessionCreatedAtMs < companyRevokedAtMs
    ) {
      shouldInvalidateForRevocation = true;
    }
  } catch (_) {}

  if (shouldInvalidateForRevocation) {
    await supabase.from("admin_sessions").delete().eq("id", session.id);
    json(res, 401, { error: "No session", request_id: requestId });
    return null;
  }

  const requestUaHash = sha256Hex(String(req?.headers?.["user-agent"] || ""));
  const uaMode = String(process.env.SESSION_USER_AGENT_MODE || "soft").toLowerCase();

  if (session.user_agent_hash && session.user_agent_hash !== requestUaHash) {
    if (uaMode === "hard") {
      await supabase.from("admin_sessions").delete().eq("id", session.id);
      json(res, 401, { error: "No session", request_id: requestId });
      return null;
    }

    logEvent({
      request_id: requestId,
      route,
      company_id: session.company_id,
      admin_id: session.admin_id,
      result: "warn",
      error_code: "USER_AGENT_CHANGED",
    });
  }

  const sessionTtlSeconds = Number(process.env.SESSION_MAX_AGE_SECONDS || 7 * 24 * 60 * 60);
  const slidingThresholdSeconds = Number(
    process.env.SESSION_SLIDING_THRESHOLD_SECONDS || 6 * 60 * 60
  );
  const absoluteMaxSeconds = Number(
    process.env.SESSION_ABSOLUTE_MAX_SECONDS || 30 * 24 * 60 * 60
  );

  let newExpiresAtIso = null;

  if (slidingEnabled) {
    const msLeft = expiresAtMs - now;
    if (msLeft <= slidingThresholdSeconds * 1000) {
      const sessionCreatedAtMs = new Date(session.created_at || now).getTime();
      const absoluteCapMs = sessionCreatedAtMs + absoluteMaxSeconds * 1000;
      const targetExpiryMs = now + sessionTtlSeconds * 1000;
      const nextExpiryMs = Math.min(targetExpiryMs, absoluteCapMs);

      if (Number.isFinite(nextExpiryMs) && nextExpiryMs > expiresAtMs) {
        newExpiresAtIso = new Date(nextExpiryMs).toISOString();
      }
    }
  }

  const updatePayload = {
    last_seen_at: new Date(now).toISOString(),
  };

  if (!session.user_agent_hash) {
    updatePayload.user_agent_hash = requestUaHash;
  }

  if (newExpiresAtIso) {
    updatePayload.expires_at = newExpiresAtIso;
  }

  await supabase.from("admin_sessions").update(updatePayload).eq("id", session.id);

  if (newExpiresAtIso) {
    const maxAge = Math.max(0, Math.floor((new Date(newExpiresAtIso).getTime() - now) / 1000));
    const renewedCookie = cookieSerialize("bunker_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge,
    });
    res.setHeader("Set-Cookie", renewedCookie);
  }

  return {
    requestId,
    token,
    tokenHash,
    session: {
      id: session.id,
      admin_id: session.admin_id,
      company_id: session.company_id,
      expires_at: newExpiresAtIso || session.expires_at,
      created_at: session.created_at,
    },
  };
}

async function requireTenant(req, res, authInfo, opts = {}) {
  const route = opts.route || "unknown";
  const requestId = authInfo?.requestId || createRequestId(req);
  const company = await getCompanyByReqHost(req);

  if (!company?.id) {
    json(res, 404, { error: "Company not found for host", request_id: requestId });
    return null;
  }

  if (String(company.id) !== String(authInfo?.session?.company_id || "")) {
    await writeAuditLog({
      request_id: requestId,
      route,
      company_id: authInfo?.session?.company_id || null,
      admin_id: authInfo?.session?.admin_id || null,
      action: "tenant_check",
      result: "reject",
      error_code: "TENANT_MISMATCH",
    });
    json(res, 403, { error: "Tenant mismatch", request_id: requestId });
    return null;
  }

  return company;
}

function createCsrfToken() {
  return randomToken(24);
}

function setCsrfCookie(res, token) {
  const cookie = cookieSerialize("bunker_csrf", token, {
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 2 * 60 * 60,
  });
  res.setHeader("Set-Cookie", cookie);
}

const isSameHostFromUrl = (urlString, reqHost) => {
  if (!urlString) return false;
  try {
    return normalizeHost(new URL(urlString).host) === normalizeHost(reqHost);
  } catch (_) {
    return false;
  }
};

function requireCsrf(req, res) {
  const cookies = parseCookies(req?.headers?.cookie || "");
  const cookieToken = cookies.bunker_csrf;
  const headerToken = req?.headers?.["x-csrf-token"];

  if (!cookieToken || !headerToken || cookieToken !== String(headerToken)) {
    json(res, 403, { error: "CSRF token invalid" });
    return false;
  }

  const reqHost = req?.headers?.host || "";
  const origin = req?.headers?.origin;
  const referer = req?.headers?.referer;

  const originOk = origin ? isSameHostFromUrl(origin, reqHost) : false;
  const refererOk = referer ? isSameHostFromUrl(referer, reqHost) : false;

  if (origin || referer) {
    if (!originOk && !refererOk) {
      json(res, 403, { error: "Invalid Origin/Referer" });
      return false;
    }
  }

  return true;
}

async function requireActivePlan(companyId, res, opts = {}) {
  const route = opts.route || "unknown";
  const requestId = opts.requestId || null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("status, plan, current_period_end")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    json(res, 500, { error: error.message, request_id: requestId });
    return null;
  }

  const allowed = new Set(["active", "trialing"]);
  const status = String(data?.status || "inactive").toLowerCase();

  if (!allowed.has(status)) {
    await writeAuditLog({
      request_id: requestId,
      route,
      company_id: companyId,
      action: "plan_check",
      result: "reject",
      error_code: "PLAN_INACTIVE",
      metadata: { status },
    });
    json(res, 402, {
      code: "PLAN_INACTIVE",
      status,
      request_id: requestId,
    });
    return null;
  }

  return data;
}

function getExpiredSessionCookie() {
  return cookieSerialize("bunker_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

function json(res, status, data, extraHeaders = {}) {
  setSecurityHeaders(res);
  res.statusCode = status;

  for (const [k, v] of Object.entries(extraHeaders || {})) {
    res.setHeader(k, v);
  }

  if (!res.getHeader("Content-Type")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }

  res.end(JSON.stringify(data));
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}


module.exports = {
  getRequiredEnv,
  getStripe,
  getSupabaseAdmin,
  isProduction,
  setSecurityHeaders,
  validateRequestOrigin,
  requireJsonBody,
  parseCookies,
  normalizeHost,
  getCompanyByReqHost,
  getBaseUrl,
  getPriceIdFromPlan,
  normalizePlanFromPriceId,
  sha256Hex,
  randomToken,
  cookieSerialize,
  getSessionCookieValue,
  getClientIp,
  createRequestId,
  logEvent,
  writeAuditLog,
  requireAuth,
  requireTenant,
  createCsrfToken,
  setCsrfCookie,
  requireCsrf,
  requireActivePlan,
  getExpiredSessionCookie,
  json,
  requireEnv,
};
