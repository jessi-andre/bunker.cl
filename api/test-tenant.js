const { getCompanyByReqHost } = require("../lib/_lib");

module.exports = async function handler(req, res) {
  try {
    const company = await getCompanyByReqHost(req);

    return res.status(200).json({
      host: req.headers.host,
      company,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "tenant_detection_failed",
    });
  }
};
