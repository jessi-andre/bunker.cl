const {
  json,
  validateRequestOrigin,
  requireJsonBody,
  requireCsrf,
  requireAuthAndTenant,
  getSupabaseAdmin,
} = require("../lib/_lib");

const getAdminEmail = async (supabase, adminId, companyId) => {
  const { data, error } = await supabase
    .from("company_admins")
    .select("email")
    .eq("id", adminId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to read admin email");
  }

  return String(data?.email || "").trim().toLowerCase();
};

module.exports = async function handler(req, res) {
  if (!validateRequestOrigin(req, res)) return;

  try {
    const auth = await requireAuthAndTenant(req, {
      allowInactiveSubscription: true,
    });
    const supabase = getSupabaseAdmin();
    const adminEmail = await getAdminEmail(supabase, auth.admin_id, auth.company_id);

    if (!adminEmail) {
      return json(res, 403, { error: "ADMIN_EMAIL_NOT_FOUND" });
    }

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("alumnos")
        .select("onboarding_completed")
        .eq("company_id", auth.company_id)
        .eq("email", adminEmail)
        .maybeSingle();

      if (error) {
        return json(res, 500, { error: error.message || "Failed to read onboarding status" });
      }

      return json(res, 200, {
        onboarding_completed: Boolean(data?.onboarding_completed),
      });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return json(res, 405, { error: "Method not allowed" });
    }

    if (!requireJsonBody(req, res)) return;
    if (!requireCsrf(req, res)) return;

    const payload = req.body || {};
    const fullName = String(payload.full_name || "").trim();
    const goal = String(payload.goal || "").trim();
    const availability = String(payload.availability || "").trim();
    const experience = String(payload.experience || "").trim();
    const injuries = String(payload.injuries || "").trim();

    if (!fullName || !goal || !availability) {
      return json(res, 400, { error: "MISSING_REQUIRED_FIELDS" });
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("alumnos").upsert(
      {
        company_id: auth.company_id,
        email: adminEmail,
        full_name: fullName,
        goal,
        availability,
        experience: experience || null,
        injuries: injuries || null,
        onboarding_completed: true,
        onboarding_completed_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "company_id,email" }
    );

    if (error) {
      return json(res, 500, { error: error.message || "Failed to save onboarding" });
    }

    return json(res, 200, { ok: true, onboarding_completed: true });
  } catch (err) {
    return json(res, Number(err?.status) || 500, {
      error: err?.message || "Internal server error",
    });
  }
};
