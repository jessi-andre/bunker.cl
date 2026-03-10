const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const errorEl = document.getElementById("error");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");

togglePasswordBtn?.addEventListener("click", () => {
  const isHidden = passwordInput?.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePasswordBtn.setAttribute("aria-pressed", isHidden ? "true" : "false");
  togglePasswordBtn.setAttribute(
    "aria-label",
    isHidden ? "Ocultar contrasena" : "Mostrar contrasena",
  );
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = passwordInput.value;

  submitBtn.disabled = true;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (response.status === 200) {
      window.location.href = "/dashboard.html";
      return;
    }

    let message = "No se pudo iniciar sesión. Verifica tus credenciales.";
    try {
      const data = await response.json();
      if (data && data.error) message = data.error;
    } catch (_) {}

    errorEl.textContent = message;
  } catch (_) {
    errorEl.textContent = "Error de red. Intenta nuevamente.";
  } finally {
    submitBtn.disabled = false;
  }
});
