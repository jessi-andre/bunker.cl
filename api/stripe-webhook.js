const bcrypt = require("bcryptjs");
const {
  json,
  getStripe,
  getSupabaseAdmin,
  normalizeHost,
  normalizePlanFromPriceId,
} = require("../lib/_lib");

const AUTO_ONBOARDING_PASSWORD_HASH = bcrypt.hashSync("modu:auto-onboarding:disabled-login", 10);

const readRawBody = (req) =>
  new Promise((resolve, reject) => {
    if (Buffer.isBuffer(req.body)) {
      return resolve(req.body);
    }

    if (typeof req.body === "string") {
      return resolve(Buffer.from(req.body));
    }

    if (req.rawBody) {
      return resolve(Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody));
    }

    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", (err) => {
      reject(err);
    });
  });

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.id) return String(value.id);
  return String(value);
};

const normalizeText = (value, max = 255) => String(value || "").trim().slice(0, max);

const normalizeEmail = (value) => {
  const out = normalizeText(value, 320).toLowerCase();
  return out || null;
};

const getCompanyByCustomerId = async (supabase, customerId) => {
  if (!customerId) return null;

  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Failed to fetch company");
  return data || null;
};

const getCompanyById = async (supabase, companyId) => {
  if (!companyId) return null;

  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Failed to fetch company");
  return data || null;
};

const getCompanyBySubscriptionId = async (supabase, subscriptionId) => {
  if (!subscriptionId) return null;

  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Failed to fetch company");
  return data || null;
};

const getCompanyByDomain = async (supabase, domain) => {
  if (!domain) return null;

  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("domain", domain)
    .maybeSingle();

  if (error) throw new Error(error.message || "Failed to fetch company");
  return data || null;
};

const resolveCompany = async (supabase, { customerId, companyId, subscriptionId }) => {
  const byCustomer = await getCompanyByCustomerId(supabase, customerId);
  if (byCustomer?.id) return byCustomer;

  const byCompanyId = await getCompanyById(supabase, companyId);
  if (byCompanyId?.id) return byCompanyId;

  const bySubscription = await getCompanyBySubscriptionId(supabase, subscriptionId);
  if (bySubscription?.id) return bySubscription;

  return null;
};

const deriveCompanyName = (domain) => {
  const cleaned = normalizeText(domain, 120);
  if (!cleaned) return "MODU Gym";
  return cleaned.replace(/\./g, " ");
};

const ensureCompany = async (
  supabase,
  { customerId, companyId, subscriptionId, companyDomain, companyName, subscriptionStatus }
) => {
  const existing = await resolveCompany(supabase, { customerId, companyId, subscriptionId });
  if (existing?.id) return existing;

  const normalizedDomain = normalizeHost(companyDomain || "");
  if (!normalizedDomain && !companyId) {
    return null;
  }

  const byDomain = await getCompanyByDomain(supabase, normalizedDomain);
  if (byDomain?.id) return byDomain;

  const insertPayload = {
    name: normalizeText(companyName, 120) || deriveCompanyName(normalizedDomain),
    domain: normalizedDomain || null,
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    subscription_status: subscriptionStatus || "active",
  };

  if (!insertPayload.domain && !companyId) {
    return null;
  }

  if (companyId) {
    insertPayload.id = companyId;
  }

  const { data: created, error: insertError } = await supabase
    .from("companies")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (!insertError && created?.id) {
    return created;
  }

  // If a concurrent webhook already created the row, resolve it again.
  const resolvedAfterConflict = await resolveCompany(supabase, {
    customerId,
    companyId,
    subscriptionId,
  });
  if (resolvedAfterConflict?.id) return resolvedAfterConflict;

  const byDomainAfterConflict = await getCompanyByDomain(supabase, normalizedDomain);
  if (byDomainAfterConflict?.id) return byDomainAfterConflict;

  return null;
};

