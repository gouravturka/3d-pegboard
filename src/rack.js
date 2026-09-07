const { cuboid, cylinder, roundedCylinder, circle, sphere } = require("@jscad/modeling").primitives;
const { union, subtract } = require("@jscad/modeling").booleans;
const { hull } = require("@jscad/modeling").hulls;
const { translate, rotateX } = require("@jscad/modeling").transforms;
const { vectorText } = require("@jscad/modeling").text;
const { extrudeLinear } = require("@jscad/modeling").extrusions;
const { measureBoundingBox } = require("@jscad/modeling").measurements;

// --- Pegboard Mounting Pin Constants ---
const BOARD_PEG_BASE_DIA = 5.4; // Constant shaft dia, snug fit in 5.4mm hole
const BOARD_PEG_LEN = 8.8; // Total pin length, fits 9mm hole depth
const BOARD_PEG_NOSE_FILLET_RADIUS = 2.7; // Rounded (domed) front tip for easy insertion
const PEG_PITCH = 75.0; // Grid spacing between mounting pins

// --- Rail & Front Hanging Post Constants ---
const BAR_THICK = 8.0; // Baseplate thickness
const BAR_HEIGHT = 22.0; // Baseplate height
const POST_LENGTH = 25.0; // Front post projection length
const HEX_UNDERSIZE = 1.0; // mm, actual hex made this much smaller than nominal so it isn't an exact fit
const POST_SPACING = 35.0; // Fallback distance between posts when outer size is unknown
const SIDE_MARGIN = 20.0; // Fallback margin from bar end when outer size is unknown
const SPANNER_CLEARANCE = 5.0; // Min gap between adjacent spanner heads when hung
const PEG_MIN_SLACK = 20.0; // mm, min extra room beyond one PEG_PITCH step so a bar always fits >=2 board pegs
const MAX_PRINT_LENGTH = 250.0; // mm, safe usable length on a Bambu Lab A1's 256x256mm bed (leaves a few mm margin for brim/skirt) - split a tool list across multiple bar files if it would exceed this

// --- Hook Post Constants (alternative to the hex post, easier on/off) ---
const HOOK_ROD_RADIUS = 3.0; // mm
const HOOK_ARM_LENGTH = 22.0; // mm, horizontal reach before the downward bend
const HOOK_DROP_LENGTH = 12.0; // mm, downward lip that stops the tool sliding off the tip
const HOOK_TILT = Math.PI / 2 + (5 * Math.PI) / 180; // same tilt as the hex post, for consistent mounting

// --- Comb (blade-slot) Holder Constants ---
// The wrench lies on its side and projects forward (Y), out from the board,
// rather than hanging down - gripped edge-on between two teeth by its blade
// thickness (X), resting by gravity on the shared Z=0 floor.
const COMB_BASE_HEIGHT = 12.0; // mm, flat baseplate strip the teeth are rooted in
const TOOTH_THICKNESS = 6.0; // mm, divider width (X) between adjacent slots
const TOOTH_HEIGHT = 25.0; // mm, tooth height (Z) - must cover the tallest wrench face's width among the slots, or the tool is unsupported top/bottom in the slot
const TOOTH_REACH = 65.0; // mm, how far each tooth reaches forward (Y), away from the board - must cover the tallest wrench face's length among the slots (measured 30-32 face: ~59.86-62.87mm), or the flare cantilevers unsupported past the tooth
const GAP_CLEARANCE = 0.3; // mm, added to each slot's measured blade thickness for easy insertion

// --- Engraved Label Constants ---
const ENGRAVE_CHAR_HEIGHT = 4.0; // mm, kept under BAR_THICK so it fits the top face
const ENGRAVE_STROKE_WIDTH = 0.7; // mm
const ENGRAVE_DEPTH = 0.6; // mm, recessed into the top face

// --- Per-Post Size Label Constants (smaller: posts are narrower than the bar) ---
const POST_LABEL_CHAR_HEIGHT = 3.2; // mm
const POST_LABEL_STROKE_WIDTH = 0.6; // mm
const POST_LABEL_DEPTH = 0.5; // mm, recessed into the post's top-facing side

// --- Front (end-cap) Size Label Constants ---
const FRONT_LABEL_CHAR_HEIGHT = 2.2; // mm, small - end cap is the hex's inscribed circle
const FRONT_LABEL_STROKE_WIDTH = 0.5; // mm
const FRONT_LABEL_DEPTH = 0.5; // mm, recessed into the post's front-facing tip

