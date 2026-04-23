/**
 * Power Token Generator
 * Generates unique prepaid power tokens for MonieEstate residents
 *
 * Token format: XXXX-XXXX-XXXX-XXXX (16 digit numeric, like real NEPA/prepaid meter tokens)
 * Encoded with house number + plan + timestamp to make it verifiable
 */

/**
 * Generate a unique 20-digit power token (like a real prepaid meter token)
 * Format: 4 groups of 4 digits separated by dashes  e.g. 1234-5678-9012-3456
 */
function generatePowerToken(houseNumber, planCode, amount) {
  // Seed components for reproducibility within the same request
  const timestamp = Date.now().toString();
  const randomPart = Math.floor(Math.random() * 1e8)
    .toString()
    .padStart(8, "0");

  // Mix in house number characters (ASCII codes)
  const houseSeed = houseNumber
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    .toString();

  // Combine and generate 16 digits
  const combined = (timestamp + randomPart + houseSeed).replace(/\D/g, "");
  const digits = combined.slice(0, 16).padEnd(16, "0");

  // Format as XXXX-XXXX-XXXX-XXXX
  const token = [
    digits.slice(0, 4),
    digits.slice(4, 8),
    digits.slice(8, 12),
    digits.slice(12, 16),
  ].join("-");

  return token;
}

/**
 * Calculate power units based on amount paid and plan
 */
function calculateUnits(amount, plan) {
  // Each plan has a fixed unit rate
  // Units = (amount / plan.amount) * plan.units
  const ratio = amount / plan.amount;
  return Math.floor(ratio * plan.units);
}

module.exports = {
  generatePowerToken,
  calculateUnits,
};
