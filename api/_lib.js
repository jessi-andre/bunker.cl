const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
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

const getBaseUrl = () => {
  return process.env.APP_BASE_URL || "http://localhost:3000";
};

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

module.exports = {
  getRequiredEnv,
  getStripe,
  getSupabaseAdmin,
  getBaseUrl,
  getPriceIdFromPlan,
  normalizePlanFromPriceId,
};