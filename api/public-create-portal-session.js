const {
  json,
  getStripe,
  getSupabaseAdmin,
  getCompanyByReqHost,
  normalizeHost,
  validateRequestOrigin,
  requireJsonBody,
  createRequestId,
  logEvent,
} = require("../lib/_lib");

const getRequestBaseUrl = (req) => {
  const host = normalizeHost(req?.headers?.host || "");
  if (!host) return null;

  const proto = String(req?.headers?.["x-forwarded-proto"] || "").trim().toLowerCase() || "https";
  return `${proto}://${host}`;
};

module.exports = async function handler(req, res) {
  if (!validateRequestOrigin(req, res)) {
    return;
  }

  if (!requireJsonBody(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const requestId = createRequestId(req);
    const providedEmail = String(req?.body?.email || "").trim().toLowerCase();
    if (!providedEmail) {
      return json(res, 400, { error: "MISSING_EMAIL" });
    }

    const company = await getCompanyByReqHost(req);
    if (!company?.id) {
      return json(res, 404, { error: "COMPANY_NOT_FOUND" });
    }

    const supabase = getSupabaseAdmin();
    const { data: alumno, error: alumnoError } = await supabase
      .from("alumnos")
      .select('email, status, "stripeCustomerId", "stripeSubscriptionId"')
      .eq("company_id", company.id)
      .eq("email", providedEmail)
      .maybeSingle();

    if (alumnoError) {
      return json(res, 500, { error: alumnoError.message || "Database query failed" });
    }

    const stripeCustomerId = String(alumno?.stripeCustomerId || "").trim();
    if (!stripeCustomerId) {
      return json(res, 404, { error: "SUBSCRIPTION_NOT_FOUND" });
    }

    const stripe = getStripe();
    const baseUrl = getRequestBaseUrl(req) || "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/portal.html?email=${encodeURIComponent(providedEmail)}`,
    });

    logEvent({
      request_id: requestId,
      route: "/api/public-create-portal-session",
      company_id: company.id,
      result: "ok",
    });

    return json(res, 200, {
      url: portalSession.url,
      email: providedEmail,
      status: alumno?.status || null,
    });
  } catch (err) {
    return json(res, Number(err?.status) || 500, {
      error: err?.message || "Internal server error",
    });
  }
};
