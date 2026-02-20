const bcrypt = require("bcryptjs");
const {
  getSupabaseAdmin,
  randomToken,
  sha256Hex,
  cookieSerialize,
  json,
} = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return json(res, 400, { error: "Missing email or password" });
    }

    const supabase = getSupabaseAdmin();
    const normalizedEmail = String(email).toLowerCase().trim();

    const { data: admin, error } = await supabase
      .from("company_admins")
      .select("id, email, password_hash, company_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      return json(res, 500, { error: error.message });
    }

    if (!admin?.password_hash) {
      return json(res, 401, { error: "Credenciales inválidas" });
    }

    const validPassword = await bcrypt.compare(String(password), admin.password_hash);
    if (!validPassword) {
      return json(res, 401, { error: "Credenciales inválidas" });
    }

    const token = randomToken(32);
    const tokenHash = sha256Hex(token);
    const maxAge = 7 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();

    const { error: sessionError } = await supabase.from("admin_sessions").insert({
      admin_id: admin.id,
      company_id: admin.company_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (sessionError) {
      return json(res, 500, { error: sessionError.message });
    }

    const sessionCookie = cookieSerialize("bunker_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge,
    });

    return json(
      res,
      200,
      {
        admin_id: admin.id,
        company_id: admin.company_id,
      },
      {
        "Set-Cookie": sessionCookie,
      }
    );
  } catch (error) {
    return json(res, 500, { error: error.message || "Server error" });
  }
};
