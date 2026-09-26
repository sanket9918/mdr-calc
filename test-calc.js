/**
 * Verification test suite for UPI MDR Calculator
 * Defaulting to revised post-15 Oct framework
 * Run with: node test-calc.js
 */

const assert = require('assert');

function calculateMDR(amount, category) {
  const amountPaise = Math.round(amount * 100);

  if (category === 'p2pm') return 0;
  if (amount <= 2000) return 0;
  if (category === 'essential') return 5.00;

  if (category === 'capital_markets') {
    const calculatedPaise = Math.round((amountPaise * 2) / 10000);
    const cappedPaise = Math.min(30000, calculatedPaise);
    return cappedPaise / 100;
  }

  // Standard P2M: 0.40%, capped at 30,000 paise (₹300)
  const calculatedPaise = Math.round((amountPaise * 4) / 1000);
  const cappedPaise = Math.min(30000, calculatedPaise);
  return cappedPaise / 100;
}

console.log('Testing UPI MDR calculations (Active Framework)...');

// 1. Standard P2M tests
assert.strictEqual(calculateMDR(2000, 'standard'), 0, '₹2,000 cutoff should be ₹0');
assert.strictEqual(calculateMDR(2001, 'standard'), 8.00, '₹2,001 should be 0.4% = ₹8.00 (govt calculation)');
assert.strictEqual(calculateMDR(3000, 'standard'), 12.00, '₹3,000 should be ₹12.00');
assert.strictEqual(calculateMDR(75000, 'standard'), 300.00, '₹75,000 reaches ₹300 cap');
assert.strictEqual(calculateMDR(100000, 'standard'), 300.00, '₹1,00,000 should be capped at ₹300');

// 2. Essential sector tests
assert.strictEqual(calculateMDR(2000, 'essential'), 0, 'Essential ₹2,000 should be ₹0');
assert.strictEqual(calculateMDR(2001, 'essential'), 5.00, 'Essential ₹2,001 should be ₹5.00');
assert.strictEqual(calculateMDR(50000, 'essential'), 5.00, 'Essential ₹50,000 should be ₹5.00');

// 3. Capital markets tests
assert.strictEqual(calculateMDR(2000, 'capital_markets'), 0, 'Capital markets ₹2,000 should be ₹0');
assert.strictEqual(calculateMDR(50000, 'capital_markets'), 10.00, 'Capital markets ₹50,000 should be ₹10.00');
assert.strictEqual(calculateMDR(15000000, 'capital_markets'), 300.00, 'Capital markets ₹1.5Cr reaches ₹300 cap');

// 4. P2PM Small Merchant tests (all ₹0)
assert.strictEqual(calculateMDR(500, 'p2pm'), 0, 'P2PM ₹500 should be ₹0');
assert.strictEqual(calculateMDR(2001, 'p2pm'), 0, 'P2PM ₹2,001 should be ₹0');
assert.strictEqual(calculateMDR(100000, 'p2pm'), 0, 'P2PM ₹1,00,000 should be ₹0');

console.log('✓ All 12 framework test cases passed successfully!');
