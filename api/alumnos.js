const {
  requireAuthAndTenant,
  getSupabaseAdmin,
  json,
} = require("../lib/_lib");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  let authInfo;
  try {
    authInfo = await requireAuthAndTenant(req);
  } catch (err) {
    return json(res, err.status || 401, { error: err.message });
  }

  if (!authInfo) return;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("alumnos")
      .select("id, email, status, plan, stripeCustomerId, stripeSubscriptionId, created_at, updated_at")
      .eq("company_id", authInfo.company.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return json(res, 200, { alumnos: data || [] });
  } catch (err) {
    return json(res, 500, { error: err.message || "Error al obtener alumnos" });
  }
};
