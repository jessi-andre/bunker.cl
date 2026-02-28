const {
  setSecurityHeaders,
  validateRequestOrigin,
  createCsrfToken,
  setCsrfCookie,
  json,
  createRequestId,
} = require("./_lib");

module.exports = async (req, res) => {
  setSecurityHeaders(res);

  if (!validateRequestOrigin(req, res, { enforceForAllMethods: true })) {
    return;
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const requestId = createRequestId(req);
  const csrfToken = createCsrfToken();
  setCsrfCookie(req, res, csrfToken);

  return json(res, 200, { csrf_token: csrfToken, request_id: requestId });
};
