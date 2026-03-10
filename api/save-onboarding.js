const {
  json,
  validateRequestOrigin,
  requireAuthAndTenant,
  getSupabaseAdmin,
  parseCookies,
} = require("../lib/_lib");

const getAdminEmail = async (supabase, adminId, companyId) => {
  const { data, error } = await supabase
    .from("company_admins")
    .select("email")
    .eq("id", adminId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to read admin email");
  }

  return String(data?.email || "").trim().toLowerCase();
};

module.exports = async function handler(req, res) {
  if (!validateRequestOrigin(req, res)) return;

  const send = (status, payload, logMeta = {}) => {
    console.log("save-onboarding: response", {
      status,
      ...logMeta,
      error: payload?.error || null,
    });
    return json(res, status, payload);
  };

  const cookies = parseCookies(req?.headers?.cookie || "");
  console.log("save-onboarding: request start", {
    method: req.method,
    has_bunker_session: Boolean(cookies.bunker_session),
  });

  try {
    const auth = await requireAuthAndTenant(req, {
      allowInactiveSubscription: true,
    });
    console.log("save-onboarding: session found", {
      admin_id: auth.admin_id,
      company_id: auth.company_id,
    });

    const supabase = getSupabaseAdmin();
    const adminEmail = await getAdminEmail(supabase, auth.admin_id, auth.company_id);

    if (!adminEmail) {
      console.log("save-onboarding: admin email not found", {
        admin_id: auth.admin_id,
        company_id: auth.company_id,
      });
      return send(500, { error: "INTERNAL_ERROR" }, { stage: "admin_email" });
    }

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("alumnos")
        .select("onboarding_completed")
        .eq("company_id", auth.company_id)
        .eq("email", adminEmail)
        .maybeSingle();

      if (error) {
        console.log("save-onboarding: failed to read alumno", {
          company_id: auth.company_id,
          email: adminEmail,
          supabase_error: error,
        });
        return send(500, { error: "INTERNAL_ERROR" }, { stage: "get_alumno" });
      }

      console.log("save-onboarding: alumno lookup", {
        company_id: auth.company_id,
        email: adminEmail,
        found_alumno: Boolean(data),
      });

      return send(200, {
        onboarding_completed: Boolean(data?.onboarding_completed),
      }, { stage: "get_ok" });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return send(405, { error: "METHOD_NOT_ALLOWED" }, { stage: "method" });
    }

    const contentType = String(req?.headers?.["content-type"] || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      console.log("save-onboarding: invalid content-type", {
        content_type: req?.headers?.["content-type"] || null,
      });
      return send(400, { error: "BAD_REQUEST" }, { stage: "content_type" });
    }

    const cookieCsrf = cookies.bunker_csrf;
    const headerCsrf = req?.headers?.["x-csrf-token"];
    if (!cookieCsrf || !headerCsrf || String(cookieCsrf) !== String(headerCsrf)) {
      console.log("save-onboarding: csrf invalid", {
        has_csrf_cookie: Boolean(cookieCsrf),
        has_csrf_header: Boolean(headerCsrf),
      });
      return send(400, { error: "BAD_REQUEST" }, { stage: "csrf" });
    }

    const payload = req.body || {};
    const fullName = String(payload.full_name || "").trim();
    const goal = String(payload.goal || "").trim();
    const availability = String(payload.availability || "").trim();
    const experience = String(payload.experience || "").trim();
    const injuries = String(payload.injuries || "").trim();

    if (!fullName || !goal || !availability) {
      console.log("save-onboarding: missing required fields", {
        has_full_name: Boolean(fullName),
        has_goal: Boolean(goal),
        has_availability: Boolean(availability),
      });
      return send(400, { error: "BAD_REQUEST" }, { stage: "required_fields" });
    }

    const { data: existingAlumno, error: existingAlumnoError } = await supabase
      .from("alumnos")
      .select("id")
      .eq("company_id", auth.company_id)
      .eq("email", adminEmail)
      .maybeSingle();

    if (existingAlumnoError) {
      console.log("save-onboarding: alumno lookup failed", {
        company_id: auth.company_id,
        email: adminEmail,
        supabase_error: existingAlumnoError,
      });
      return send(500, { error: "INTERNAL_ERROR" }, { stage: "lookup_alumno" });
    }

    console.log("save-onboarding: alumno lookup", {
      company_id: auth.company_id,
      email: adminEmail,
      found_alumno: Boolean(existingAlumno?.id),
    });

    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("alumnos").upsert(
      {
        company_id: auth.company_id,
        email: adminEmail,
        full_name: fullName,
        goal,
        availability,
        experience: experience || null,
        injuries: injuries || null,
        onboarding_completed: true,
        onboarding_completed_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "company_id,email" }
    );

    if (error) {
      console.log("save-onboarding: save failed", {
        company_id: auth.company_id,
        email: adminEmail,
        supabase_error: error,
      });
      return send(500, { error: "INTERNAL_ERROR" }, { stage: "save" });
    }

    console.log("save-onboarding: save ok", {
      company_id: auth.company_id,
      email: adminEmail,
    });

    return send(200, { ok: true }, { stage: "save_ok" });
  } catch (err) {
    const status = Number(err?.status) === 401 ? 401 : 500;
    console.log("save-onboarding: auth/error", {
      status,
      error: err?.message || String(err),
    });
    return send(status, { error: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR" }, {
      stage: "catch",
    });
  }
};