const ensureCompanyAdmin = async (supabase, { companyId, adminEmail }) => {
  const normalizedAdminEmail = normalizeEmail(adminEmail);
  if (!companyId || !normalizedAdminEmail) return;

  const { data: existingRows, error: existingError } = await supabase
    .from("company_admins")
    .select("id")
    .eq("company_id", companyId)
    .eq("email", normalizedAdminEmail)
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message || "Failed to fetch company admin");
  }

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    return;
  }

  const { error: insertError } = await supabase.from("company_admins").insert({
    company_id: companyId,
    email: normalizedAdminEmail,
    password_hash: AUTO_ONBOARDING_PASSWORD_HASH,
  });

  if (!insertError) {
    return;
  }

  // Handle concurrent insert race without failing the webhook.
  const { data: checkRows, error: checkError } = await supabase
    .from("company_admins")
    .select("id")
    .eq("company_id", companyId)
    .eq("email", normalizedAdminEmail)
    .limit(1);

  if (checkError) {
    throw new Error(checkError.message || "Failed to verify company admin");
  }

  if (!Array.isArray(checkRows) || checkRows.length === 0) {
    throw new Error(insertError.message || "Failed to create company admin");
  }
};

const updateCompany = async (supabase, companyId, patch) => {
  const { error } = await supabase.from("companies").update(patch).eq("id", companyId);
  if (error) throw new Error(error.message || "Failed to update company");
};

const resolvePlan = ({ explicitPlan, priceId }) => {
  const fromMetadata = normalizeText(explicitPlan, 32).toLowerCase();
  if (["starter", "pro", "elite"].includes(fromMetadata)) {
    return fromMetadata;
  }

  if (priceId) {
    const fromPrice = normalizePlanFromPriceId(priceId);
    if (["starter", "pro", "elite"].includes(fromPrice)) {
      return fromPrice;
    }
  }

  return null;
};

