const {
  getStripe,
  getSupabaseAdmin,
  getCompanyByReqHost,
  getBaseUrl,
  normalizeHost,
  validateRequestOrigin,
  requireJsonBody,
  json,
  logEvent,
} = require("../lib/_lib");

const isMissingAlumnosTable = (error) =>
  /relation .*alumnos.* does not exist|Could not find the table/i.test(
    String(error?.message || "")
  );

const deriveCompanyNameFromHost = (host) => {
  const normalizedHost = normalizeHost(host || "");
  if (!normalizedHost) return "MODU Gym";
  return normalizedHost.replace(/\./g, " ");
};

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

    const { plan, email, admin_name } = req.body || {};
    const requestedPlan = String(plan || "").toLowerCase().trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedAdminName = String(admin_name || "").trim().slice(0, 120);

    if (!requestedPlan) {
      return json(res, 400, { error: "Missing plan" });
    }

    if (!normalizedEmail) {
      return json(res, 400, { error: "Missing email" });
    }

    const supabase = getSupabaseAdmin();
    const requestHost = normalizeHost(req?.headers?.host || "");
    let company = await getCompanyByReqHost(req);

    if (!company?.id) {
      if (!requestHost) {
        return json(res, 404, { error: "Company not found for host" });
      }

      const { data: createdCompany } = await supabase
        .from("companies")
        .insert({
          domain: requestHost,
          name: deriveCompanyNameFromHost(requestHost),
          subscription_status: "pending",
        })
        .select("id, name, domain")
        .maybeSingle();

      if (createdCompany?.id) {
        company = createdCompany;
      } else {
        const { data: existingCompany, error: existingCompanyError } = await supabase
          .from("companies")
          .select("id, name, domain")
          .eq("domain", requestHost)
          .maybeSingle();

        if (existingCompanyError) {
          return json(res, 500, { error: existingCompanyError.message || "Database query failed" });
        }

        if (!existingCompany?.id) {
          return json(res, 500, { error: "Company bootstrap failed" });
        }

        company = existingCompany;
      }
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
    const companyDomain = normalizeHost(company?.domain || req?.headers?.host || "");
    const companyName = String(company?.name || "").trim();
    const onboardingMeta = {
      company_id: String(company.id),
      company_domain: companyDomain || null,
      company_name: companyName || null,
      plan: requestedPlan,
      email: normalizedEmail,
      admin_email: normalizedEmail,
      admin_name: normalizedAdminName || null,
      source: "public_checkout",
    };

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: normalizedEmail,
      line_items: [{ price, quantity: 1 }],
      success_url: `${baseUrl}/gracias.html?ok=1`,
      cancel_url: `${baseUrl}/index.html#planes`,
      metadata: onboardingMeta,
      subscription_data: {
        metadata: onboardingMeta,
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
