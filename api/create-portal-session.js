const {
  getStripe,
  getBaseUrl,
  getSupabaseAdmin,
  getCompanyByReqHost,
} = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body || {};
    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ error: "email válido es requerido" });
    }

    const company = await getCompanyByReqHost(req);
    if (!company?.id) {
      return res.status(404).json({ error: "Company not found for host" });
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
      return res.status(500).json({ error: error.message || "Error buscando alumno" });
    }

    if (!alumno?.stripeCustomerId) {
      return res.status(404).json({ error: "No encontramos una suscripción para ese email" });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: alumno.stripeCustomerId,
      return_url: `${baseUrl}/index.html#planes`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Error creando portal" });
  }
};