// A post is either a plain number (across-flats, mm - uses fallback spacing/margin)
// or { acrossFlats, outerSize } (outerSize = actual overall width of the spanner
// head, mm, used to guarantee adjacent heads don't collide when both are hung).
const normalizePost = (entry) =>
  typeof entry === "number" ? { acrossFlats: entry, outerSize: null } : entry;

const outerRadius = (outerSize) => (outerSize == null ? null : outerSize / 2);

// Simple L-hook: a round rod at the same tilt/reach as the hex post, bent 90
// degrees downward at the tip. A spanner's open jaw drops over the rod and
// hangs by gravity; the downward lip stops it sliding off the end. Unlike the
// hex post, this isn't sized to the nominal spanner size - it's just a rod
// the tool's jaw opening needs to be wider than, so one generic size covers
// any spanner using this bar.
const buildHookPost = () => {
  let arm = cylinder({ radius: HOOK_ROD_RADIUS, height: HOOK_ARM_LENGTH, segments: 24 });
  arm = rotateX(HOOK_TILT, arm);
  arm = translate([0, -HOOK_ARM_LENGTH / 2 + 1, BAR_HEIGHT / 2], arm);

  // Exact tip position of the arm's axis (local (0,0,HOOK_ARM_LENGTH/2) under
  // the same rotate+translate above), computed analytically so it stays
  // correct if HOOK_ARM_LENGTH/BAR_HEIGHT ever change.
  const halfArm = HOOK_ARM_LENGTH / 2;
  const tipY = -halfArm * Math.sin(HOOK_TILT) + (-halfArm + 1);
  const tipZ = halfArm * Math.cos(HOOK_TILT) + BAR_HEIGHT / 2;

  let drop = cylinder({
    radius: HOOK_ROD_RADIUS,
    height: HOOK_DROP_LENGTH,
    segments: 24,
    center: [0, tipY, tipZ - HOOK_DROP_LENGTH / 2],
  });

  // Sphere at the bend guarantees a smooth, fully manifold joint regardless
  // of the exact angle between the arm and the drop.
  let joint = sphere({ radius: HOOK_ROD_RADIUS, segments: 16, center: [0, tipY, tipZ] });

  return union(arm, drop, joint);
};

// Builds the rear board-mounting pegs (see buildRack's original comment for
// why PEG_PITCH is a hard constraint, not a tunable spacing) for a bar whose
// pegs should span from leftBound to rightBound, vertically centered at
// zCenter (the caller's own baseplate height / 2 - NOT assumed to be
// BAR_HEIGHT, since callers like buildComb use a different baseplate size).
// Returns already-positioned peg geometry, shared by every bar builder
// regardless of front-side design.
const buildPegRow = (leftBound, rightBound, zCenter) => {
  const availableSpan = rightBound - leftBound;
  const pegCount = Math.max(1, Math.floor(availableSpan / PEG_PITCH) + 1);
  const usedSpan = (pegCount - 1) * PEG_PITCH;
  const startOffset = leftBound + (availableSpan - usedSpan) / 2;

  const pegParts = [];
  for (let i = 0; i < pegCount; i++) {
    const pinX = startOffset + i * PEG_PITCH;
    const shaftR = BOARD_PEG_BASE_DIA / 2;

    // Full-length body, both ends domed by roundedCylinder
    let pinBody = roundedCylinder({
      radius: shaftR,
      height: BOARD_PEG_LEN,
      roundRadius: BOARD_PEG_NOSE_FILLET_RADIUS,
      segments: 32,
      center: [0, 0, BOARD_PEG_LEN / 2],
    });

    // Square the bar-side end back off to a flat 5.4mm face (no fillet there)
    let backFill = cylinder({
      radius: shaftR,
      height: BOARD_PEG_NOSE_FILLET_RADIUS + 0.05,
      segments: 32,
      center: [0, 0, (BOARD_PEG_NOSE_FILLET_RADIUS + 0.05) / 2],
    });

    let pencilPin = union(pinBody, backFill);

    // Point backward into the board
    pencilPin = rotateX(-Math.PI / 2, pencilPin);
    pencilPin = translate([pinX, BAR_THICK, zCenter], pencilPin);

    pegParts.push(pencilPin);
  }
  return pegParts;
};

