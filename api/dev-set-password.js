const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");
const { getCompanyByReqHost, json } = require("./_lib");

module.exports = async (req, res) => {
  // disabled for multi-tenant safety
  if (process.env.VERCEL_ENV === "production") {
    return json(res, 404, { error: "Not found" });
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const adminScriptKey = process.env.ADMIN_SCRIPT_KEY;
  if (!adminScriptKey) {
    return json(res, 500, { error: "Missing ADMIN_SCRIPT_KEY" });
  }

  const secret = req.headers["x-admin-key"];
  if (!secret || secret !== adminScriptKey) {
    return json(res, 401, { error: "Unauthorized" });
  }

  const { email, newPassword } = req.body || {};
  if (!email || !newPassword) {
    return json(res, 400, { error: "Missing email or newPassword" });
  }

  const company = await getCompanyByReqHost(req);
  if (!company?.id) {
    return json(res, 404, { error: "Company not found for host" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const hash = await bcrypt.hash(newPassword, 10);

  const { data, error } = await supabase
    .from("company_admins")
    .update({ password_hash: hash })
    .eq("email", String(email).toLowerCase().trim())
    .eq("company_id", company.id)
    .select("id")
    .limit(1);

  if (error) {
    return json(res, 500, { error: error.message });
  }

  if (!Array.isArray(data) || data.length === 0) {
    return json(res, 404, { error: "Admin not found for this company" });
  }

  return json(res, 200, { ok: true });
};
