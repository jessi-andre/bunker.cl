const MAPS = {
  google: "https://www.google.com/maps/search/?api=1&query=Matta+Oriente+408,+%C3%91u%C3%B1oa,+Santiago+de+Chile",
  apple: "http://maps.apple.com/?q=Matta+Oriente+408,+%C3%91u%C3%B1oa,+Santiago+de+Chile",
};

const PLAN_CATALOG = {
  starter: {
    id: "starter",
    name: "Starter",
    price: "$39.990 CLP / mes",
    includes: ["2 sesiones semanales", "Evaluación inicial", "Soporte por WhatsApp"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "$59.990 CLP / mes",
    includes: ["3 sesiones semanales", "Plan personalizado", "Seguimiento semanal"],
  },
  elite: {
    id: "elite",
    name: "Elite",
    price: "$79.990 CLP / mes",
    includes: ["4 sesiones semanales", "Seguimiento integral", "Revisión de progreso"],
  },
};

const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".main-nav");
const navLinks = document.querySelectorAll(".main-nav a");
const scrollLinks = document.querySelectorAll("[data-scroll-to]");
const planButtons = document.querySelectorAll(".plan-btn");
const modal = document.getElementById("checkout-modal");
const modalConfirm = document.getElementById("modal-confirm");
const modalCancel = document.getElementById("modal-cancel");
const modalBackdrop = modal?.querySelector("[data-close-modal]");
const modalPlanName = document.getElementById("modal-plan-name");
const modalPlanPrice = document.getElementById("modal-plan-price");
const modalPlanIncludes = document.getElementById("modal-plan-includes");
const checkoutEmailInput = document.getElementById("checkout-email");
const faqTriggers = document.querySelectorAll(".faq-trigger");
const contactForm = document.getElementById("contact-form");
const toast = document.getElementById("toast");
const toTopButton = document.getElementById("to-top");
const mapsPrimaryLink = document.getElementById("maps-primary-link");

const ctaInscribirme = document.querySelectorAll(".js-cta-inscribirme");
const ctaWhatsapp = document.querySelectorAll(".js-cta-whatsapp");
const ctaMaps = document.querySelectorAll(".js-cta-maps");
const ctaPhone = document.querySelectorAll(".js-cta-phone");

let pendingCheckoutUrl = "";
let selectedPlanId = "";
let lastScrollY = window.scrollY;

const getPlanDetails = (button) => {
  const planId = button.getAttribute("data-plan")?.trim();
  if (!planId) return null;

  const fromCatalog = PLAN_CATALOG[planId];
  if (fromCatalog) return fromCatalog;

  const card = button.closest(".plan-card");
  if (!card) return null;

  const planName = card.querySelector(".plan-name")?.textContent?.trim() || "Plan";
  const planPrice = card.querySelector(".price")?.textContent?.replace(/\s+/g, " ")?.trim() || "";
  const includes = Array.from(card.querySelectorAll("ul li"))
    .map((item) => item.textContent.trim())
    .filter(Boolean);

  return { id: planId, name: planName, price: planPrice, includes };
};

const renderPlanSummary = (details) => {
  if (!details || !modalPlanName || !modalPlanPrice || !modalPlanIncludes) return;

  modalPlanName.textContent = details.name;
  modalPlanPrice.textContent = details.price;
  modalPlanIncludes.innerHTML = "";

  details.includes.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    modalPlanIncludes.appendChild(listItem);
  });
};

const isIOS = () => {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const touchMac = platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(userAgent) || touchMac;
};

const trackEvent = (name, params = {}) => {
  if (typeof window.fbq === "function") {
    if (name === "purchase") {
      window.fbq("track", "Purchase", params);
    } else if (name === "begin_checkout") {
      window.fbq("track", "InitiateCheckout", params);
    } else if (name === "select_plan") {
      window.fbq("trackCustom", "SelectPlan", params);
    } else if (name === "click_whatsapp") {
      window.fbq("trackCustom", "ClickWhatsApp", params);
    }
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
};

const createCheckoutSession = async ({ planId, email }) => {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ planId, email }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error || "No pudimos iniciar el checkout.");
  }

  return response.json();
};

const setPrimaryMapsLink = () => {
  if (!mapsPrimaryLink) return;
  mapsPrimaryLink.href = isIOS() ? MAPS.apple : MAPS.google;
};

const closeMenu = () => {
  if (!nav || !menuToggle) return;
  nav.classList.remove("is-open");
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
};

const openMenu = () => {
  if (!nav || !menuToggle) return;
  nav.classList.add("is-open");
  nav.classList.add("open");
  menuToggle.setAttribute("aria-expanded", "true");
};

menuToggle?.addEventListener("click", () => {
  const isOpen = nav?.classList.contains("is-open");
  isOpen ? closeMenu() : openMenu();
});

navLinks.forEach((link) => {
  link.addEventListener("click", closeMenu);
});

// Fix iOS viewport height
const setVhUnit = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
};

setVhUnit();
window.addEventListener("resize", setVhUnit, { passive: true });
window.addEventListener("orientationchange", setVhUnit);

// Smooth scroll con compensación por header sticky
scrollLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");
    if (!href?.startsWith("#")) return;

    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();
    const headerHeight = header?.offsetHeight ?? 0;
    const y = target.getBoundingClientRect().top + window.scrollY - headerHeight - 8;

    window.scrollTo({ top: y, behavior: "smooth" });
    closeMenu();
  });
});

