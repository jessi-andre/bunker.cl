const bcrypt = require("bcryptjs");
const {
  getSupabaseAdmin,
  getCompanyByReqHost,
  randomToken,
  sha256Hex,
  cookieSerialize,
} = require("./_lib");

module.exports = async (req, res) => {
  const sendJson = (status, data) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
  };

  if (req.method !== "POST") {
    return sendJson(405, { error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return sendJson(400, { error: "Missing email or password" });
    }

    const supabase = getSupabaseAdmin();
    const company = await getCompanyByReqHost(req);
    if (!company?.id) {
      return sendJson(404, { error: "Company not found for host" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const { data: admin, error } = await supabase
      .from("company_admins")
      .select("id, email, password_hash, company_id")
      .eq("email", normalizedEmail)
      .eq("company_id", company.id)
      .maybeSingle();

    if (error) {
      return sendJson(500, { error: error.message });
    }

    if (!admin?.password_hash) {
      const { data: otherTenantAdmin, error: otherTenantError } = await supabase
        .from("company_admins")
        .select("id, company_id")
        .eq("email", normalizedEmail)
        .neq("company_id", company.id)
        .limit(1)
        .maybeSingle();

      if (otherTenantError) {
        return sendJson(500, { error: otherTenantError.message });
      }

      if (otherTenantAdmin?.id) {
        return sendJson(401, { error: "Credenciales inválidas" });
      }

      return sendJson(401, { error: "Credenciales inválidas" });
    }

    const validPassword = await bcrypt.compare(String(password), admin.password_hash);
    if (!validPassword) {
      return sendJson(401, { error: "Credenciales inválidas" });
    }

    const token = randomToken(32);
    const tokenHash = sha256Hex(token);
    const maxAge = 7 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();

    const { error: sessionError } = await supabase.from("admin_sessions").insert({
      admin_id: admin.id,
      company_id: company.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (sessionError) {
      return sendJson(500, { error: sessionError.message });
    }

    const sessionCookie = cookieSerialize("bunker_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge,
    });

    res.setHeader("Set-Cookie", sessionCookie);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        admin_id: admin.id,
        company_id: company.id,
      })
    );

    return;
  } catch (error) {
    return sendJson(500, { error: error.message || "Server error" });
  }
};
