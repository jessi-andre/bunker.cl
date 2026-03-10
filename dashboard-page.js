let csrfToken = null;
let adminEmail = null;

const $ = (id) => document.getElementById(id);

const formatDate = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getStatusClass = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "status-pill is-active";
  if (normalized === "pending") return "status-pill is-pending";
  return "status-pill is-muted";
};

const fetchCsrfToken = async () => {
  const response = await fetch("/api/csrf", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("No se pudo inicializar CSRF");
  }

  const data = await response.json().catch(() => ({}));
  csrfToken = data?.csrf_token || data?.csrfToken || null;
};

const loadDashboard = async () => {
  $("dashboard-loading").hidden = false;
  $("dashboard-error").hidden = true;
  $("dashboard-empty").hidden = true;
  $("dashboard-table-wrap").hidden = true;

  try {
    const response = await fetch("/api/admin-dashboard", {
      method: "GET",
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error(data?.error || "No se pudo cargar el dashboard");
    }

    adminEmail = String(data?.admin_email || "").trim().toLowerCase() || null;

    $("session-info").textContent = adminEmail
      ? `Sesion activa: ${adminEmail}`
      : "Sesion activa";

    $("count-total").textContent = String(data?.counts?.total ?? 0);
    $("count-completed").textContent = String(data?.counts?.onboarding_completed ?? 0);
    $("count-pending").textContent = String(data?.counts?.pending ?? 0);

    const alumnos = Array.isArray(data?.alumnos) ? data.alumnos : [];
    $("dashboard-loading").hidden = true;

    if (alumnos.length === 0) {
      $("dashboard-empty").hidden = false;
      return;
    }

    $("dashboard-rows").innerHTML = alumnos
      .map((alumno) => {
        const fullName = String(alumno?.full_name || "").trim() || "Sin nombre";
        const onboardingText = alumno?.onboarding_completed === true ? "Si" : "No";
        const onboardingClass =
          alumno?.onboarding_completed === true
            ? "onboarding-pill is-done"
            : "onboarding-pill is-waiting";

        return `
          <tr>
            <td class="name-cell">
              <strong>${fullName}</strong>
              <span>${alumno?.full_name ? "Alumno registrado" : "Completa su nombre en onboarding"}</span>
            </td>
            <td>${alumno?.email || "-"}</td>
            <td><span class="${getStatusClass(alumno?.status)}">${alumno?.status || "-"}</span></td>
            <td><span class="${onboardingClass}">${onboardingText}</span></td>
            <td>${formatDate(alumno?.created_at)}</td>
          </tr>
        `;
      })
      .join("");

    $("dashboard-table-wrap").hidden = false;
  } catch (error) {
    $("dashboard-loading").hidden = true;
    $("dashboard-error").textContent = error?.message || "No se pudo cargar el dashboard";
    $("dashboard-error").hidden = false;
  }
};

const openBillingPortal = async () => {
  const billingBtn = $("billing-btn");
  const originalText = billingBtn?.textContent || "Facturacion";

  if (!adminEmail) {
    $("dashboard-error").textContent = "No se pudo identificar el email del admin para facturacion.";
    $("dashboard-error").hidden = false;
    return;
  }

  try {
    $("dashboard-error").hidden = true;
    if (billingBtn) {
      billingBtn.disabled = true;
      billingBtn.textContent = "Abriendo portal...";
    }

    const response = await fetch("/api/create-portal-session", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: adminEmail }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.url) {
      throw new Error(data?.error || "No se pudo abrir el portal de facturacion");
    }

    window.location.href = data.url;
  } catch (error) {
    $("dashboard-error").textContent =
      error?.message || "No se pudo abrir el portal de facturacion";
    $("dashboard-error").hidden = false;
    if (billingBtn) {
      billingBtn.disabled = false;
      billingBtn.textContent = originalText;
    }
  }
};

const logout = async () => {
  try {
    if (!csrfToken) {
      await fetchCsrfToken();
    }

    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken || "",
      },
      body: JSON.stringify({}),
    });
  } catch (_) {}

  window.location.href = "/login.html";
};

$("billing-btn")?.addEventListener("click", openBillingPortal);
$("logout-btn")?.addEventListener("click", logout);

(async () => {
  try {
    await fetchCsrfToken();
  } catch (_) {}

  await loadDashboard();
})();
