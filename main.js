// URL de checkout segura (placeholder)
const CHECKOUT_URL = "CHECKOUT_URL_PLACEHOLDER";

const MAPS = {
  google: "https://www.google.com/maps/search/?api=1&query=Matta+Oriente+408,+%C3%91u%C3%B1oa,+Santiago+de+Chile",
  apple: "http://maps.apple.com/?q=Matta+Oriente+408,+%C3%91u%C3%B1oa,+Santiago+de+Chile",
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
let lastScrollY = window.scrollY;

const getPlanDetails = (button) => {
  const card = button.closest(".plan-card");
  if (!card) return null;

  const planName = card.querySelector(".plan-name")?.textContent?.trim() || "Plan";
  const planPrice = card.querySelector(".price")?.textContent?.replace(/\s+/g, " ")?.trim() || "";
  const includes = Array.from(card.querySelectorAll("ul li")).map((item) => item.textContent.trim()).filter(Boolean);

  return { planName, planPrice, includes };
};

const renderPlanSummary = (details) => {
  if (!details || !modalPlanName || !modalPlanPrice || !modalPlanIncludes) return;

  modalPlanName.textContent = details.planName;
  modalPlanPrice.textContent = details.planPrice;
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
  if (typeof window.fbq === "function" && name === "generate_lead") {
    window.fbq("track", "Lead");
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
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
};

planButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const details = getPlanDetails(button);
    if (!details) return;

    pendingCheckoutUrl = CHECKOUT_URL;
    renderPlanSummary(details);
    openModal();
  });
});

modalConfirm?.addEventListener("click", () => {
  if (!pendingCheckoutUrl) return closeModal();
  window.location.href = pendingCheckoutUrl;
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
    trackEvent("generate_lead", { method: "cta_inscribirme" });
  });
});

// Tracking WhatsApp
ctaWhatsapp.forEach((element) => {
  element.addEventListener("click", () => {
    trackEvent("contact", { method: "whatsapp" });
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
