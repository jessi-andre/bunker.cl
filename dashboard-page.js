let csrfToken = null;
let adminEmail = null;
let allAlumnos = [];
let activeFilter = "todos";

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
  if (normalized === "cancelled") return "status-pill is-cancelled";
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

const updateSummary = (alumnos) => {
  const rows = Array.isArray(alumnos) ? alumnos : [];
  const activos = rows.filter((row) => String(row?.status || "").trim().toLowerCase() === "active").length;
  const pendientes = rows.filter((row) => String(row?.status || "").trim().toLowerCase() === "pending").length;
  const cancelados = rows.filter((row) => String(row?.status || "").trim().toLowerCase() === "cancelled").length;
  const completos = rows.filter((row) => row?.onboarding_completed === true).length;

  $("count-total").textContent = String(rows.length);
  $("count-active").textContent = String(activos);
  $("count-pending").textContent = String(pendientes);
  $("count-cancelled").textContent = String(cancelados);
  $("count-completed").textContent = String(completos);
};

const matchesFilter = (alumno, filterKey) => {
  const status = String(alumno?.status || "").trim().toLowerCase();
  const isComplete = alumno?.onboarding_completed === true;

  if (filterKey === "activos") return status === "active";
  if (filterKey === "pendientes") return status === "pending";
  if (filterKey === "cancelados") return status === "cancelled";
  if (filterKey === "completos") return isComplete;
  if (filterKey === "incompletos") return !isComplete;
  return true;
};

const getFilteredAlumnos = () => {
  const searchValue = String($("search-input")?.value || "").trim().toLowerCase();

  return allAlumnos.filter((alumno) => {
    const fullName = String(alumno?.full_name || "").trim().toLowerCase();
    const email = String(alumno?.email || "").trim().toLowerCase();
    const matchesSearch = !searchValue || fullName.includes(searchValue) || email.includes(searchValue);
    return matchesSearch && matchesFilter(alumno, activeFilter);
  });
};

const renderRows = (alumnos) => {
  const rows = Array.isArray(alumnos) ? alumnos : [];
  $("dashboard-loading").hidden = true;
  $("dashboard-error").hidden = true;

  if (rows.length === 0) {
    $("dashboard-table-wrap").hidden = true;
    $("dashboard-empty").hidden = false;
    $("dashboard-rows").innerHTML = "";
    return;
  }

  $("dashboard-empty").hidden = true;
  $("dashboard-rows").innerHTML = rows
    .map((alumno) => {
      const fullName = String(alumno?.full_name || "").trim() || "Sin nombre";
      const onboardingText = alumno?.onboarding_completed === true ? "Completo" : "Pendiente";
      const onboardingClass =
        alumno?.onboarding_completed === true
          ? "onboarding-pill is-done"
          : "onboarding-pill is-waiting";
      const statusLabel = formatStatusLabel(alumno?.status);
      const planLabel = String(alumno?.plan || "").trim() || "Sin plan";

      return `
        <tr>
          <td class="name-cell">
            <strong>${fullName}</strong>
            <span>${alumno?.full_name ? "Alumno registrado" : "Completa su nombre en datos iniciales"}</span>
          </td>
          <td>${alumno?.email || "-"}</td>
          <td><span class="${getStatusClass(alumno?.status)}">${statusLabel}</span></td>
          <td><span class="${onboardingClass}">${onboardingText}</span></td>
          <td>${planLabel}</td>
          <td>${formatDate(alumno?.created_at)}</td>
        </tr>
      `;
    })
    .join("");

  $("dashboard-table-wrap").hidden = false;
};

const applyDashboardFilters = () => {
  renderRows(getFilteredAlumnos());
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
    allAlumnos = Array.isArray(data?.alumnos) ? data.alumnos : [];

    updateSummary(allAlumnos);
    applyDashboardFilters();
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
$("search-input")?.addEventListener("input", applyDashboardFilters);
document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "todos";
    document.querySelectorAll("[data-filter]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    applyDashboardFilters();
  });
});
window.addEventListener("pageshow", () => {
  loadDashboard();
});

(async () => {
  try {
    await fetchCsrfToken();
  } catch (_) {}

  await loadDashboard();
})();
