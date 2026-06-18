document.addEventListener('DOMContentLoaded', () => {
  initLanguageToggle();
  initPricingToggles();
  initPromoCode();
  initScrollAnimations();
  initMobileMenu();
  initPromoBanner();
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
}

/* ==========================================================================
   Pricing Toggles Logic
   ========================================================================== */
const ANNUAL_DISCOUNT = 0.8; // 20% discount on monthly when billed annually
let currentPromoMultiplier = 1.0; // 1.0 means no discount

function initPricingToggles() {
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  if (toggleBtns.length === 0) return;

  // Initial State
  let currentBilling = 'monthly';
  let currentCurrency = 'mxn';

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.toggleType; // 'billing' or 'currency'
      const val = btn.dataset.toggleVal;   // 'monthly'/'annual' or 'mxn'/'usd'

      // Update active class within the group
      btn.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (type === 'billing') currentBilling = val;
      if (type === 'currency') currentCurrency = val;

      updatePrices(currentBilling, currentCurrency);
    });
  });
}

function updatePrices(billing, currency) {
  document.querySelectorAll('[data-price-mxn]').forEach(el => {
    const isOneTime = el.hasAttribute('data-one-time');
    const noPromo = el.hasAttribute('data-no-promo'); // e.g. standalone AI plan — never discounted

    // Each price carries its own clean MXN and USD value — we never convert one
    // currency into the other, so both stay round numbers (e.g. $900 MXN ↔ $49 USD).
    let price = currency === 'usd'
      ? parseFloat(el.dataset.priceUsd)
      : parseFloat(el.dataset.priceMxn);

    // Apply Annual Discount only to recurring prices
    if (billing === 'annual' && !isOneTime) {
      price = price * ANNUAL_DISCOUNT;
    }

    // Apply Promo Code Discount (skipped for plans flagged data-no-promo)
    if (!noPromo) {
      price = price * currentPromoMultiplier;
    }

    // Formatting — narrowSymbol renders both MXN and USD as "$"; the suffix
    // label (MXN / USD) disambiguates which currency it is.
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0
    });

    el.textContent = formatter.format(price);
  });
  
  // Update currency suffixes
  document.querySelectorAll('.currency-suffix').forEach(el => {
    const period = billing === 'annual' ? '/mes (anual)' : '/mes';
    el.textContent = `${currency.toUpperCase()} ${period}`;
  });

  document.querySelectorAll('.currency-suffix-onetime').forEach(el => {
    el.textContent = `${currency.toUpperCase()}`;
  });
}

/* ==========================================================================
   Promo Code Logic
   ========================================================================== */
function initPromoCode() {
  const btn = document.getElementById('promo-code-btn');
  const input = document.getElementById('promo-code-input');
  const msg = document.getElementById('promo-message');
  
  if (!btn || !input || !msg) return;

  function applyPromoCode() {
    const code = input.value.trim().toUpperCase();
    const currentLang = localStorage.getItem('baja_lang') || 'es';

    if (code === 'MEX80OFF') {
      currentPromoMultiplier = 0.2; // 80% discount
      msg.textContent = window.I18N && window.I18N[currentLang] ? window.I18N[currentLang]['promo_applied'] : 'Discount applied!';
      msg.style.color = 'var(--primary-cyan)';
    } else {
      currentPromoMultiplier = 1.0;
      msg.textContent = window.I18N && window.I18N[currentLang] ? window.I18N[currentLang]['promo_invalid'] : 'Invalid code.';
      msg.style.color = '#ef4444';
    }

    // Pages may have only a currency toggle (e.g. AI plans) and no billing toggle,
    // so fall back to sensible defaults instead of skipping the price refresh.
    const activeBillingEl = document.querySelector('[data-toggle-type="billing"].active');
    const activeCurrencyEl = document.querySelector('[data-toggle-type="currency"].active');
    const billing = activeBillingEl ? activeBillingEl.dataset.toggleVal : 'monthly';
    const currency = activeCurrencyEl ? activeCurrencyEl.dataset.toggleVal : 'mxn';
    updatePrices(billing, currency);
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
