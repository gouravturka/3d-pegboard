const { buildRack } = require("../rack");

// Bar 1: small single spanners 6-10mm plus combo spanners 12-13, 16-17
// (tight spacing baseline; combo entries self-override via outerSize)
const postSizes = [
  6.0,
  7.0,
  8.0,
  9.0,
  10.0,
  { acrossFlats: 12.0, outerSize: 20.0 }, // 12-13 tool
  { acrossFlats: 13.0, outerSize: 20.0 }, // 12-13 tool
  { acrossFlats: 16.0, outerSize: 25.6 }, // 16-17 tool
  { acrossFlats: 17.0, outerSize: 25.6 }, // 16-17 tool
];

const main = () =>
  buildRack(postSizes, { postSpacing: 22.0, sideMargin: 12.0, postStyle: "hook" });

module.exports = { main };
