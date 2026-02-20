const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Uso: node scripts/set-admin-password.js email password");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

async function run() {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const normalizedEmail = String(email).toLowerCase().trim();
    const passwordHash = await bcrypt.hash(String(password), rounds);

    const { data, error } = await supabase
      .from("company_admins")
      .update({ password_hash: passwordHash })
      .eq("email", normalizedEmail)
      .select("id, email, company_id");

    console.log({ data, error });
  } catch (error) {
    console.log({ data: null, error: error.message || String(error) });
    process.exit(1);
  }
}

run();
