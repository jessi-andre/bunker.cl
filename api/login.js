const { getSupabaseAdmin } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const supabase = getSupabaseAdmin();

    const { data: admin, error } = await supabase
      .from("company_admins")
      .select("id, company_id, password_hash")
      .eq("email", String(email).toLowerCase().trim())
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!admin || admin.password_hash !== "temporal_hash") {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.status(200).json({
      admin_id: admin.id,
      company_id: admin.company_id,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
};
