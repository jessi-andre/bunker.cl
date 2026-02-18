const { getStripe, getBaseUrl } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body || {};
    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ error: "email válido es requerido" });
    }

    const stripe = getStripe();
    const baseUrl = getBaseUrl();

    const customers = await stripe.customers.list({
      email: String(email).toLowerCase(),
      limit: 1,
    });

    const customer = customers.data[0];
    if (!customer) {
      return res.status(404).json({ error: "No encontramos una suscripción para ese email" });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${baseUrl}/index.html#planes`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Error creando portal" });
  }
};