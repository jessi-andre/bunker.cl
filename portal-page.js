const form = document.getElementById("portal-form");
const emailInput = document.getElementById("portal-email");
const errorEl = document.getElementById("portal-error");

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("reason") === "subscription_inactive" && errorEl) {
  errorEl.textContent = "Tu suscripcion no esta activa. Puedes reactivarla desde el portal.";
  errorEl.hidden = false;
}

const prefilledEmail = String(urlParams.get("email") || "").trim().toLowerCase();
if (prefilledEmail && emailInput) {
  emailInput.value = prefilledEmail;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  errorEl.textContent = "";

  const email = emailInput?.value?.trim() || "";
  if (!email) {
    errorEl.textContent = "Ingresa un email valido.";
    errorEl.hidden = false;
    return;
  }

  if (!emailInput.checkValidity()) {
    emailInput.reportValidity();
    return;
  }

  try {
    const response = await fetch("/api/public-create-portal-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.url) {
      const code = String(data?.error || "");
      if (code === "MISSING_EMAIL") {
        throw new Error("Ingresa el email con el que te suscribiste.");
      }
      if (code === "SUBSCRIPTION_NOT_FOUND") {
        throw new Error("No encontramos una suscripcion asociada a ese email.");
      }
      if (code === "COMPANY_NOT_FOUND") {
        throw new Error("No pudimos identificar esta cuenta en el dominio actual.");
      }
      throw new Error(data?.error || "No pudimos abrir el portal.");
    }

    window.location.href = data.url;
  } catch (error) {
    errorEl.textContent = error?.message || "No pudimos abrir el portal.";
    errorEl.hidden = false;
  }
});