const openModal = () => {
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modalConfirm?.focus();
};

const closeModal = () => {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
  pendingCheckoutUrl = "";
};

planButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const details = getPlanDetails(button);
    if (!details) return;

    selectedPlanId = details.id;
    pendingCheckoutUrl = "/api/create-checkout-session";
    renderPlanSummary(details);
    trackEvent("select_plan", { plan_id: details.id, price: details.price });
    openModal();
  });
});

modalConfirm?.addEventListener("click", async () => {
  if (!pendingCheckoutUrl || !selectedPlanId) return closeModal();

  const email = checkoutEmailInput?.value?.trim() || "";
  if (!checkoutEmailInput?.checkValidity()) {
    checkoutEmailInput?.reportValidity();
    return;
  }

  modalConfirm.disabled = true;
  modalConfirm.textContent = "Redirigiendo...";

  try {
    trackEvent("begin_checkout", { plan_id: selectedPlanId, method: "stripe" });
    const { url } = await createCheckoutSession({ planId: selectedPlanId, email });
    if (!url) throw new Error("Checkout no disponible.");
    window.location.href = url;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos iniciar el checkout.";
    showToast(message);
    modalConfirm.disabled = false;
    modalConfirm.textContent = "Continuar al checkout seguro";
  }
});

modalCancel?.addEventListener("click", closeModal);
modalBackdrop?.addEventListener("click", closeModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

// Acordeón FAQ accesible
faqTriggers.forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    const panelId = trigger.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;

    trigger.setAttribute("aria-expanded", String(!expanded));
    if (panel) panel.hidden = expanded;
  });
});

const showToast = (message = "Recibido") => {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;

  window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
};

const trackPurchaseOnThankYou = () => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  const alreadyTracked = window.sessionStorage.getItem("purchase_tracked");
  if (!sessionId || alreadyTracked) return;

  trackEvent("purchase", { session_id: sessionId, currency: "CLP" });
  window.sessionStorage.setItem("purchase_tracked", "1");
};

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;

  if (!(form instanceof HTMLFormElement)) return;
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  form.reset();
  showToast("Recibido");
});

// Tracking CTA principal
ctaInscribirme.forEach((element) => {
  element.addEventListener("click", () => {
    trackEvent("select_plan", { source: "cta_inscribirme" });
  });
});

// Tracking WhatsApp
ctaWhatsapp.forEach((element) => {
  element.addEventListener("click", () => {
    trackEvent("click_whatsapp", { source: "cta" });
  });
});

// Tracking Maps
ctaMaps.forEach((element) => {
  element.addEventListener("click", () => {
    trackEvent("view_location", { method: "maps" });
  });
});

// Tracking Teléfono
ctaPhone.forEach((element) => {
  element.addEventListener("click", () => {
    trackEvent("contact", { method: "phone" });
  });
});

// Botón opcional volver arriba en mobile
const handleToTopVisibility = () => {
  if (!toTopButton) return;
  const show = window.scrollY > 480;
  toTopButton.classList.toggle("visible", show);
};

const closeMenuOnScroll = () => {
  if (!nav?.classList.contains("is-open")) {
    lastScrollY = window.scrollY;
    return;
  }

  const moved = Math.abs(window.scrollY - lastScrollY);
  if (moved > 24) {
    closeMenu();
  }

  lastScrollY = window.scrollY;
};

window.addEventListener(
  "scroll",
  () => {
    handleToTopVisibility();
    closeMenuOnScroll();
  },
  { passive: true }
);
toTopButton?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

setPrimaryMapsLink();
handleToTopVisibility();
trackPurchaseOnThankYou();

(() => {
  const ENDPOINT = "/api/create-checkout-session.js";
  const PLAN_IDS = new Set(["starter", "pro", "elite"]);
  const ctaSelector = ".js-cta-inscribirme";

  const buttons = Array.from(document.querySelectorAll(ctaSelector));
  const emailInput = document.getElementById("email");
  const emailError = document.getElementById("emailError");

  if (!buttons.length) return;

  const setButtonsDisabled = (disabled) => {
    buttons.forEach((button) => {
      button.disabled = disabled;
      button.setAttribute("aria-disabled", String(disabled));
    });
  };

  const showEmailError = (message) => {
    if (!emailError) return;
    emailError.textContent = message || "";
    emailError.style.display = message ? "block" : "none";
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  document.addEventListener(
    "click",
    async (event) => {
      const button = event.target.closest(ctaSelector);
      if (!button) return;

      const planId = (button.getAttribute("data-plan") || "").trim().toLowerCase();
      if (!PLAN_IDS.has(planId)) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      const email = emailInput?.value?.trim() || "";
      if (!isValidEmail(email)) {
        showEmailError("Ingresa un email válido.");
        emailInput?.focus();
        return;
      }

      showEmailError("");
      setButtonsDisabled(true);

      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planId, email }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || "No se pudo iniciar el checkout.");
        }

        if (!data?.url) {
          throw new Error("No se recibió la URL de checkout.");
        }

        window.location.href = data.url;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error inesperado al iniciar checkout.";
        alert(message);
      } finally {
        setButtonsDisabled(false);
      }
    },
    true
  );
})();
