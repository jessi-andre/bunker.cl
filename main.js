const MAPS = {
  google: "https://www.google.com/maps/search/?api=1&query=Av.+Providencia+1234,+Providencia,+Santiago+de+Chile",
  apple: "http://maps.apple.com/?q=Av.+Providencia+1234,+Providencia,+Santiago+de+Chile",
};

const FALLBACK_PLAN_CATALOG = {
  starter: {
    id: "starter",
    name: "Starter",
    price: "$29.990 CLP / mes",
    includes: ["2 sesiones de entrenamiento semanales", "Evaluación inicial de composición corporal", "Plan de entrenamiento personalizado", "Soporte por WhatsApp"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "$49.990 CLP / mes",
    includes: ["3 sesiones de entrenamiento semanales", "Plan nutricional personalizado con nutricionista", "Seguimiento semanal de métricas y avance", "Ajuste mensual de plan según evolución", "Soporte prioritario por WhatsApp"],
  },
  elite: {
    id: "elite",
    name: "Elite",
    price: "$79.990 CLP / mes",
    includes: ["4 sesiones de entrenamiento semanales", "Nutrición deportiva con seguimiento semanal", "Kinesiología y evaluación funcional mensual", "Revisión integral de progreso", "Acceso directo a todo el equipo"],
  },
};

let PLAN_CATALOG = { ...FALLBACK_PLAN_CATALOG };

const formatPrice = (amount, currency = "CLP", interval = "month") => {
  const formattedAmount = new Intl.NumberFormat("es-CL").format(Number(amount || 0));
  const intervalLabel = interval === "month" ? "mes" : interval;
  return `$${formattedAmount} ${currency} / ${intervalLabel}`;
};

const normalizeRemotePlans = (plans) => {
  if (!Array.isArray(plans) || plans.length === 0) return null;

  const normalized = {};

  plans.forEach((plan) => {
    const planKey = String(plan?.plan_key || "").trim().toLowerCase();
    if (!planKey) return;

    normalized[planKey] = {
      id: planKey,
      name: String(plan?.name || "Plan").trim() || "Plan",
      price: formatPrice(plan?.price_amount, plan?.currency, plan?.billing_interval),
      includes: plan?.description ? [String(plan.description).trim()] : [],
    };
  });

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const loadPublicPlans = async () => {
  try {
    const response = await fetch("/api/public-plans", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("No pudimos cargar los planes.");
    }

    const data = await response.json();
    const normalized = normalizeRemotePlans(data);

    if (normalized) {
      PLAN_CATALOG = normalized;
    }
  } catch (_) {
    PLAN_CATALOG = { ...FALLBACK_PLAN_CATALOG };
  }
};

const applyYogaBranding = () => {
  document.body.classList.add("tenant-yoga");

  const heroEyebrow = document.querySelector(".hero .eyebrow");
  const heroTitle = document.querySelector(".hero h1");
  const heroLead = document.querySelector(".hero .lead");
  const heroPrimaryCta = document.querySelector(".hero .hero-actions .btn-accent");
  const heroImage = document.querySelector(".hero .hero-bg img");

  const navServices = document.querySelector('#menu a[href="#servicios"]');
  const navTeam = document.querySelector('#menu a[href="#equipo"]');
  const navPlans = document.querySelector('#menu a[href="#planes"]:not(.nav-cta)');
  const navPrimaryCta = document.querySelector("#menu .nav-cta");

  if (heroEyebrow) {
    heroEyebrow.textContent = "YOGA ESTUDIO · CLASES Y BIENESTAR";
  }

  if (heroTitle) {
    heroTitle.textContent = "Respira. Conecta. Fluye.";
  }

  if (heroLead) {
    heroLead.textContent =
      "Clases de yoga para reconectar con tu cuerpo, bajar el estrés y encontrar equilibrio en tu rutina.";
  }

  if (heroPrimaryCta) {
    heroPrimaryCta.textContent = "Reservar clase";
  }

  if (heroImage) {
    heroImage.src =
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1600&q=80";
    heroImage.alt = "Practica de yoga en un espacio luminoso y sereno";
  }

  if (navServices) {
    navServices.textContent = "Clases";
  }

  if (navTeam) {
    navTeam.textContent = "Profes";
  }

  if (navPlans) {
    navPlans.textContent = "Membresías";
  }

  if (navPrimaryCta) {
    navPrimaryCta.textContent = "Reservar clase";
  }
};

const applyTenantYogaExperience = (company = {}) => {
  document.body.classList.add("tenant-yoga");

  const companyName = String(company?.name || "Yoga Estudio").trim() || "Yoga Estudio";
  const companyEmail = String(company?.email || "hola@yogaestudio.cl").trim() || "hola@yogaestudio.cl";
  const whatsappNumber = String(company?.whatsapp || "+56911111111").replace(/[^\d]/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}`;

  const logo = document.querySelector(".logo");
  const navServices = document.querySelector('#menu a[href="#servicios"]');
  const navTeam = document.querySelector('#menu a[href="#equipo"]');
  const navPlans = document.querySelector('#menu a[href="#planes"]:not(.nav-cta)');
  const navFaq = document.querySelector('#menu a[href="#faq"]');
  const navLocation = document.querySelector('#menu a[href="#ubicacion"]');
  const navPrimaryCta = document.querySelector("#menu .nav-cta");
  const footerGrid = document.querySelector(".footer-grid");
  const footerBottom = document.querySelector(".footer-bottom");
  const titleDescription = document.querySelector('meta[name="description"]');
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  const twitterDescription = document.querySelector('meta[name="twitter:description"]');

  document.title = `${companyName} | Clases de yoga y bienestar`;

  if (titleDescription) {
    titleDescription.setAttribute(
      "content",
      "Clases de yoga para reconectar con tu cuerpo, bajar el estres y encontrar equilibrio en tu rutina."
    );
  }

  if (ogTitle) ogTitle.setAttribute("content", `${companyName} | Clases y bienestar`);
  if (ogDescription) {
    ogDescription.setAttribute(
      "content",
      "Una experiencia de yoga contemporanea, suave y premium para volver a tu centro."
    );
  }
  if (twitterTitle) twitterTitle.setAttribute("content", `${companyName} | Clases y bienestar`);
  if (twitterDescription) {
    twitterDescription.setAttribute(
      "content",
      "Respira, conecta y fluye con clases de yoga pensadas para tu bienestar."
    );
  }

  if (logo) {
    logo.textContent = companyName;
    logo.setAttribute("aria-label", `${companyName} - Inicio`);
  }

  if (navServices) {
    navServices.textContent = "Inicio";
    navServices.setAttribute("href", "#yoga-intro");
  }

  if (navTeam) {
    navTeam.textContent = "Estudio";
    navTeam.setAttribute("href", "#yoga-studio");
  }

  if (navPlans) {
    navPlans.textContent = "Clases";
    navPlans.setAttribute("href", "#yoga-classes");
  }

  if (navFaq) {
    navFaq.textContent = "Bienestar";
    navFaq.setAttribute("href", "#yoga-benefits");
  }

  if (navLocation) {
    navLocation.textContent = "Contacto";
    navLocation.setAttribute("href", "#yoga-cta");
  }

  if (navPrimaryCta) {
    navPrimaryCta.textContent = "Reservar clase";
    navPrimaryCta.setAttribute("href", whatsappUrl);
    navPrimaryCta.removeAttribute("data-scroll-to");
    navPrimaryCta.setAttribute("target", "_blank");
    navPrimaryCta.setAttribute("rel", "noopener noreferrer");
  }

  document.querySelectorAll(".js-cta-whatsapp").forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    link.href = whatsappUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  document.querySelectorAll(".js-cta-email").forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    link.href = `mailto:${companyEmail}`;
    link.textContent = companyEmail;
  });

  if (footerGrid) {
    footerGrid.innerHTML = `
      <div>
        <p class="footer-brand">${companyName}</p>
        <p class="footer-tagline">Clases de yoga, respiracion y bienestar consciente.</p>
        <div class="footer-links" style="margin-top:1.25rem;">
          <p>Un espacio sereno para volver a ti.</p>
          <p>Practica guiada con sensibilidad, presencia y calma.</p>
        </div>
      </div>
      <div>
        <p class="footer-col-title">Contacto</p>
        <div class="footer-links">
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="js-cta-whatsapp">WhatsApp</a>
          <a href="mailto:${companyEmail}" class="js-cta-email">${companyEmail}</a>
          <a href="#yoga-studio">Sobre el estudio</a>
        </div>
      </div>
      <div>
        <p class="footer-col-title">Explora</p>
        <div class="footer-links">
          <a href="#yoga-classes">Clases</a>
          <a href="#yoga-benefits">Bienestar</a>
          <a href="#yoga-cta">Reservar clase</a>
        </div>
      </div>
    `;
  }

  if (footerBottom) {
    footerBottom.innerHTML = `
      <span>© 2026 ${companyName}. Todos los derechos reservados.</span>
      <div class="footer-legal-links">
        <a href="terminos.html">Términos</a>
        <a href="privacidad.html">Privacidad</a>
        <a href="portal.html">Gestionar o cancelar membresía</a>
      </div>
    `;
  }
};

const loadTenantBranding = async () => {
  try {
    const response = await fetch("/api/test-tenant", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) return;

    const data = await response.json();
    const tenantSlug = String(data?.company?.slug || "").trim().toLowerCase();

    if (tenantSlug === "yoga") {
      applyTenantYogaExperience(data?.company || {});
    }
  } catch (_) {}
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
const modalStepTitle = document.getElementById("modal-step-title");
const modalEmailBlock = document.getElementById("modal-email-block");
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

let selectedPlanId = "";
let lastScrollY = window.scrollY;
let lastMenuToggleAt = 0;
let checkoutStepReady = false;

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

const createCheckoutSession = async ({ plan, email }) => {
  const response = await fetch("/api/public-create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan, email }),
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
  menuToggle.classList.remove("is-open");
  menuToggle.setAttribute("aria-label", "Abrir menú");
  menuToggle.setAttribute("aria-expanded", "false");
};

const openMenu = () => {
  if (!nav || !menuToggle) return;
  nav.classList.add("is-open");
  nav.classList.add("open");
  menuToggle.classList.add("is-open");
  menuToggle.setAttribute("aria-label", "Cerrar menú");
  menuToggle.setAttribute("aria-expanded", "true");
};

const toggleMenu = (event) => {
  if (!nav || !menuToggle) return;

  // Avoid duplicate click/touch toggles on some mobile browsers.
  const now = Date.now();
  if (now - lastMenuToggleAt < 300) return;
  lastMenuToggleAt = now;

  if (event?.cancelable) event.preventDefault();
  event?.stopPropagation?.();

  const isOpen = nav?.classList.contains("is-open");
  isOpen ? closeMenu() : openMenu();
};

menuToggle?.addEventListener("click", toggleMenu);
menuToggle?.addEventListener("touchend", toggleMenu, { passive: false });

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
  checkoutStepReady = false;
  if (modalStepTitle) {
    modalStepTitle.textContent = "Paso 1 de 2: resumen de inscripción";
  }
  if (modalEmailBlock) {
    modalEmailBlock.hidden = true;
  }
  if (checkoutEmailInput) {
    checkoutEmailInput.value = "";
  }
  if (modalConfirm) {
    modalConfirm.textContent = "Continuar";
    modalConfirm.disabled = false;
    modalConfirm.focus();
  }
};

const closeModal = () => {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
  checkoutStepReady = false;
};

planButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const details = getPlanDetails(button);
    if (!details) return;

    selectedPlanId = details.id;
    renderPlanSummary(details);
    trackEvent("select_plan", { plan_id: details.id, price: details.price });
    openModal();
  });
});

modalConfirm?.addEventListener("click", async () => {
  if (!selectedPlanId) return closeModal();

  if (!checkoutStepReady) {
    checkoutStepReady = true;
    if (modalStepTitle) {
      modalStepTitle.textContent = "Paso 2 de 2: confirmá tu email y continuá al pago";
    }
    if (modalEmailBlock) {
      modalEmailBlock.hidden = false;
    }
    modalConfirm.textContent = "Continuar al pago";
    checkoutEmailInput?.focus();
    return;
  }

  const email = checkoutEmailInput?.value?.trim() || "";
  if (!checkoutEmailInput?.checkValidity()) {
    checkoutEmailInput?.reportValidity();
    return;
  }

  modalConfirm.disabled = true;
  modalConfirm.textContent = "Redirigiendo...";

  try {
    trackEvent("begin_checkout", { plan_id: selectedPlanId, method: "stripe" });
    const { url } = await createCheckoutSession({ plan: selectedPlanId, email });
    if (!url) throw new Error("Checkout no disponible.");
    window.location.href = url;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos iniciar el checkout.";
    showToast(message);
    modalConfirm.disabled = false;
    modalConfirm.textContent = "Continuar al pago";
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
loadPublicPlans();

document.addEventListener("DOMContentLoaded", () => {
  loadTenantBranding();
});
