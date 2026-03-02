const {
  json,
  getSupabaseAdmin,
  parseCookies,
  sha256Hex,
  getExpiredSessionCookie,
} = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const cookies = parseCookies(req?.headers?.cookie || "");
    const token = cookies.bunker_session;

    if (token) {
      const tokenHash = sha256Hex(token);
      const supabase = getSupabaseAdmin();

      const { error } = await supabase
        .from("admin_sessions")
        .delete()
        .eq("token_hash", tokenHash);

      if (error) {
        throw new Error(error.message || "Failed to delete session");
      }
    }

    res.setHeader("Set-Cookie", getExpiredSessionCookie());
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { error: error?.message || "Logout error" });
  }
};
