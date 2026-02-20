const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  const devSecret = req.headers["x-dev-secret"];
  if (!devSecret || devSecret !== process.env.BUNKER_SESSION_SECRET) {
    res.statusCode = 401;
    return res.end("Unauthorized");
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.statusCode = 400;
    return res.end("Missing email or password");
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
  const hash = await bcrypt.hash(password, rounds);

  const { error } = await supabase
    .from("company_admins")
    .update({ password_hash: hash })
    .eq("email", email.toLowerCase().trim());

  if (error) {
    res.statusCode = 500;
    return res.end(error.message);
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true }));
};
