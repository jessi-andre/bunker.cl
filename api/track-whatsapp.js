const {
  json,
  validateRequestOrigin,
  requireJsonBody,
  getSupabaseAdmin,
  getCompanyByReqHost,
} = require("../lib/_lib");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

module.exports = async function handler(req, res) {
  if (!validateRequestOrigin(req, res)) return;
  if (!requireJsonBody(req, res)) return;

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const company = await getCompanyByReqHost(req);
    if (!company?.id) {
      return json(res, 404, { error: "COMPANY_NOT_FOUND" });
    }

    const email = normalizeEmail(req?.body?.email);
    if (!email) {
      return json(res, 400, { error: "MISSING_EMAIL" });
    }

    const supabase = getSupabaseAdmin();
    const clickedAt = new Date().toISOString();
    const { error } = await supabase
      .from("alumnos")
      .update({
        whatsapp_clicked_at: clickedAt,
        updated_at: clickedAt,
      })
      .eq("company_id", company.id)
      .eq("email", email);

    if (error) {
      return json(res, 500, { error: error.message || "Failed to track whatsapp click" });
    }

    return json(res, 200, { ok: true, email, whatsapp_clicked_at: clickedAt });
  } catch (error) {
    return json(res, 500, { error: error?.message || "Server error" });
  }
};