// Warns (doesn't throw - a bar over the limit still slices/prints fine on a
// larger printer, this project just defaults to a Bambu Lab A1) when a
// computed bar length won't fit a single Bambu Lab A1 build plate, so an
// oversized tool list gets caught at generation time instead of at slicing
// time.
const warnIfTooLong = (barLength) => {
  if (barLength > MAX_PRINT_LENGTH) {
    console.warn(
      `rack.js: bar length ${barLength.toFixed(1)}mm exceeds the ${MAX_PRINT_LENGTH}mm safe print length for a Bambu Lab A1 bed - split this tool list across multiple bar files.`
    );
  }
};

// Shared rack builder: takes a list of spanner sizes (across-flats, mm, plain
// numbers or { acrossFlats, outerSize } objects) and produces one printable
// bar sized to fit exactly those posts, split across bars so each stays under
// the printer's 256mm bed. `options` lets a caller override the fallback
// spacing/margin (e.g. for a set of much smaller posts than the 35mm default
// was sized for) without affecting other bars.
const buildRack = (postSizes, options = {}) => {
  const postSpacingDefault = options.postSpacing ?? POST_SPACING;
  const sideMarginDefault = options.sideMargin ?? SIDE_MARGIN;
  const postStyle = options.postStyle ?? "hex";

  const spacingBetween = (a, b) => {
    const ra = outerRadius(a.outerSize);
    const rb = outerRadius(b.outerSize);
    if (ra == null || rb == null) return postSpacingDefault;
    return Math.max(postSpacingDefault, ra + rb + SPANNER_CLEARANCE);
  };

  const marginFor = (post) => {
    const r = outerRadius(post.outerSize);
    return r == null
      ? sideMarginDefault
      : Math.max(sideMarginDefault, r + SPANNER_CLEARANCE);
  };

  const posts = postSizes.map(normalizePost);

  const postX = [marginFor(posts[0])];
  for (let i = 1; i < posts.length; i++) {
    postX.push(postX[i - 1] + spacingBetween(posts[i - 1], posts[i]));
  }
  let barLength = postX[postX.length - 1] + marginFor(posts[posts.length - 1]);

  // Ensure every bar has room for at least 2 board-mounting pegs at the exact
  // PEG_PITCH grid spacing (with some slack) - a bar that's otherwise too
  // short would only fit 1, leaving it able to rotate/sag on the wall.
  const minBarLengthForPegs =
    postX[0] + PEG_PITCH + PEG_MIN_SLACK + marginFor(posts[posts.length - 1]);
  barLength = Math.max(barLength, minBarLengthForPegs);
  warnIfTooLong(barLength);

  // 1. Base Mounting Bar
  let baseBar = cuboid({
    size: [barLength, BAR_THICK, BAR_HEIGHT],
    center: [barLength / 2, BAR_THICK / 2, BAR_HEIGHT / 2],
  });

  let parts = [baseBar];

  // 2. Front Hanging Posts: either hex prisms (sized across-flats like a nut,
  // for a snug slide-on fit) or simple L-hooks (easier on/off, generic size).
  // Actual hex is HEX_UNDERSIZE smaller than nominal so it isn't an exact-fit
  // squeeze onto the real spanner; the labels still show the nominal size.
  posts.forEach((p, i) => {
    let post;
    if (postStyle === "hook") {
      post = buildHookPost();
      post = translate([postX[i], 0, 0], post);
    } else {
      const hexAcrossFlats = p.acrossFlats - HEX_UNDERSIZE;
      post = cylinder({
        radius: hexAcrossFlats / Math.sqrt(3),
        height: POST_LENGTH,
        segments: 6,
      });

      post = labelPostSide(post, p.acrossFlats, hexAcrossFlats);
      post = labelPostFront(post, p.acrossFlats, hexAcrossFlats);

      post = rotateX(Math.PI / 2 + (5 * Math.PI) / 180, post);
      post = translate([postX[i], -POST_LENGTH / 2 + 1, BAR_HEIGHT / 2], post);
    }
    parts.push(post);
  });

  // 3. Rear Pins: constant 5.4mm cylinder, rounded only at the front tip.
  parts.push(...buildPegRow(postX[0], barLength - marginFor(posts[posts.length - 1]), BAR_HEIGHT / 2));

  return union(...parts);
};

