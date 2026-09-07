const { buildRack } = require("../../rack");

// Bar 2: combo spanners 18-19, 19-22, 24-27 (shared "19" post serves both
// the 18-19 and 19-22 tools)
const postSizes = [
  { acrossFlats: 18.0, outerSize: 27.53 }, // 18-19 tool
  { acrossFlats: 19.0, outerSize: 32.0 }, // shared with 19-22 tool, larger size used
  { acrossFlats: 22.0, outerSize: 32.0 }, // 19-22 tool
  { acrossFlats: 24.0, outerSize: 34.86 }, // 24-27 tool
  { acrossFlats: 27.0, outerSize: 34.86 }, // 24-27 tool
];

const main = () =>
  buildRack(postSizes, { postSpacing: 22.0, sideMargin: 12.0, postStyle: "hook" });

module.exports = { main };
