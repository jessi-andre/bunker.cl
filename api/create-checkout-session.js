const {
  getStripe,
  getSupabaseAdmin,
  getBaseUrl,
  getPriceIdFromPlan,
} = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { planId, email } = req.body || {};

    if (!planId) return res.status(400).json({ error: "planId es requerido" });
    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ error: "email válido es requerido" });
    }

    const stripe = getStripe();
    //const supabase = getSupabaseAdmin();
    const priceId = getPriceIdFromPlan(planId);
    const baseUrl = getBaseUrl();

    //await supabase.from("alumnos").upsert(
    //  {
     //   email: String(email).toLowerCase(),
     //   plan: planId,
     //   status: "pending",
     // },
     // { onConflict: "email" }
   // );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: String(email).toLowerCase(),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/gracias.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/index.html#planes`,
      metadata: {
        planId,
      },
      subscription_data: {
        metadata: {
          planId,
        },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Error iniciando checkout" });
  }
};