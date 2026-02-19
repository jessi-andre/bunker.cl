const { getStripe, getCompanyByReqHost } = require("./_lib");

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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const stripe = getStripe();

    // 1) Detectar dominio
    const domain = getDomainFromReq(req);
    if (!domain) {
      return res.status(400).json({ error: "Could not detect domain" });
    }

    // 2) Buscar company por host
    const company = await getCompanyByReqHost(req);
    if (!company?.id) {
      return res.status(404).json({
        error: "Company not found for host",
      });
    }

    // 3) Leer planId del body
    const { planId, success_url, cancel_url, customer_email } = req.body || {};
    if (!planId) {
      return res.status(400).json({ error: "Missing planId" });
    }

    
    const priceByPlan = {
      starter: process.env.STRIPE_PRICE_STARTER,
      pro: process.env.STRIPE_PRICE_PRO,
      elite: process.env.STRIPE_PRICE_ELITE,
    };

    const price = priceByPlan[String(planId).toLowerCase()];
    if (!price) {
      return res.status(400).json({ error: `Unknown planId: ${planId}` });
    }

    const plan = String(planId).toLowerCase();
    const email = String(customer_email || "").trim().toLowerCase();

    // 4) Crear Checkout Session con metadata
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url:
        success_url ||
        `https://${domain}/gracias.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `https://${domain}/index.html#planes`,

      //  permitir que el usuario escriba su mail:
      customer_email: customer_email || undefined,

      subscription_data: {
        metadata: {
          company_id: String(company.id),
          plan,
          email,
        },
      },

      metadata: {
        company_id: String(company.id),
        plan,
        email,
        planId: String(planId),
        companyId: String(company.id), 
        domain: String(domain),
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
};
