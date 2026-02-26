const crypto = require("crypto");
const { getSupabaseAdmin } = require("./_lib");

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
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    const cookies = parseCookies(req);
    const token = cookies.bunker_session;

    if (!token) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "No session" }));
    }

    const tokenHash = sha256Hex(token);
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("admin_sessions")
      .select("id, admin_id, company_id, expires_at")
      .eq("session_token_hash", tokenHash)
      .maybeSingle();

    const { data: session, error } = await query;

    if (error) {
      throw new Error(error.message || "Session lookup failed");
    }

    if (!session) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "No session" }));
    }

    const expiresAt = session.expires_at;
    const isExpired = !expiresAt || new Date(expiresAt).getTime() <= Date.now();

    if (isExpired) {
      await supabase.from("admin_sessions").delete().eq("id", session.id);

      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "No session" }));
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({
        admin_id: session.admin_id,
        company_id: session.company_id,
      })
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: error.message || "Session check error" }));
  }
};
