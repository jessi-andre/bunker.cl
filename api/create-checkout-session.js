const {
  getStripe,
  getCompanyByReqHost,
  setSecurityHeaders,
  validateRequestOrigin,
  requireJsonBody,
  json,
  createRequestId,
  logEvent,
} = require("./_lib");

function getDomainFromReq(req) {
  // 1) Intentamos desde Origin
  const origin = req.headers.origin;
  if (origin) {
    try {
      return new URL(origin).host; // ej: bunker-cl.vercel.app
    } catch (e) {}
  }

  // 2) Si no hay origin, usamos referer
  const referer = req.headers.referer;
  if (referer) {
    try {
      return new URL(referer).host;
    } catch (e) {}
  }

  // 3) Fallback: host del request
  const host = req.headers.host;
  if (host) return host;

  return null;
}

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
    const requestId = createRequestId(req);

    const stripe = getStripe();

    // 1) Detectar dominio
    const domain = getDomainFromReq(req);
    if (!domain) {
      return json(res, 400, { error: "Could not detect domain", request_id: requestId });
    }

    // 2) Buscar company por host
    const company = await getCompanyByReqHost(req);
    if (!company?.id) {
      return json(res, 404, {
        error: "Company not found for host",
        request_id: requestId,
      });
    }

    // 3) Leer planId del body
    const { planId, success_url, cancel_url, customer_email, email } = req.body || {};
    if (!planId) {
      return json(res, 400, { error: "Missing planId", request_id: requestId });
    }

    if (!process.env.STRIPE_PRICE_ID_STARTER || !process.env.STRIPE_PRICE_ID_PRO || !process.env.STRIPE_PRICE_ID_ELITE) {
      return json(res, 500, {
        error: "Missing STRIPE_PRICE_ID_* env vars",
        request_id: requestId,
      });
    }

    
 const priceByPlan = {
  starter: process.env.STRIPE_PRICE_ID_STARTER,
  pro: process.env.STRIPE_PRICE_ID_PRO,
  elite: process.env.STRIPE_PRICE_ID_ELITE,
};

    const price = priceByPlan[String(planId).toLowerCase()];
    if (!price) {
      return json(res, 400, { error: `Unknown planId: ${planId}`, request_id: requestId });
    }

    const plan = String(planId).toLowerCase();
    const normalizedEmail = String(customer_email || email || "").trim().toLowerCase();

    // 4) Crear Checkout Session con metadata
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url:
        success_url ||
        `https://${domain}/gracias.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `https://${domain}/index.html#planes`,

      //  permitir que el usuario escriba su mail:
      customer_email: normalizedEmail || undefined,

      subscription_data: {
        metadata: {
          company_id: String(company.id),
          plan,
          email: normalizedEmail,
        },
      },

      metadata: {
        company_id: String(company.id),
        plan,
        email: normalizedEmail,
        planId: String(planId),
        companyId: String(company.id), 
        domain: String(domain),
      },
    });

    logEvent({
      request_id: requestId,
      route: "/api/create-checkout-session",
      company_id: company.id,
      result: "ok",
    });

    return json(res, 200, { url: session.url, request_id: requestId });
  } catch (err) {
    return json(res, 500, { error: err.message || "Server error" });
  }
};