const syncAlumnoFromStripe = async (
  supabase,
  { eventId, eventType, companyId, email, customerId, subscriptionId, status = "active", plan }
) => {
  const normalizedEmail = normalizeEmail(email);
  const logBase = {
    event_id: eventId || null,
    event_type: eventType || null,
    company_id: companyId || null,
    email: normalizedEmail || null,
    customer_id: customerId || null,
    subscription_id: subscriptionId || null,
    status: status || null,
    plan: plan || null,
  };

  console.log("stripe-webhook: alumno sync start", logBase);

  if (!companyId) {
    throw new Error("ALUMNO_SYNC_MISSING_COMPANY_ID");
  }

  const payload = {
    company_id: companyId,
    status,
    plan: plan || null,
    stripeCustomerId: customerId || null,
    stripeSubscriptionId: subscriptionId || null,
    updated_at: new Date().toISOString(),
  };

  // Primary match: same tenant + email created during checkout.
  if (normalizedEmail) {
    const { data: updatedRows, error: updateByEmailError } = await supabase
      .from("alumnos")
      .update(payload)
      .eq("company_id", companyId)
      .eq("email", normalizedEmail)
      .select("id")
      .limit(1);

    if (updateByEmailError) {
      console.error("stripe-webhook: alumno update by company_id+email failed", {
        ...logBase,
        supabase_error: updateByEmailError,
      });
      throw new Error(updateByEmailError.message || "Failed to update alumno by email");
    }

    const updatedByEmailCount = Array.isArray(updatedRows) ? updatedRows.length : 0;
    console.log("stripe-webhook: alumno update by company_id+email result", {
      ...logBase,
      updated_rows: updatedByEmailCount,
    });
    if (updatedByEmailCount === 0) {
      console.log("0 rows updated by email", logBase);
    }
    if (updatedByEmailCount > 0) return;

    // Fallback for legacy rows created without company_id.
    const { data: updatedLegacyRows, error: updateLegacyError } = await supabase
      .from("alumnos")
      .update(payload)
      .is("company_id", null)
      .eq("email", normalizedEmail)
      .select("id")
      .limit(1);

    if (updateLegacyError) {
      console.error("stripe-webhook: alumno update by null company_id+email failed", {
        ...logBase,
        supabase_error: updateLegacyError,
      });
      throw new Error(updateLegacyError.message || "Failed to update legacy alumno by email");
    }

    const updatedLegacyCount = Array.isArray(updatedLegacyRows) ? updatedLegacyRows.length : 0;
    console.log("stripe-webhook: alumno updated by null company_id+email", {
      ...logBase,
      updated_rows: updatedLegacyCount,
    });
    if (updatedLegacyCount > 0) return;
  }

  // Secondary match: existing row already linked by Stripe customer.
  if (customerId) {
    const { data: updatedByCustomerRows, error: updateByCustomerError } = await supabase
      .from("alumnos")
      .update(payload)
      .eq("company_id", companyId)
      .eq("stripeCustomerId", customerId)
      .select("id")
      .limit(1);

    if (updateByCustomerError) {
      console.error("stripe-webhook: alumno update by company_id+customer failed", {
        ...logBase,
        supabase_error: updateByCustomerError,
      });
      throw new Error(updateByCustomerError.message || "Failed to update alumno by customer");
    }

    const updatedByCustomerCount = Array.isArray(updatedByCustomerRows) ? updatedByCustomerRows.length : 0;
    console.log("stripe-webhook: alumno update by company_id+customer result", {
      ...logBase,
      updated_rows: updatedByCustomerCount,
    });
    if (updatedByCustomerCount === 0) {
      console.log("0 rows updated by customer", logBase);
    }
    if (updatedByCustomerCount > 0) return;
  }

  if (!normalizedEmail) {
    console.error("stripe-webhook: alumno sync aborted, missing email", logBase);
    throw new Error("ALUMNO_SYNC_MISSING_EMAIL");
  }

  // Last-resort upsert to keep onboarding/activation consistent.
  const upsertPayload = {
    ...payload,
    email: normalizedEmail,
  };
  const { error: upsertCompanyEmailError } = await supabase
    .from("alumnos")
    .upsert(upsertPayload, { onConflict: "company_id,email" });
  console.log("upsert alumnos executed", {
    ...logBase,
    conflict_target: "company_id,email",
  });

  if (!upsertCompanyEmailError) {
    console.log("stripe-webhook: alumno upserted with conflict target company_id,email", logBase);
    return;
  }

  console.warn("stripe-webhook: alumno upsert company_id,email failed", {
    ...logBase,
    supabase_error: upsertCompanyEmailError,
  });

  const { error: upsertEmailError } = await supabase
    .from("alumnos")
    .upsert(upsertPayload, { onConflict: "email" });
  console.log("upsert alumnos executed", {
    ...logBase,
    conflict_target: "email",
  });

  if (!upsertEmailError) {
    console.log("stripe-webhook: alumno upserted with conflict target email", logBase);
    return;
  }

  console.error("stripe-webhook: alumno upsert failed for all conflict targets", {
    ...logBase,
    supabase_error_company_email: upsertCompanyEmailError,
    supabase_error_email: upsertEmailError,
  });
  throw new Error(upsertEmailError.message || "Failed to upsert alumno from Stripe");
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return json(res, 400, { error: "Missing stripe-signature header" });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    return json(res, 400, { error: err?.message || "Invalid payload" });
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return json(res, 400, { error: err?.message || "Invalid signature" });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Idempotency: skip already-processed events (Stripe can retry)
    const { data: existing } = await supabase
      .from("stripe_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existing) {
      return json(res, 200, { received: true });
    }

    // Mark event as processed BEFORE handling (idempotency)
    await supabase.from("stripe_events").insert({
      event_id: event.id,
      event_type: event.type,
    });

    if (event.type === "checkout.session.completed") {
      console.log("WEBHOOK EVENT:", event.type);
      const session = event.data.object;
      console.log("SESSION EMAIL:", session?.customer_email || null);
      console.log("SESSION CUSTOMER:", session?.customer || null);
      console.log("SESSION SUBSCRIPTION:", session?.subscription || null);
      console.log("SESSION METADATA:", session?.metadata || null);
      const customerId = normalizeId(session.customer);
      const subscriptionId = normalizeId(session.subscription);
      const metadataCompanyId = normalizeId(session?.metadata?.company_id);
      const metadataCompanyDomain = normalizeText(session?.metadata?.company_domain, 255);
      const metadataCompanyName = normalizeText(session?.metadata?.company_name, 120);
      const sessionEmail =
        normalizeEmail(session?.customer_details?.email) ||
        normalizeEmail(session?.customer_email) ||
        normalizeEmail(session?.metadata?.email) ||
        normalizeEmail(session?.metadata?.admin_email);
      console.log("WEBHOOK EMAIL:", sessionEmail);
      console.log("WEBHOOK CUSTOMER:", customerId);
      console.log("WEBHOOK SUB:", subscriptionId);
      const metadataPlan = normalizeText(session?.metadata?.plan, 32).toLowerCase();
      const linePriceId = normalizeId(session?.line_items?.data?.[0]?.price?.id);
      const resolvedPlan = resolvePlan({ explicitPlan: metadataPlan, priceId: linePriceId });
      console.log("WEBHOOK COMPANY_ID:", metadataCompanyId);
      console.log("WEBHOOK PLAN:", resolvedPlan);

      const status = session.subscription_status
        ? String(session.subscription_status).toLowerCase()
        : "active";

      const company = await ensureCompany(supabase, {
        customerId,
        companyId: metadataCompanyId,
        subscriptionId,
        companyDomain: metadataCompanyDomain,
        companyName: metadataCompanyName,
        subscriptionStatus: status,
      });
      if (!company?.id) {
        console.warn("stripe-webhook: company not found for customer", {
          event_type: event.type,
          customer_id: customerId,
          company_id: metadataCompanyId,
          company_domain: metadataCompanyDomain,
          subscription_id: subscriptionId,
        });
        return json(res, 200, { received: true });
      }
      console.log("WEBHOOK RESOLVED COMPANY_ID:", company.id);

      const patch = {
        stripe_customer_id: customerId,
        subscription_status: status,
      };

      if (subscriptionId) {
        patch.stripe_subscription_id = subscriptionId;
      }

      await updateCompany(supabase, company.id, patch);
      await syncAlumnoFromStripe(supabase, {
        eventId: event.id,
        eventType: event.type,
        companyId: company.id,
        email: sessionEmail,
        customerId,
        subscriptionId,
        status: "active",
        plan: resolvedPlan,
      });
      try {
        await ensureCompanyAdmin(supabase, {
          companyId: company.id,
          adminEmail: sessionEmail,
        });
      } catch (adminErr) {
        console.warn("stripe-webhook: failed to ensure company admin", {
          event_type: event.type,
          company_id: company.id,
          admin_email: sessionEmail,
          error: adminErr?.message || String(adminErr),
        });
      }
      return json(res, 200, { received: true });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object;
      const customerId = normalizeId(subscription.customer);
      const subscriptionId = normalizeId(subscription.id);
      const metadataCompanyId = normalizeId(subscription?.metadata?.company_id);
      const metadataCompanyDomain = normalizeText(subscription?.metadata?.company_domain, 255);
      const metadataCompanyName = normalizeText(subscription?.metadata?.company_name, 120);
      const metadataAdminEmail =
        normalizeEmail(subscription?.metadata?.admin_email) ||
        normalizeEmail(subscription?.metadata?.email);
      const subscriptionStatus = subscription.status
        ? String(subscription.status).toLowerCase()
        : null;

      const company = await ensureCompany(supabase, {
        customerId,
        companyId: metadataCompanyId,
        subscriptionId,
        companyDomain: metadataCompanyDomain,
        companyName: metadataCompanyName,
        subscriptionStatus: subscriptionStatus || "active",
      });
      if (!company?.id) {
        console.warn("stripe-webhook: company not found for customer", {
          event_type: event.type,
          customer_id: customerId,
          company_id: metadataCompanyId,
          company_domain: metadataCompanyDomain,
          subscription_id: subscriptionId,
        });
        return json(res, 200, { received: true });
      }
      console.log("WEBHOOK RESOLVED COMPANY_ID:", company.id);

      const patch = {
        stripe_customer_id: customerId,
        subscription_status: subscriptionStatus,
        stripe_subscription_id: subscriptionId,
      };

      if (Number.isFinite(subscription.current_period_end)) {
        patch.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
      }

      await updateCompany(supabase, company.id, patch);
      try {
        await ensureCompanyAdmin(supabase, {
          companyId: company.id,
          adminEmail: metadataAdminEmail,
        });
      } catch (adminErr) {
        console.warn("stripe-webhook: failed to ensure company admin", {
          event_type: event.type,
          company_id: company.id,
          admin_email: metadataAdminEmail,
          error: adminErr?.message || String(adminErr),
        });
      }
      return json(res, 200, { received: true });
    }

    if (
      event.type === "invoice.payment_succeeded" ||
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = event.data.object;
      const customerId = normalizeId(invoice.customer);
      const subscriptionId = normalizeId(invoice.subscription);
      const metadataCompanyId = normalizeId(invoice?.metadata?.company_id);
      const metadataCompanyDomain = normalizeText(invoice?.metadata?.company_domain, 255);
      const metadataCompanyName = normalizeText(invoice?.metadata?.company_name, 120);
      const metadataAdminEmail =
        normalizeEmail(invoice?.metadata?.admin_email) ||
        normalizeEmail(invoice?.metadata?.email) ||
        normalizeEmail(invoice?.customer_email);
      const metadataPlan = normalizeText(invoice?.metadata?.plan, 32).toLowerCase();
      const invoicePriceId = normalizeId(invoice?.lines?.data?.[0]?.price?.id);
      const resolvedPlan = resolvePlan({ explicitPlan: metadataPlan, priceId: invoicePriceId });
      const isSuccessfulInvoice =
        event.type === "invoice.payment_succeeded" || event.type === "invoice.paid";
      console.log("WEBHOOK EVENT:", event.type);
      console.log("WEBHOOK EMAIL:", metadataAdminEmail);
      console.log("WEBHOOK COMPANY_ID:", metadataCompanyId);
      console.log("WEBHOOK CUSTOMER:", customerId);
      console.log("WEBHOOK SUB:", subscriptionId);
      console.log("WEBHOOK PLAN:", resolvedPlan);

      const company = await ensureCompany(supabase, {
        customerId,
        companyId: metadataCompanyId,
        subscriptionId,
        companyDomain: metadataCompanyDomain,
        companyName: metadataCompanyName,
        subscriptionStatus: isSuccessfulInvoice ? "active" : "past_due",
      });
      if (!company?.id) {
        console.warn("stripe-webhook: company not found for customer", {
          event_type: event.type,
          customer_id: customerId,
          company_id: metadataCompanyId,
          company_domain: metadataCompanyDomain,
          subscription_id: subscriptionId,
        });
        return json(res, 200, { received: true });
      }

      const patch = {
        stripe_customer_id: customerId,
        subscription_status: isSuccessfulInvoice ? "active" : "past_due",
      };

      if (subscriptionId) {
        patch.stripe_subscription_id = subscriptionId;
      }

      await updateCompany(supabase, company.id, patch);
      if (isSuccessfulInvoice) {
        await syncAlumnoFromStripe(supabase, {
          eventId: event.id,
          eventType: event.type,
          companyId: company.id,
          email: metadataAdminEmail,
          customerId,
          subscriptionId,
          status: "active",
          plan: resolvedPlan,
        });
      }
      try {
        await ensureCompanyAdmin(supabase, {
          companyId: company.id,
          adminEmail: metadataAdminEmail,
        });
      } catch (adminErr) {
        console.warn("stripe-webhook: failed to ensure company admin", {
          event_type: event.type,
          company_id: company.id,
          admin_email: metadataAdminEmail,
          error: adminErr?.message || String(adminErr),
        });
      }

      return json(res, 200, { received: true });
    }

    return json(res, 200, { received: true });
  } catch (err) {
    return json(res, 500, { error: err?.message || "Webhook processing error" });
  }
};
