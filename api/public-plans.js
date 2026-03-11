const {
  getSupabaseAdmin,
  getCompanyByReqHost,
  applySecurityHeaders,
  json,
} = require("../lib/_lib");

const FALLBACK_PLANS = [
  {
    plan_key: "starter",
    name: "Starter",
    description: "Para quienes empiezan o retoman. Foco en habitos y tecnica base.",
    price_amount: 29990,
    currency: "CLP",
    billing_interval: "month",
    is_featured: false,
  },
  {
    plan_key: "pro",
    name: "Pro",
    description: "Entrenamiento y nutricion integrados. Para quienes quieren resultados reales.",
    price_amount: 49990,
    currency: "CLP",
    billing_interval: "month",
    is_featured: true,
  },
  {
    plan_key: "elite",
    name: "Elite",
    description: "El proceso completo. Para quienes no quieren dejar nada al azar.",
    price_amount: 79990,
    currency: "CLP",
    billing_interval: "month",
    is_featured: false,
  },
];

module.exports = async (req, res) => {
  applySecurityHeaders(res, { "Cache-Control": "no-store" });

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const company = await getCompanyByReqHost(req);

    if (!company?.id) {
      return json(res, 200, FALLBACK_PLANS);
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("company_plans")
      .select(
        "plan_key, name, description, price_amount, currency, billing_interval, is_featured"
      )
      .eq("company_id", company.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return json(res, 500, { error: error.message || "Database query failed" });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return json(res, 200, FALLBACK_PLANS);
    }

    return json(res, 200, data);
  } catch (error) {
    return json(res, 500, { error: error?.message || "Server error" });
  }
};