// Comb-style holder: a row of simple straight teeth (dividers) where each
// wrench slides in edge-on from the front into the gap between two adjacent
// teeth, gripped against its flat blade sides rather than by jaw diameter or
// a hex fit. The gripped end rests by gravity on the shared Z=0 floor (like
// a ruler lying flat in a narrow slot) and the tool projects forward, away
// from the board, rather than hanging down - so the gap just needs to clear
// the blade thickness with a bit of margin, it doesn't need to be a precise
// friction fit.
// `slots`: ordered array of { size, thickness } (thickness = the wrench
// blade's actual measured thickness at that end, mm). N slots need N+1
// teeth; the outer two teeth bookend the first and last slot.
const buildComb = (slots, options = {}) => {
  const toothThickness = options.toothThickness ?? TOOTH_THICKNESS;
  const toothHeight = options.toothHeight ?? TOOTH_HEIGHT;
  const toothReach = options.toothReach ?? TOOTH_REACH;
  const baseHeight = options.baseHeight ?? COMB_BASE_HEIGHT;
  const sideMarginDefault = options.sideMargin ?? SIDE_MARGIN;

  const gapWidths = slots.map((s) => s.thickness + GAP_CLEARANCE);

  let cursor = sideMarginDefault;
  const teethStartX = [];
  for (let i = 0; i <= slots.length; i++) {
    teethStartX.push(cursor);
    cursor += toothThickness;
    if (i < slots.length) cursor += gapWidths[i];
  }
  const patternWidth = cursor - sideMarginDefault;

  let barLength = patternWidth + 2 * sideMarginDefault;

  // Same board-peg room guarantee as buildRack - see its comment for why
  // PEG_PITCH can't be stretched or compressed to fit.
  const minBarLengthForPegs = sideMarginDefault + PEG_PITCH + PEG_MIN_SLACK + sideMarginDefault;
  barLength = Math.max(barLength, minBarLengthForPegs);
  warnIfTooLong(barLength);

  // If the peg requirement stretched the bar beyond the natural tooth
  // pattern's width, center the pattern rather than leaving it flush left.
  const centeringOffset = (barLength - (patternWidth + 2 * sideMarginDefault)) / 2;
  const finalTeethStartX = teethStartX.map((x) => x + centeringOffset);

  // 1. Baseplate
  let baseplate = cuboid({
    size: [barLength, BAR_THICK, baseHeight],
    center: [barLength / 2, BAR_THICK / 2, baseHeight / 2],
  });

  let parts = [baseplate];

  // 2. Teeth: reach forward in Y (away from the board, same direction as the
  // hex/hook posts - opposite of the pegs, which reach backward into the
  // board), standing only a short band tall in Z. The wrench lies on its
  // side and slides in edge-on from the front, gripped by its blade
  // thickness (the X gap between two adjacent teeth) and resting by gravity
  // on the Z=0 floor shared with the baseplate, so it projects outward
  // rather than hanging down. Each tooth's back face is flush with the
  // baseplate's own back face and spans its full reach, guaranteeing a
  // solid connection.
  finalTeethStartX.forEach((startX) => {
    let tooth = cuboid({
      size: [toothThickness, toothReach, toothHeight],
      center: [startX + toothThickness / 2, BAR_THICK - toothReach / 2, toothHeight / 2],
    });
    parts.push(tooth);
  });

  // 3. Rear Pins: same margin used to size barLength above, for consistency.
  parts.push(...buildPegRow(sideMarginDefault, barLength - sideMarginDefault, baseHeight / 2));

  return union(...parts);
};

// Turns a font stroke (a polyline) into a solid area by hulling a small circle
// pair across each individual segment, rather than expanding the whole
// polyline at once - some glyphs (e.g. "8") have a waist tight enough that a
// single whole-path expand self-intersects and produces bad extrusion volume.
const strokeToShape = (points, strokeWidth) => {
  const r = strokeWidth / 2;
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const c1 = translate([points[i][0], points[i][1], 0], circle({ radius: r, segments: 8 }));
    const c2 = translate([points[i + 1][0], points[i + 1][1], 0], circle({ radius: r, segments: 8 }));
    segments.push(hull(c1, c2));
  }
  return union(segments);
};

