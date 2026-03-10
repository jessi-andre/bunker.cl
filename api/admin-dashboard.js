const {
  json,
  validateRequestOrigin,
  requireAuthAndTenant,
  getSupabaseAdmin,
} = require("../lib/_lib");

module.exports = async function handler(req, res) {
  if (!validateRequestOrigin(req, res, { enforceForAllMethods: true })) {
    return;
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const { admin_id, company_id } = await requireAuthAndTenant(req, {
      allowInactiveSubscription: true,
    });
    const supabase = getSupabaseAdmin();

    const { data: adminRow, error: adminError } = await supabase
      .from("company_admins")
      .select("email")
      .eq("id", admin_id)
      .eq("company_id", company_id)
      .maybeSingle();

    if (adminError) {
      return json(res, 500, { error: adminError.message || "Failed to load admin" });
    }

    const { data: alumnos, error: alumnosError } = await supabase
      .from("alumnos")
      .select("full_name, email, plan, status, onboarding_completed, created_at")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false });

    if (alumnosError) {
      return json(res, 500, { error: alumnosError.message || "Failed to load alumnos" });
    }

    const rows = Array.isArray(alumnos) ? alumnos : [];
    const counts = {
      total: rows.length,
      onboarding_completed: rows.filter((row) => row?.onboarding_completed === true).length,
      pending: rows.filter((row) => row?.onboarding_completed !== true).length,
    };

    return json(res, 200, {
      ok: true,
      admin_email: String(adminRow?.email || "").trim().toLowerCase() || null,
      company_id,
      counts,
      alumnos: rows,
    });
  } catch (err) {
    return json(res, Number(err?.status) || 500, {
      error: err?.message || "Server error",
    });
  }
};
