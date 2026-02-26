const {
  getStripe,
  getBaseUrl,
  getSupabaseAdmin,
  setSecurityHeaders,
  validateRequestOrigin,
  requireJsonBody,
  requireCsrf,
  requireAuth,
  requireTenant,
  requireActivePlan,
  json,
  logEvent,
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

  try {
    if (!requireCsrf(req, res)) {
      return;
    }

    const authInfo = await requireAuth(req, res, { route: "/api/create-portal-session" });
    if (!authInfo) return;

    const company = await requireTenant(req, res, authInfo, {
      route: "/api/create-portal-session",
    });
    if (!company) return;

    const activePlan = await requireActivePlan(company.id, res, {
      route: "/api/create-portal-session",
      requestId: authInfo.requestId,
    });
    if (!activePlan) return;

    const { email } = req.body || {};
    if (!email || !String(email).includes("@")) {
      return json(res, 400, {
        error: "email válido es requerido",
        request_id: authInfo.requestId,
      });
    }

    const stripe = getStripe();
    const baseUrl = getBaseUrl();
    const supabase = getSupabaseAdmin();
    const normalizedEmail = String(email).toLowerCase().trim();

    const { data: alumno, error } = await supabase
      .from("alumnos")
      .select("stripeCustomerId")
      .eq("email", normalizedEmail)
      .eq("company_id", company.id)
      .maybeSingle();

    if (error) {
      return json(res, 500, {
        error: error.message || "Error buscando alumno",
        request_id: authInfo.requestId,
      });
    }

    if (!alumno?.stripeCustomerId) {
      return json(res, 404, {
        error: "No encontramos una suscripción para ese email",
        request_id: authInfo.requestId,
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: alumno.stripeCustomerId,
      return_url: `${baseUrl}/index.html#planes`,
    });

    logEvent({
      request_id: authInfo.requestId,
      route: "/api/create-portal-session",
      company_id: company.id,
      admin_id: authInfo.session.admin_id,
      result: "ok",
    });

    return json(res, 200, { url: portalSession.url, request_id: authInfo.requestId });
  } catch (error) {
    return json(res, 500, { error: error.message || "Error creando portal" });
  }
};