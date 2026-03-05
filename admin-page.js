let csrfToken = null;

const $ = (id) => document.getElementById(id);

const fetchCsrfToken = async () => {
  const res = await fetch("/api/csrf", { method: "GET", credentials: "include" });
  if (!res.ok) throw new Error("No se pudo inicializar CSRF");
  const data = await res.json();
  csrfToken = data?.csrf_token || data?.csrfToken || null;
};

const ensureAdminSession = async () => {
  try {
    const res = await fetch("/api/test-cookie", { method: "GET", credentials: "include" });
    if (res.status !== 200) { window.location.href = "/login.html"; return false; }
    const data = await res.json();
    const info = $("session-info");
    if (info) info.textContent = data?.email || "Sesión activa";
    return true;
  } catch (_) { window.location.href = "/login.html"; return false; }
};

const logout = async () => {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken || "" },
      body: JSON.stringify({}),
    });
  } catch (_) {}
  window.location.href = "/login.html";
};

const badgeClass = (status) => {
  const map = { active: "badge-active", pending: "badge-pending", inactive: "badge-inactive", cancelled: "badge-cancelled" };
  return map[status] || "badge-inactive";
};

const formatDate = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const loadAlumnos = async () => {
  $("loading").hidden = false;
  $("alumnos-table").hidden = true;
  $("empty-msg").hidden = true;
  $("error-msg").hidden = true;

  try {
    const res = await fetch("/api/alumnos", { method: "GET", credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Error al cargar alumnos");

    const alumnos = data?.alumnos || [];
    $("loading").hidden = true;

    if (alumnos.length === 0) {
      $("empty-msg").hidden = false;
      return;
    }

    const tbody = $("alumnos-body");
    tbody.innerHTML = alumnos.map((a) => `
      <tr>
        <td>${a.email}</td>
        <td>${a.plan || "-"}</td>
        <td>${a.status ? `<span class="badge ${badgeClass(a.status)}">${a.status}</span>` : '<span style="color:#9ca3af;font-size:0.875rem;">-</span>'}</td>
        <td>${formatDate(a.created_at)}</td>
        <td><button class="btn btn-ghost" style="padding:0.25rem 0.75rem;font-size:0.875rem;" onclick="openModal('${a.email}','${a.plan || ''}','${a.status}')">Editar</button></td>
      </tr>
    `).join("");

    $("alumnos-table").hidden = false;
  } catch (err) {
    $("loading").hidden = true;
    $("error-msg").textContent = err.message;
    $("error-msg").hidden = false;
  }
};

const openModal = (email = "", plan = "", status = "active") => {
  $("modal-title").textContent = email ? "Editar alumno" : "Agregar alumno";
  $("input-email").value = email;
  $("input-email").disabled = !!email;
  $("input-plan").value = plan;
  $("input-status").value = status;
  $("modal-error").hidden = true;
  $("modal").classList.add("open");
};

const closeModal = () => {
  $("modal").classList.remove("open");
  $("input-email").disabled = false;
};

const saveAlumno = async () => {
  const email = $("input-email").value.trim();
  const plan = $("input-plan").value;
  const status = $("input-status").value;

  if (!email) {
    $("modal-error").textContent = "El email es obligatorio.";
    $("modal-error").hidden = false;
    return;
  }

  $("modal-error").hidden = true;
  $("modal-save").disabled = true;
  $("modal-save").textContent = "Guardando...";

  try {
    const res = await fetch("/api/alumnos", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken || "" },
      body: JSON.stringify({ email, plan, status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Error al guardar");
    closeModal();
    await loadAlumnos();
  } catch (err) {
    $("modal-error").textContent = err.message;
    $("modal-error").hidden = false;
  } finally {
    $("modal-save").disabled = false;
    $("modal-save").textContent = "Guardar";
  }
};

// Event listeners
$("logout-btn")?.addEventListener("click", logout);
$("add-btn")?.addEventListener("click", () => openModal());
$("modal-cancel")?.addEventListener("click", closeModal);
$("modal-save")?.addEventListener("click", saveAlumno);
$("modal")?.addEventListener("click", (e) => { if (e.target === $("modal")) closeModal(); });

// Init
(async () => {
  const ok = await ensureAdminSession();
  if (!ok) return;
  await fetchCsrfToken();
  await loadAlumnos();
})();
