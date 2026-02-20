const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

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
const crypto = require("crypto");

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function cookieSerialize(name, value, opts = {}) {
  const {
    httpOnly = true,
    secure = true,
    sameSite = "Lax",
    path = "/",
    maxAge,
  } = opts;

  let str = `${name}=${encodeURIComponent(value)}`;
  if (path) str += `; Path=${path}`;
  if (httpOnly) str += `; HttpOnly`;
  if (secure) str += `; Secure`;
  if (sameSite) str += `; SameSite=${sameSite}`;
  if (typeof maxAge === "number") str += `; Max-Age=${maxAge}`;
  return str;
}

function json(res, status, data, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
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
  normalizeHost,
  getCompanyByReqHost,
  getBaseUrl,
  getPriceIdFromPlan,
  normalizePlanFromPriceId,
  sha256Hex,
  randomToken,
  cookieSerialize,
  json,
  requireEnv,
};
