const { buildComb } = require("../../rack");

// Comb bar 1 (test): small double open-end chabbis, gripped by the smaller
// of each pair's two ends and projecting forward from the board.
//
// PLACEHOLDER THICKNESS VALUES - none of these have been measured with
// calipers yet. They're rough linear guesses just to get the layout/code in
// place; the gap is thickness + 0.3mm clearance, tight enough that a wrong
// guess means the tool doesn't fit. Measure each blade for real and replace
// these before printing.
console.warn(
  "bar-test-6-16mm.js: slot thicknesses are PLACEHOLDERS, not measured - verify with calipers before printing.",
);

const slots = [
  { size: 6, thickness: 2.8 }, // 6-7 tool - PLACEHOLDER
  { size: 8, thickness: 3.4 }, // 8-9 tool - PLACEHOLDER
  { size: 10, thickness: 4.0 }, // 10-11 tool - PLACEHOLDER
  { size: 12, thickness: 4.6 }, // 12-13 tool - PLACEHOLDER
  { size: 14, thickness: 5.1 }, // 14-15 tool - PLACEHOLDER
  { size: 16, thickness: 5.6 }, // 16-17 tool - PLACEHOLDER
];

const main = () => buildComb(slots);

// doing some changes here
module.exports = { main };
