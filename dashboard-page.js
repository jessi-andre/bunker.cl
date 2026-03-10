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

const formatStatusLabel = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "Sin estado";
  if (normalized === "active") return "Activo";
  if (normalized === "pending") return "Pendiente";
  if (normalized === "cancelled") return "Cancelado";
  return normalized;
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

const ensureAdminSession = async () => {
  const response = await fetch("/api/test-cookie", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    window.location.replace("/login.html");
    return false;
  }

  return response.ok;
};

const loadDashboard = async () => {
  $("dashboard-loading").hidden = false;
  $("dashboard-error").hidden = true;
  $("dashboard-empty").hidden = true;
  $("dashboard-table-wrap").hidden = true;

  try {
    const hasSession = await ensureAdminSession();
    if (!hasSession) {
      return;
    }

    const response = await fetch("/api/admin-dashboard", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
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

    $("session-info").textContent = "Acceso central a la base de datos de alumnos.";

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
        const statusLabel = formatStatusLabel(alumno?.status);

        return `
          <tr>
            <td class="name-cell">
              <strong>${fullName}</strong>
              <span>${alumno?.full_name ? "Alumno registrado" : "Completa su nombre en onboarding"}</span>
            </td>
            <td>${alumno?.email || "-"}</td>
            <td><span class="${getStatusClass(alumno?.status)}">${statusLabel}</span></td>
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

$("logout-btn")?.addEventListener("click", logout);
window.addEventListener("pageshow", () => {
  loadDashboard();
});

(async () => {
  try {
    await fetchCsrfToken();
  } catch (_) {}

  await loadDashboard();
})();