// Engraves the post's own size number into one of its flat hex side faces
// (not the end cap - too small/mostly hidden, and edge-on from a head-on
// viewing angle anyway). Uses the facet whose normal is local +Y before the
// post's own rotateX/translate placement, since that facet ends up facing
// almost straight up once the post is tilted and mounted (verified: jscad's
// 6-segment cylinder has facet normals at 30,90,150,... degrees, so +Y (90
// degrees) is an exact facet normal, not an edge). `label` is the nominal
// size shown; `hexAcrossFlats` is the actual (undersized) hex geometry so the
// text sits flush with the real facet, not the nominal one.
const labelPostSide = (post, label, hexAcrossFlats) => {
  const text = String(label);
  const apothem = hexAcrossFlats / 2;

  const strokes = vectorText({ height: POST_LABEL_CHAR_HEIGHT }, text);
  const textShape2D = union(strokes.map((points) => strokeToShape(points, POST_LABEL_STROKE_WIDTH)));
  const textBB = measureBoundingBox(textShape2D);
  const textWidth = textBB[1][0] - textBB[0][0];

  // Skip labeling if the text can't fit within the facet width with margin
  // (protects future small sizes added without checking this by hand)
  if (textWidth > hexAcrossFlats - 1.0) return post;

  let textSolid = extrudeLinear({ height: POST_LABEL_DEPTH }, textShape2D);
  // Rotate so the text's height axis runs along the post's length (Z) and
  // its extrusion depth cuts inward along Y (the facet's own normal).
  textSolid = rotateX(-Math.PI / 2, textSolid);
  const rotBB = measureBoundingBox(textSolid);
  const rotWidth = rotBB[1][0] - rotBB[0][0];
  const rotZSpan = rotBB[1][2] - rotBB[0][2];

  textSolid = translate(
    [
      -rotWidth / 2 - rotBB[0][0], // center on the post's X axis
      apothem - rotBB[1][1], // flush with the facet, cutting inward
      -rotZSpan / 2 - rotBB[0][2], // center along the post's length
    ],
    textSolid
  );

  return subtract(post, textSolid);
};

// Engraves the post's own size number into its front end-cap face (the flat
// hex end that faces the viewer head-on: local Z=+POST_LENGTH/2, verified by
// tracing where each local Z end lands after the post's own rotateX/translate
// - this end lands far from the bar, the other stays embedded near it).
const labelPostFront = (post, label, hexAcrossFlats) => {
  const text = String(label);

  const strokes = vectorText({ height: FRONT_LABEL_CHAR_HEIGHT }, text);
  const textShape2D = union(strokes.map((points) => strokeToShape(points, FRONT_LABEL_STROKE_WIDTH)));
  const textBB = measureBoundingBox(textShape2D);
  const textWidth = textBB[1][0] - textBB[0][0];
  const textHeight = textBB[1][1] - textBB[0][1];

  // Skip if the text's bounding box doesn't fit within the end cap's
  // inscribed circle (radius = apothem = hexAcrossFlats/2), checked properly
  // via the diagonal rather than just width/height independently.
  const halfDiagonal = Math.sqrt((textWidth / 2) ** 2 + (textHeight / 2) ** 2);
  if (halfDiagonal > hexAcrossFlats / 2 - 0.5) return post;

  let textSolid = extrudeLinear({ height: FRONT_LABEL_DEPTH }, textShape2D);
  textSolid = translate(
    [
      -textWidth / 2 - textBB[0][0],
      -textHeight / 2 - textBB[0][1],
      POST_LENGTH / 2 - FRONT_LABEL_DEPTH,
    ],
    textSolid
  );

  return subtract(post, textSolid);
};

// Engraves (recesses) a text label into the top face of a rack bar. Measures
// the bar's own bounding box to find its length, so it works with any bar
// buildRack produces regardless of options.
const engraveLabel = (bar, label) => {
  const strokes = vectorText({ height: ENGRAVE_CHAR_HEIGHT }, label);
  const strokeShapes = strokes.map((points) => strokeToShape(points, ENGRAVE_STROKE_WIDTH));
  const textShape2D = union(strokeShapes);
  const textBB = measureBoundingBox(textShape2D);
  const textWidth = textBB[1][0] - textBB[0][0];
  const textHeight = textBB[1][1] - textBB[0][1];

  const barBB = measureBoundingBox(bar);
  const barLength = barBB[1][0] - barBB[0][0];

  let textSolid = extrudeLinear({ height: ENGRAVE_DEPTH }, textShape2D);
  textSolid = translate(
    [
      barBB[0][0] + barLength / 2 - textWidth / 2 - textBB[0][0],
      BAR_THICK / 2 - textHeight / 2 - textBB[0][1],
      BAR_HEIGHT - ENGRAVE_DEPTH,
    ],
    textSolid
  );

  return subtract(bar, textSolid);
};

module.exports = {
  buildRack,
  buildComb,
  engraveLabel,
  BOARD_PEG_BASE_DIA,
  BOARD_PEG_LEN,
  BOARD_PEG_NOSE_FILLET_RADIUS,
  PEG_PITCH,
  BAR_THICK,
  BAR_HEIGHT,
  POST_LENGTH,
  POST_SPACING,
  SIDE_MARGIN,
};
