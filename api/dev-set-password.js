const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  const secret = req.headers["x-dev-secret"];
  if (secret !== process.env.BUNKER_SESSION_SECRET) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Unauthorized" }));
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Missing email or password" }));
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const hash = await bcrypt.hash(password, 10);

  const { error } = await supabase
    .from("admins")
    .update({ password_hash: hash })
    .eq("email", String(email).toLowerCase().trim());

  if (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: error.message }));
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify({ ok: true }));
};
