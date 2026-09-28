/**
 * UPI MDR Calculator (Merchant P2M)
 * Spec-compliant calculation under 2026 MDR framework
 */

(function () {
  'use strict';

  const STORAGE_KEY_THEME = 'upi-mdr-theme-preference';
  const MAX_AMOUNT = 1000000000;

  // DOM Elements
  const amountInput = document.getElementById('amount-input');
  let lastValidAmount = amountInput.value;
  const categoryInputs = document.querySelectorAll('input[name="merchant-category"]');
  const themeInputs = document.querySelectorAll('input[name="theme-mode"]');
  const presetChips = document.querySelectorAll('.preset-chips .chip');

  // Result Elements
  const mdrValueEl = document.getElementById('mdr-value');
  const rateTagEl = document.getElementById('rate-tag');
  const netValueEl = document.getElementById('net-value');
  const capValueEl = document.getElementById('cap-value');
  const explanationTextEl = document.getElementById('explanation-text');
  const mdrAriaEl = document.getElementById('mdr-aria-announcement');
  const resultContainerEl = document.querySelector('.result-container');

  // Indian currency formatters
  const inrFormatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const inrIntFormatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  });

  function formatINR(val, includeDecimals = true) {
    if (isNaN(val) || val === null) return '0.00';
    return includeDecimals ? inrFormatter.format(val) : inrIntFormatter.format(val);
  }

  function normalizeAmount(str) {
    const value = String(str).replace(/,/g, '').replace(/^0+(?=\d)/, '');
    if (!/^\d*(?:\.\d{0,2})?$/.test(value)) return null;
    return Number(value) > MAX_AMOUNT ? String(MAX_AMOUNT) : value;
  }

  function parseAmount(str) {
    return Number(normalizeAmount(str)) || 0;
  }

  /**
   * Calculate MDR under the revised 2026 framework
   * Uses exact integer paise to prevent floating-point drift
   */
  function calculateMDR(amount, category) {
    const amountPaise = Math.round(amount * 100);

    // 1. P2PM Small Merchant exemption
    if (category === 'p2pm') {
      return {
        mdrPaise: 0,
        rateLabel: '0.00%',
        explanation: 'Small merchants (P2PM, ≤ ₹1L monthly) enjoy ₹0 MDR on all transactions.',
        capPaise: 0
      };
    }

    // 2. Cutoff: Transactions ≤ ₹2,000 are strictly free
    if (amount <= 2000) {
      return {
        mdrPaise: 0,
        rateLabel: '0.00%',
        explanation: 'Payments up to ₹2,000 remain completely free of MDR.',
        capPaise: category === 'essential' ? 500 : 30000
      };
    }

    // 3. Essential sector: flat ₹5
    if (category === 'essential') {
      return {
        mdrPaise: 500, // ₹5.00
        rateLabel: 'Flat ₹5.00',
        explanation: 'Flat ₹5 applies to listed essential sectors (railways, telecom, fuel, etc.) above ₹2,000.',
        capPaise: 500
      };
    }

    // 4. Capital markets: 0.02%, capped at ₹300
    if (category === 'capital_markets') {
      const calculatedPaise = Math.round((amountPaise * 2) / 10000);
      const cappedPaise = Math.min(30000, calculatedPaise);
      const isCapped = calculatedPaise >= 30000;

      return {
        mdrPaise: cappedPaise,
        rateLabel: isCapped ? '0.02% (₹300 Cap)' : '0.02%',
        explanation: isCapped
          ? 'Capital markets MDR reaches statutory ₹300 maximum cap.'
          : 'Capital markets rate: 0.02% applies to mutual funds and securities above ₹2,000.',
        capPaise: 30000
      };
    }

    // 5. Standard Merchant: 0.40%, capped at ₹300 (at ₹75,000+)
    const calculatedPaise = Math.round((amountPaise * 4) / 1000);
    const cappedPaise = Math.min(30000, calculatedPaise);
    const isCapped = amount >= 75000 || calculatedPaise >= 30000;

    return {
      mdrPaise: cappedPaise,
      rateLabel: isCapped ? '0.40% (₹300 Cap)' : '0.40%',
      explanation: isCapped
        ? 'Standard P2M transactions reach statutory ₹300 maximum cap at ₹75,000 and above.'
        : 'Standard rate of 0.40% applies to merchant transactions above ₹2,000.',
      capPaise: 30000
    };
  }

  function updateCalculator() {
    const rawAmount = parseAmount(amountInput.value);
    let selectedCategory = 'standard';

    for (const radio of categoryInputs) {
      if (radio.checked) {
        selectedCategory = radio.value;
        break;
      }
    }

    const result = calculateMDR(rawAmount, selectedCategory);
    const mdrInRupees = result.mdrPaise / 100;
    const amountInPaise = Math.round(rawAmount * 100);
    const netPaise = Math.max(0, amountInPaise - result.mdrPaise);
    const netInRupees = netPaise / 100;

    // Update Result
    mdrValueEl.textContent = formatINR(mdrInRupees);
    rateTagEl.textContent = result.rateLabel;
    netValueEl.textContent = '₹' + formatINR(netInRupees);
    capValueEl.textContent = result.capPaise > 0 ? '₹' + formatINR(result.capPaise / 100) : 'None';
    explanationTextEl.textContent = result.explanation;

    const grossValueEl = document.getElementById('gross-value');
    if (grossValueEl) {
      grossValueEl.textContent = '₹' + formatINR(rawAmount);
    }

    const feeBreakdownEl = document.getElementById('fee-breakdown-value');
    if (feeBreakdownEl) {
      feeBreakdownEl.textContent = mdrInRupees > 0 ? '-₹' + formatINR(mdrInRupees) : '₹0.00';
    }

    // Update result state
    if (resultContainerEl) {
      if (result.mdrPaise === 0) {
        resultContainerEl.classList.add('state-zero');
        resultContainerEl.classList.remove('state-fee');
      } else {
        resultContainerEl.classList.add('state-fee');
        resultContainerEl.classList.remove('state-zero');
      }
    }

    mdrAriaEl.setAttribute(
      'aria-label',
      `Estimated MDR is ₹${formatINR(mdrInRupees)}. Net settlement is ₹${formatINR(netInRupees)}.`
    );
    lastValidAmount = amountInput.value;
  }

  function formatAmountFieldOnBlur() {
    const val = parseAmount(amountInput.value);
    if (val > 0) {
      amountInput.value = formatINR(val, val % 1 !== 0);
    }
  }

  function isKolkataNightTime() {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hourCycle: 'h23'
      }).formatToParts(now);

      const hourPart = parts.find((p) => p.type === 'hour');
      if (hourPart) {
        const hour = parseInt(hourPart.value, 10);
        return hour >= 18 || hour < 6;
      }
    } catch (e) {
      console.warn('Fallback to local time:', e);
    }
    const localHour = new Date().getHours();
    return localHour >= 18 || localHour < 6;
  }

  function applyTheme(preference) {
    let resolvedTheme = 'light';

    if (preference === 'light') {
      resolvedTheme = 'light';
    } else if (preference === 'dark') {
      resolvedTheme = 'dark';
    } else {
      resolvedTheme = isKolkataNightTime() ? 'dark' : 'light';
    }

    if (resolvedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function initTheme() {
    const savedPref = localStorage.getItem(STORAGE_KEY_THEME) || 'system';
    const radio = document.querySelector(`input[name="theme-mode"][value="${savedPref}"]`);
    if (radio) radio.checked = true;

    applyTheme(savedPref);

    themeInputs.forEach((input) => {
      input.addEventListener('change', (e) => {
        const pref = e.target.value;
        localStorage.setItem(STORAGE_KEY_THEME, pref);
        applyTheme(pref);
      });
    });

    setInterval(() => {
      const currentPref = localStorage.getItem(STORAGE_KEY_THEME) || 'system';
      if (currentPref === 'system') {
        applyTheme('system');
      }
    }, 30000);
  }

  function init() {
    // Amount listeners
    amountInput.addEventListener('beforeinput', (event) => {
      if (event.data === null || event.isComposing) return;
      const nextValue = amountInput.value.slice(0, amountInput.selectionStart)
        + event.data + amountInput.value.slice(amountInput.selectionEnd);
      if (normalizeAmount(nextValue) === null) event.preventDefault();
    });
    amountInput.addEventListener('input', () => {
      const value = normalizeAmount(amountInput.value);
      amountInput.value = value === null ? lastValidAmount : value;
      updateCalculator();
    });
    amountInput.addEventListener('blur', formatAmountFieldOnBlur);
    amountInput.addEventListener('focus', () => {
      const raw = parseAmount(amountInput.value);
      if (raw > 0) {
        amountInput.value = String(raw);
        amountInput.select();
      }
      lastValidAmount = amountInput.value;
    });

    // Category listeners
    categoryInputs.forEach((radio) => {
      radio.addEventListener('change', updateCalculator);
    });

    // Preset chips
    presetChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const amt = chip.getAttribute('data-amount');
        if (amt) {
          amountInput.value = formatINR(parseFloat(amt), false);
          updateCalculator();
        }
      });
    });

    initTheme();
    updateCalculator();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
