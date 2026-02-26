const bcrypt = require("bcryptjs");
const { getSupabaseAdmin } = require("./_lib");

const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

module.exports = async (req, res) => {
  const sendJson = (status, data) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
  };

  if (req.method !== "POST") {
    return sendJson(405, { error: "Method not allowed" });
  }

  const resetSecret = process.env.BUNKER_SESSION_SECRET;
  if (!resetSecret) {
    return sendJson(500, { error: "Missing BUNKER_SESSION_SECRET" });
  }

  const providedSecret = req.headers["x-reset-secret"];
  if (!providedSecret || providedSecret !== resetSecret) {
    return sendJson(401, { error: "Unauthorized" });
  }

  try {
    const { email, newPassword } = req.body || {};

    if (!email || !newPassword) {
      return sendJson(400, { error: "Missing email or newPassword" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const passwordHash = await bcrypt.hash(String(newPassword), SALT_ROUNDS);

    const supabase = getSupabaseAdmin();

    const { data: admin, error: findError } = await supabase
      .from("company_admins")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (findError) {
      return sendJson(500, { error: findError.message });
    }

    if (!admin?.id) {
      return sendJson(404, { error: "Admin not found" });
    }

    const { error: updateError } = await supabase
      .from("company_admins")
      .update({ password_hash: passwordHash })
      .eq("id", admin.id);

    if (updateError) {
      return sendJson(500, { error: updateError.message });
    }

    return sendJson(200, { ok: true });
  } catch (error) {
    return sendJson(500, { error: error.message || "Server error" });
  }
};
