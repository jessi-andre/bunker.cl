const {
  getStripe,
  getSupabaseAdmin,
  getCompanyByReqHost,
  getBaseUrl,
  validateRequestOrigin,
  requireJsonBody,
  json,
  logEvent,
} = require("../lib/_lib");

const isMissingAlumnosTable = (error) =>
  /relation .*alumnos.* does not exist|Could not find the table/i.test(
    String(error?.message || "")
  );

module.exports = async (req, res) => {
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
    if (req?.query?.company_id || req?.body?.company_id) {
      return json(res, 400, { error: "company_id is not allowed" });
    }

    if (req?.body?.price_id || req?.body?.priceId) {
      return json(res, 400, { error: "price_id is not allowed" });
    }

    const company = await getCompanyByReqHost(req);
    if (!company?.id) {
      return json(res, 404, { error: "Company not found for host" });
    }

    const { plan, email } = req.body || {};
    const requestedPlan = String(plan || "").toLowerCase().trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!requestedPlan) {
      return json(res, 400, { error: "Missing plan" });
    }

    if (!normalizedEmail) {
      return json(res, 400, { error: "Missing email" });
    }

    const supabase = getSupabaseAdmin();

    const { data: companyRow, error: companyError } = await supabase
      .from("companies")
      .select("subscription_status")
      .eq("id", company.id)
      .maybeSingle();

    if (companyError) {
      return json(res, 500, { error: companyError.message || "Database query failed" });
    }

    const subscriptionStatus = String(companyRow?.subscription_status || "").toLowerCase();
    if (!["active", "trialing"].includes(subscriptionStatus)) {
      return json(res, 402, {
        error: "subscription_inactive",
        status: companyRow?.subscription_status ?? null,
      });
    }

    const priceByPlan = {
      starter: process.env.STRIPE_PRICE_ID_STARTER,
      pro: process.env.STRIPE_PRICE_ID_PRO,
      elite: process.env.STRIPE_PRICE_ID_ELITE,
    };

    const price = priceByPlan[requestedPlan];
    if (!price) {
      return json(res, 400, { error: `Unknown plan: ${requestedPlan}` });
    }

    try {
      const { error: alumnoError } = await supabase.from("alumnos").upsert(
        {
          company_id: company.id,
          email: normalizedEmail,
          status: "pending",
        },
        { onConflict: "company_id,email" }
      );

      if (alumnoError && !isMissingAlumnosTable(alumnoError)) {
        throw new Error(alumnoError.message || "Failed to upsert alumno");
      }
    } catch (_) {}

    const stripe = getStripe();
    const baseUrl = getBaseUrl();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: normalizedEmail,
      line_items: [{ price, quantity: 1 }],
      success_url: `${baseUrl}/gracias.html?ok=1`,
      cancel_url: `${baseUrl}/index.html#planes`,
      metadata: {
        company_id: String(company.id),
        plan: requestedPlan,
        email: normalizedEmail,
        source: "public_checkout",
      },
      subscription_data: {
        metadata: {
          company_id: String(company.id),
          plan: requestedPlan,
          email: normalizedEmail,
          source: "public_checkout",
        },
      },
    });

    logEvent({
      route: "/api/public-create-checkout-session",
      company_id: company.id,
      result: "ok",
    });

    return json(res, 200, { url: checkoutSession.url });
  } catch (error) {
    return json(res, 500, { error: error?.message || "Server error" });
  }
};
