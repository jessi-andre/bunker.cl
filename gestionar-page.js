let csrfToken = null;

const fetchCsrfToken = async () => {
  const response = await fetch("/api/csrf", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("No se pudo inicializar CSRF");
  }

  const data = await response.json();
  csrfToken = data?.csrf_token || data?.csrfToken || null;
};

const ensureAdminSession = async () => {
  try {
    const response = await fetch("/api/test-cookie", {
      method: "GET",
      credentials: "include",
    });

    if (response.status !== 200) {
      window.location.href = "/login.html";
      return false;
    }

    let sessionData = null;
    try {
      sessionData = await response.json();
    } catch (_) {}

    const sessionInfoEl = document.getElementById("session-info");
    if (sessionInfoEl) {
      const adminEmail = sessionData?.email || sessionData?.admin_email || null;
      sessionInfoEl.textContent = adminEmail
        ? `Sesión activa: ${adminEmail}`
        : "Sesión activa";
    }

    return true;
  } catch (_) {
    window.location.href = "/login.html";
    return false;
  }
};

const logout = async () => {
  try {
    if (!csrfToken) {
      await fetchCsrfToken();
    }

    const response = await fetch("/api/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({}),
    });

    if (response.status === 200) {
      window.location.href = "/login.html";
      return;
    }

    const data = await response.json().catch(() => null);
    const sessionInfoEl = document.getElementById("session-info");
    if (sessionInfoEl) {
      sessionInfoEl.textContent =
        data?.error || "No se pudo cerrar sesión. Intenta nuevamente.";
    }
    return;
  } catch (_) {}

  const sessionInfoEl = document.getElementById("session-info");
  if (sessionInfoEl) {
    sessionInfoEl.textContent = "No se pudo cerrar sesión. Intenta nuevamente.";
  }
};

const form = document.getElementById("portal-form");
const emailInput = document.getElementById("portal-email");
const errorEl = document.getElementById("portal-error");
const logoutBtn = document.getElementById("logout-btn");

(async () => {
  const ok = await ensureAdminSession();
  if (!ok) return;

  try {
    await fetchCsrfToken();
  } catch (_) {}
})();

logoutBtn?.addEventListener("click", logout);

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;

  if (!emailInput.checkValidity()) {
    emailInput.reportValidity();
    return;
  }

  try {
    if (!csrfToken) {
      await fetchCsrfToken();
    }

    const response = await fetch("/api/create-portal-session", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ email: emailInput.value.trim() }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No pudimos abrir el portal");
    window.location.href = data.url;
  } catch (error) {
    errorEl.textContent = error.message || "No pudimos abrir el portal";
    errorEl.hidden = false;
  }
});
