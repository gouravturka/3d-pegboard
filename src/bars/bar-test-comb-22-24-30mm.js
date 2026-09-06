const { buildComb } = require("../rack");

// Comb test: double open-end chabbis, hung by the smaller of each pair's two
// ends. Thickness = measured blade thickness at that end (mm).
const slots = [
  { size: 22, thickness: 5.0 }, // 22-24 tool
  { size: 24, thickness: 5.97 }, // 24-27 tool
  { size: 30, thickness: 5.83 }, // 30-32 tool
];

const main = () => buildComb(slots);

module.exports = { main };
