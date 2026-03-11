const {
  json,
  validateRequestOrigin,
  getSupabaseAdmin,
  getCompanyByReqHost,
  parseCookies,
  normalizeHost,
} = require("../lib/_lib");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeCompanyId = (value) => String(value || "").trim();

const deriveCompanyNameFromHost = (host) => {
  const normalizedHost = normalizeHost(host || "");
  if (!normalizedHost) return "MODU Gym";
  return normalizedHost.replace(/\./g, " ");
};

const getOnboardingEmail = (req) =>
  normalizeEmail(req?.query?.email || req?.query?.onboarding_email || req?.body?.email);
const getRequestedCompanyId = (req) =>
  normalizeCompanyId(req?.query?.company_id || req?.body?.company_id);

module.exports = async function handler(req, res) {
  if (!validateRequestOrigin(req, res)) return;

  const send = (status, payload, logMeta = {}) => {
    console.log("save-onboarding: response", {
      status,
      ...logMeta,
      payload,
    });
    return json(res, status, payload);
  };

  const cookies = parseCookies(req?.headers?.cookie || "");
  const requestBody = req?.body || {};
  const requestQuery = req?.query || {};
  console.log("save-onboarding: request start", {
    method: req.method,
    query: requestQuery,
    body: requestBody,
    has_bunker_session: Boolean(cookies.bunker_session),
  });

  try {
      const supabase = getSupabaseAdmin();
      const requestHost = normalizeHost(req?.headers?.host || "");
      const requestedCompanyId = getRequestedCompanyId(req);
      let company = null;

      if (requestedCompanyId) {
        const { data: companyById, error: companyByIdError } = await supabase
          .from("companies")
          .select("id, name, domain, subscription_status")
          .eq("id", requestedCompanyId)
          .maybeSingle();

        if (companyByIdError) {
          return send(
            500,
            { ok: false, step: "get_company", error: companyByIdError.message || "DATABASE_QUERY_FAILED" },
            { stage: "company_by_id" }
          );
        }

        company = companyById || null;
      }

      if (!company?.id) {
        company = await getCompanyByReqHost(req);
      }

      if (!company?.id) {
        if (!requestHost) {
          return send(404, { ok: false, step: "get_company", error: "COMPANY_NOT_FOUND" }, { stage: "company" });
        }

        const { data: createdCompany, error: createCompanyError } = await supabase
          .from("companies")
          .insert({
            domain: requestHost,
            name: deriveCompanyNameFromHost(requestHost),
            subscription_status: "pending",
          })
          .select("id, name, domain, subscription_status")
          .maybeSingle();

        if (createCompanyError) {
          console.log("save-onboarding: create company failed", {
            request_host: requestHost,
            error: createCompanyError.message || String(createCompanyError),
          });
        }

        if (createdCompany?.id) {
          company = createdCompany;
        } else {
          const { data: existingCompany, error: existingCompanyError } = await supabase
            .from("companies")
            .select("id, name, domain, subscription_status")
            .eq("domain", requestHost)
            .maybeSingle();

          if (existingCompanyError) {
            return send(
              500,
              { ok: false, step: "get_company", error: existingCompanyError.message || "DATABASE_QUERY_FAILED" },
              { stage: "company_lookup" }
            );
          }

          if (!existingCompany?.id) {
            return send(404, { ok: false, step: "get_company", error: "COMPANY_NOT_FOUND" }, { stage: "company" });
          }

          company = existingCompany;
        }
      }

      const onboardingEmail = getOnboardingEmail(req);
      const alumnoIdentifier = {
        company_id: company.id,
        requested_company_id: requestedCompanyId || null,
        email: onboardingEmail || null,
        email_source: req?.query?.email
          ? "query.email"
          : req?.query?.onboarding_email
            ? "query.onboarding_email"
            : req?.body?.email
              ? "body.email"
              : null,
      };

      console.log("save-onboarding: alumno identifier", alumnoIdentifier);

      if (!onboardingEmail) {
        return send(200, {
          ok: true,
          email: null,
          has_alumno: false,
          status: null,
          onboarding_completed: false,
          onboarding_completed_at: null,
          identified: false,
        }, { stage: "no_email_identifier" });
      }

      if (req.method === "GET") {
        const { data, error } = await supabase
          .from("alumnos")
          .select("id, email, status, onboarding_completed, onboarding_completed_at")
          .eq("company_id", company.id)
          .eq("email", onboardingEmail)
          .maybeSingle();

        console.log("save-onboarding: alumno lookup result", {
          ...alumnoIdentifier,
          found_alumno: Boolean(data?.id),
          alumno_status: data?.status || null,
          onboarding_completed: data?.onboarding_completed ?? null,
          onboarding_completed_at: data?.onboarding_completed_at || null,
          email_from_db: data?.email || null,
          error: error?.message || null,
        });

        if (error) {
          return send(500, { ok: false, step: "get_alumno", error: error.message || String(error) }, { stage: "get_alumno" });
        }

        return send(200, {
          has_alumno: Boolean(data?.id),
          email: data?.email || onboardingEmail,
          status: data?.status || null,
          onboarding_completed: Boolean(data?.onboarding_completed),
          onboarding_completed_at: data?.onboarding_completed_at || null,
          identified: true,
        }, { stage: "get_ok" });
      }

      if (req.method !== "POST") {
        res.setHeader("Allow", "GET, POST");
        return send(405, { ok: false, step: "method", error: "METHOD_NOT_ALLOWED" }, { stage: "method" });
      }

      const contentType = String(req?.headers?.["content-type"] || "").toLowerCase();
      if (!contentType.includes("application/json")) {
        console.log("save-onboarding: invalid content-type", {
          content_type: req?.headers?.["content-type"] || null,
        });
        return send(400, { ok: false, step: "content_type", error: "Content-Type must be application/json" }, { stage: "content_type" });
      }

      const cookieCsrf = cookies.bunker_csrf;
      const headerCsrf = req?.headers?.["x-csrf-token"];
      if (!cookieCsrf || !headerCsrf || String(cookieCsrf) !== String(headerCsrf)) {
        console.log("save-onboarding: csrf invalid", {
          has_csrf_cookie: Boolean(cookieCsrf),
          has_csrf_header: Boolean(headerCsrf),
        });
        return send(400, { ok: false, step: "csrf", error: "CSRF token invalid" }, { stage: "csrf" });
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
        return send(400, { ok: false, step: "validate_payload", error: "MISSING_REQUIRED_FIELDS" }, { stage: "required_fields" });
      }

      const { data: existingAlumno, error: existingAlumnoError } = await supabase
        .from("alumnos")
        .select("id, email, status, onboarding_completed, onboarding_completed_at")
        .eq("company_id", company.id)
        .eq("email", onboardingEmail)
        .maybeSingle();

      console.log("save-onboarding: alumno lookup result", {
        ...alumnoIdentifier,
        found_alumno: Boolean(existingAlumno?.id),
        alumno_status: existingAlumno?.status || null,
        onboarding_completed: existingAlumno?.onboarding_completed ?? null,
        onboarding_completed_at: existingAlumno?.onboarding_completed_at || null,
        email_from_db: existingAlumno?.email || null,
        error: existingAlumnoError?.message || null,
      });

      if (existingAlumnoError) {
        return send(500, { ok: false, step: "lookup_alumno", error: existingAlumnoError.message || String(existingAlumnoError) }, { stage: "lookup_alumno" });
      }

      const nowIso = new Date().toISOString();
      const savePayload = {
        company_id: company.id,
        email: onboardingEmail,
        full_name: fullName,
        goal,
        availability,
        experience: experience || null,
        injuries: injuries || null,
        onboarding_completed: true,
        onboarding_completed_at: nowIso,
        updated_at: nowIso,
      };

      console.log("save-onboarding: supabase payload", savePayload);

      const { error } = await supabase.from("alumnos").upsert(savePayload, {
        onConflict: "company_id,email",
      });

      if (error) {
        console.log("save-onboarding: save failed", {
          ...alumnoIdentifier,
          supabase_error: error,
        });
        return send(500, { ok: false, step: "update_alumno", error: error.message || String(error) }, { stage: "save" });
      }

      console.log("save-onboarding: save ok", alumnoIdentifier);
      return send(200, {
        ok: true,
        email: onboardingEmail,
        has_alumno: true,
        status: existingAlumno?.status || null,
        onboarding_completed: true,
        onboarding_completed_at: nowIso,
        identified: true,
      }, { stage: "save_ok", redirect_instruction: null });
    } catch (err) {
      const status = Number(err?.status) || 500;
      console.log("save-onboarding: js/auth error", {
        status,
        error: err?.message || String(err),
        stack: err?.stack || null,
      });
      return send(status, {
        ok: false,
        step: "auth_or_handler",
        error: err?.message || String(err),
      }, { stage: "catch_inner" });
  }
};
