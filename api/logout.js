const { cookieSerialize } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  const expiredSessionCookieSecure = cookieSerialize("bunker_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });

  const expiredSessionCookieInsecure = cookieSerialize("bunker_session", "", {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });

  res.setHeader("Set-Cookie", [expiredSessionCookieSecure, expiredSessionCookieInsecure]);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify({ ok: true }));
};
