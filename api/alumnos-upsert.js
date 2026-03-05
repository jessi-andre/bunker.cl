const {
  requireAuthAndTenant,
  getSupabaseAdmin,
  validateRequestOrigin,
  requireJsonBody,
  json,
} = require("../lib/_lib");

module.exports = async (req, res) => {
  if (!validateRequestOrigin(req, res)) return;
  if (!requireJsonBody(req, res)) return;

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  let authInfo;
  try {
    authInfo = await requireAuthAndTenant(req);
  } catch (err) {
    return json(res, err.status || 401, { error: err.message });
  }

  if (!authInfo) return;

  const { email, status, plan } = req.body || {};

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return json(res, 400, { error: "Email inválido" });
  }

  const validStatuses = ["pending", "active", "inactive", "cancelled"];
  const normalizedStatus = status ? String(status).trim().toLowerCase() : "active";
  if (!validStatuses.includes(normalizedStatus)) {
    return json(res, 400, { error: "Status inválido" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("alumnos")
      .upsert(
        {
          company_id: authInfo.company.id,
          email: normalizedEmail,
          status: normalizedStatus,
          plan: plan ? String(plan).trim() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,email" }
      )
      .select("id, email, status, plan, created_at, updated_at")
      .maybeSingle();

    if (error) throw new Error(error.message);

    return json(res, 200, { alumno: data });
  } catch (err) {
    return json(res, 500, { error: err.message || "Error al guardar alumno" });
  }
};
