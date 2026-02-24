const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");
const { getCompanyByReqHost } = require("./_lib");

module.exports = async (req, res) => {
  // disabled for multi-tenant safety
  if (process.env.VERCEL_ENV === "production") {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Not found" }));
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  const adminScriptKey = process.env.ADMIN_SCRIPT_KEY;
  if (!adminScriptKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Missing ADMIN_SCRIPT_KEY" }));
  }

  const secret = req.headers["x-admin-key"];
  if (!secret || secret !== adminScriptKey) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Unauthorized" }));
  }

  const { email, newPassword } = req.body || {};
  if (!email || !newPassword) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Missing email or newPassword" }));
  }

  const company = await getCompanyByReqHost(req);
  if (!company?.id) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Company not found for host" }));
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
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: error.message }));
  }

  if (!Array.isArray(data) || data.length === 0) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Admin not found for this company" }));
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify({ ok: true }));
};
