document.addEventListener('DOMContentLoaded', () => {
  initLanguageToggle();
  initPlanToggles();
  initPromoCode();
  initScrollAnimations();
  initMobileMenu();
  initPromoBanner();
  renderPlan();
});

/* ==========================================================================
   Promo Banner Logic
   ========================================================================== */
function initPromoBanner() {
  const closeBtn = document.querySelector('.close-banner');
  const banner = document.querySelector('.promo-banner');
  
  if (closeBtn && banner) {
    closeBtn.addEventListener('click', () => {
      banner.style.display = 'none';
    });
  }
}

/* ==========================================================================
   Language Toggle Logic
   ========================================================================== */
function initLanguageToggle() {
  const langBtns = document.querySelectorAll('.lang-btn');
  let currentLang = localStorage.getItem('baja_lang') || 'es';

  // Apply initially
  setLanguage(currentLang);

  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      setLanguage(lang);
    });
  });
}

function setLanguage(lang) {
  localStorage.setItem('baja_lang', lang);
  
  // Update buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (I18N[lang] && I18N[lang][key]) {
      el.textContent = I18N[lang][key];
    }
  });

  // Update elements with data-i18n-html
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (I18N[lang] && I18N[lang][key]) {
      el.innerHTML = I18N[lang][key];
    }
  });

  // The plan card renders currency/period labels dynamically, so refresh it
  // whenever the language changes (guarded — only present on the pricing page).
  if (typeof renderPlan === 'function') renderPlan();
}

/* ==========================================================================
   Single-Plan Pricing Engine — "Consultorio Completo"
   --------------------------------------------------------------------------
   One offer: website + AI receptionist + WhatsApp reminders + win-backs.
   - Monthly and annual (annual = pay for 10 months, i.e. 2 months free).
   - MXN and USD carry their own clean values; we never convert one to the other.
   - The founder code waives the one-time setup fee only (not the monthly).
   ========================================================================== */
const PLAN = {
  monthlyMxn: 8900, monthlyUsd: 499,
  setupMxn: 8900,   setupUsd: 499,
  annualMonthsCharged: 10 // 12 - 2 free
};
const FOUNDER_CODE = 'FUNDADOR';

let planBilling = 'monthly'; // 'monthly' | 'annual'
let planCurrency = 'usd';    // 'mxn' | 'usd' — we bill in USD, so USD is the default display
let setupWaived = false;

function money(value, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0
  }).format(value);
}

function planStr(key) {
  const lang = localStorage.getItem('baja_lang') || 'es';
  return (window.I18N && window.I18N[lang] && window.I18N[lang][key]) || key;
}

function renderPlan() {
  const amountEl = document.getElementById('plan-amount');
  if (!amountEl) return; // not on the pricing page

  const periodEl = document.getElementById('plan-period');
  const annualNoteEl = document.getElementById('plan-annual-note');
  const setupOriginalEl = document.getElementById('setup-original');
  const setupFreeEl = document.getElementById('setup-free');

  const cur = planCurrency.toUpperCase();
  const monthly = planCurrency === 'usd' ? PLAN.monthlyUsd : PLAN.monthlyMxn;

  if (planBilling === 'annual') {
    const annualTotal = monthly * PLAN.annualMonthsCharged;
    const effectiveMonthly = annualTotal / 12;
    amountEl.textContent = money(annualTotal, planCurrency);
    if (periodEl) periodEl.textContent = `${cur} ${planStr('per_year')}`;
    if (annualNoteEl) {
      annualNoteEl.textContent = planStr('annual_note').replace('{eff}', money(effectiveMonthly, planCurrency));
      annualNoteEl.style.display = 'block';
    }
  } else {
    amountEl.textContent = money(monthly, planCurrency);
    if (periodEl) periodEl.textContent = `${cur} ${planStr('per_month')}`;
    if (annualNoteEl) annualNoteEl.style.display = 'none';
  }

  // Setup fee (one-time). Founder code strikes it through and reveals FREE.
  if (setupOriginalEl) {
    const setup = planCurrency === 'usd' ? PLAN.setupUsd : PLAN.setupMxn;
    setupOriginalEl.textContent = `${money(setup, planCurrency)} ${cur}`;
    setupOriginalEl.classList.toggle('struck', setupWaived);
  }
  if (setupFreeEl) setupFreeEl.classList.toggle('hidden', !setupWaived);
}

function initPlanToggles() {
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  if (toggleBtns.length === 0) return;

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.toggleType; // 'billing' | 'currency'
      const val = btn.dataset.toggleVal;

      btn.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (type === 'billing') planBilling = val;
      if (type === 'currency') planCurrency = val;

      renderPlan();
    });
  });
}

/* ==========================================================================
   Founder Code — waives the one-time setup fee
   ========================================================================== */
function initPromoCode() {
  const btn = document.getElementById('promo-code-btn');
  const input = document.getElementById('promo-code-input');
  const msg = document.getElementById('promo-message');

  if (!btn || !input || !msg) return;

  function applyPromoCode() {
    const code = input.value.trim().toUpperCase();

    if (code === FOUNDER_CODE) {
      setupWaived = true;
      msg.textContent = planStr('promo_applied');
      msg.style.color = 'var(--primary-cyan)';
    } else {
      setupWaived = false;
      msg.textContent = planStr('promo_invalid');
      msg.style.color = '#ef4444';
    }
    renderPlan();
  }

  btn.addEventListener('click', applyPromoCode);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyPromoCode();
  });
}

/* ==========================================================================
   Scroll Animations & Sticky Header
   ========================================================================== */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  // Scroll reveal
  document.querySelectorAll('.fade-in-up').forEach(el => {
    observer.observe(el);
  });
  
  // Parallax effect
  const parallaxEl = document.getElementById('hero-parallax');

  // Sticky header background
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    // Navbar styling
    if (window.scrollY > 50) {
      navbar.style.background = 'rgba(5, 8, 15, 0.95)';
      navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
    } else {
      navbar.style.background = 'rgba(5, 8, 15, 0.85)';
      navbar.style.boxShadow = 'none';
    }

    // Parallax update
    if (parallaxEl) {
      const scrollPos = window.scrollY;
      parallaxEl.style.transform = `translateY(${scrollPos * 0.4}px)`;
    }
  });
}

/* ==========================================================================
   Mobile Menu
   ========================================================================== */
function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      // Very basic toggle, you might want to expand this to a full overlay menu
      if (navLinks.style.display === 'flex') {
        navLinks.style.display = 'none';
      } else {
        navLinks.style.display = 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '100%';
        navLinks.style.left = '0';
        navLinks.style.width = '100%';
        navLinks.style.background = 'var(--bg-deep)';
        navLinks.style.padding = '20px';
        navLinks.style.borderBottom = '1px solid var(--border-hairline)';
      }
    });
  }
}
