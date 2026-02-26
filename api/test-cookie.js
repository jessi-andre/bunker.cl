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
      return res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
    }

    const tokenHash = sha256Hex(token);
    const supabase = getSupabaseAdmin();

    let companyId = null;
    const company = await getCompanyByReqHost(req);
    if (company?.id) {
      companyId = company.id;
    }

    let query = supabase
      .from("sesiones_de_administración")
      .select("id, id_de_administrador, id_de_empresa, caduca_en")
      .eq("hash_de_token_de_sesión", tokenHash)
      .maybeSingle();

    if (companyId) {
      query = query.eq("id_de_empresa", companyId);
    }

    const { data: session, error } = await query;

    if (error) {
      throw new Error(error.message || "Session lookup failed");
    }

    if (!session) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
    }

    const expiresAt = session["caduca_en"];
    const isExpired = !expiresAt || new Date(expiresAt).getTime() <= Date.now();

    if (isExpired) {
      await supabase.from("sesiones_de_administración").delete().eq("id", session.id);

      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({
        ok: true,
        admin_id: session["id_de_administrador"],
        company_id: session["id_de_empresa"],
      })
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: error.message || "Session check error" }));
  }
};
