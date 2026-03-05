const form = document.getElementById("portal-form");
const emailInput = document.getElementById("portal-email");
const errorEl = document.getElementById("portal-error");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  errorEl.textContent = "";

  const email = emailInput?.value?.trim() || "";
  if (!email) {
    errorEl.textContent = "Ingresá un email válido.";
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
      throw new Error(data?.error || "No pudimos abrir el portal.");
    }

    window.location.href = data.url;
  } catch (error) {
    errorEl.textContent = error?.message || "No pudimos abrir el portal.";
    errorEl.hidden = false;
  }
});
