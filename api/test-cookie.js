module.exports = async (req, res) => {
  res.setHeader(
    "Set-Cookie",
    "cookie_test=ok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600"
  );
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true }));
};
