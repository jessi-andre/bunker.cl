const { validateRequestOrigin, requireAuthAndTenant, json } = require("../lib/_lib");

module.exports = async function handler(req, res) {
  if (!validateRequestOrigin(req, res, { enforceForAllMethods: true })) {
    return;
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const { admin_id, company_id } = await requireAuthAndTenant(req);
    return json(res, 200, { ok: true, admin_id, company_id });
  } catch (err) {
    return json(res, Number(err?.status) || 500, {
      error: err?.message || "Server error",
    });
  }
};
