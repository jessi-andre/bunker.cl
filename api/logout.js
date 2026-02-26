const crypto = require("crypto");
const { getSupabaseAdmin, getCompanyByReqHost } = require("./_lib");

function parseCookies(req) {
  const cookieHeader = req?.headers?.cookie || "";
  const out = {};

  for (const part of String(cookieHeader).split(";")) {
    const chunk = part.trim();
    if (!chunk) continue;

    const eqIndex = chunk.indexOf("=");
    if (eqIndex === -1) continue;

    const key = chunk.slice(0, eqIndex).trim();
    const rawValue = chunk.slice(eqIndex + 1).trim();

    try {
      out[key] = decodeURIComponent(rawValue);
    } catch (_) {
      out[key] = rawValue;
    }
  }

  return out;
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

module.exports = async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    const cookies = parseCookies(req);
    const token = cookies.bunker_session;
    console.log("[logout] has cookie?", Boolean(token));

    if (token) {
      const tokenHash = sha256Hex(token);
      console.log("[logout] hash prefix", tokenHash.slice(0, 8));

      const supabase = getSupabaseAdmin();
      let query = supabase
        .from("admin_sessions")
        .delete({ count: "exact" })
        .eq("session_token_hash", tokenHash);

      const company = await getCompanyByReqHost(req);
      if (company?.id) {
        query = query.eq("company_id", company.id);
      }

      const { count, error } = await query;
      if (error) {
        throw new Error(error.message || "Failed to delete session");
      }

      console.log("[logout] deleted rows", count || 0);
    }

    res.setHeader("Set-Cookie", [
      "bunker_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: error.message || "Logout error" }));
  }
};
