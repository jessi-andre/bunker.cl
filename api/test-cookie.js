const { validateRequestOrigin, requireAuthAndTenant, json } = require("./_lib");

module.exports = async (req, res) => {
  if (!validateRequestOrigin(req, res, { enforceForAllMethods: true })) {
    return;
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (req?.query?.company_id || req?.body?.company_id) {
    return json(res, 400, { error: "company_id is not allowed" });
  }

  try {
    const { company, session } = await requireAuthAndTenant(req);
    return json(res, 200, {
      ok: true,
      company_id: company.id,
      admin_id: session.admin_id,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return json(res, status, { error: error?.message || "Auth check error" });
  }
};
