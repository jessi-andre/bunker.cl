const bcrypt = require("bcryptjs");
const { getCompanyByReqHost, getSupabaseAdmin, requireJsonBody, json } = require("./_lib");

const parseBearerToken = (authorizationHeader) => {
  const value = String(authorizationHeader || "").trim();
  if (!value.toLowerCase().startsWith("bearer ")) return null;
  return value.slice(7).trim();
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!requireJsonBody(req, res)) {
    return;
  }

  const expectedToken = process.env.BUNKER_DEV_PASSWORD_TOKEN;
  if (!expectedToken) {
    return json(res, 500, { error: "Missing BUNKER_DEV_PASSWORD_TOKEN" });
  }

  const providedToken = parseBearerToken(req.headers.authorization);
  if (!providedToken || providedToken !== expectedToken) {
    return json(res, 401, { error: "Unauthorized" });
  }

  try {
    const { email, new_password, company_id } = req.body || {};
    if (!email || !new_password) {
      return json(res, 400, { error: "Missing email or new_password" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    let targetCompanyId = company_id ? String(company_id) : null;

    if (!targetCompanyId) {
      const company = await getCompanyByReqHost(req);
      if (!company?.id) {
        return json(res, 404, { error: "Company not found for host" });
      }
      targetCompanyId = String(company.id);
    }

    const passwordHash = await bcrypt.hash(String(new_password), 10);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("company_admins")
      .update({ password_hash: passwordHash })
      .eq("email", normalizedEmail)
      .eq("company_id", targetCompanyId)
      .select("id")
      .limit(1);

    if (error) {
      return json(res, 500, { error: error.message });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return json(res, 404, { error: "Admin not found for this company" });
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { error: error.message || "Server error" });
  }
};
