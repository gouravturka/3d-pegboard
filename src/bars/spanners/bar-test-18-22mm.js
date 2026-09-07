const { buildRack, engraveLabel } = require("../rack");

// Bar 3 (test): 18mm and 22mm spanners hung on L-hooks instead of hex bosses
// (easier on/off), with an engraved "18-22" label. Same outerSize-based
// spacing as the hex design - kept conservative even though a dangling tool
// likely needs less side clearance than a snug hex fit.
const postSizes = [
  { acrossFlats: 18.0, outerSize: 27.53 },
  { acrossFlats: 22.0, outerSize: 32.0 },
];

const main = () => {
  const bar = buildRack(postSizes, { postSpacing: 22.0, sideMargin: 12.0, postStyle: "hook" });
  return engraveLabel(bar, "18-22");
};

module.exports = { main };
