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

function buildExpiredSessionCookie() {
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  const parts = [
    "bunker_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (isProduction) {
    parts.push("Secure");
  }

  return parts.join("; ");
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

    if (token) {
      const tokenHash = sha256Hex(token);
      const supabase = getSupabaseAdmin();

      const deleteQuery = supabase
        .from("admin_sessions")
        .delete({ count: "exact" })
        .eq("token_hash", tokenHash);

      const { error } = await deleteQuery;
      if (error) {
        throw new Error(error.message || "Failed to delete session");
      }
    }

    res.setHeader("Set-Cookie", [buildExpiredSessionCookie()]);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: error.message || "Logout error" }));
  }
};
