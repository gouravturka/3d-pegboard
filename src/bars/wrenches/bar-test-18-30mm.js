const { buildComb } = require("../../rack");

// Comb bar 2 (test): large double open-end chabbis, gripped by the smaller
// of each pair's two ends and projecting forward from the board.
//
// 24 and 30 carry over their real caliper measurements from the original
// 22-24-30mm proof-of-concept bar. 18 and 20 are PLACEHOLDER guesses - not
// measured yet. The gap is thickness + 0.3mm clearance, tight enough that a
// wrong guess means the tool doesn't fit. Measure those two for real before
// printing.
console.warn(
  "bar-test-18-30mm.js: 18mm and 20mm slot thicknesses are PLACEHOLDERS, not measured - verify with calipers before printing."
);

const slots = [
  { size: 18, thickness: 6.0 }, // 18-19 tool - PLACEHOLDER
  { size: 20, thickness: 6.6 }, // 20-22 tool - PLACEHOLDER
  { size: 24, thickness: 5.97 }, // 24-27 tool - measured
  { size: 30, thickness: 5.83 }, // 30-32 tool - measured
];

const main = () => buildComb(slots);

module.exports = { main };
