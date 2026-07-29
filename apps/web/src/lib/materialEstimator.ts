/**
 * Rule-of-thumb construction material estimation — standard South Asian trade ratios,
 * not a structural design. Always labelled as an estimate in the UI; a contractor/engineer
 * should confirm exact quantities for anything load-bearing.
 *
 * All volumes in cubic feet (cft) to match how this shop already prices sand/bajri, and how
 * Pakistani sites actually measure — 1 bag of cement is taken as 1.25 cft (50kg bag, standard
 * conversion used industry-wide).
 */

const CFT_PER_BAG = 1.25;
// ~500 bricks per m³ of finished brickwork (mortar included) is the standard figure;
// 500 / 35.3147 cft-per-m³ ≈ 14.16, rounded to a clean trade number.
const BRICKS_PER_CFT = 14.2;
// Mortar is roughly 30% of a brick wall's total volume once coursed with standard joints.
const WALL_MORTAR_FRACTION = 0.3;
// Dry-to-wet volume factors — dry ingredients occupy more space than the mixed, compacted
// result, so they're bumped up before splitting into the mix ratio.
const RCC_DRY_FACTOR = 1.54;
const PLASTER_DRY_FACTOR = 1.33;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type WallInput = { lengthFt: number; heightFt: number; thicknessIn: number; mortarSandParts: number };
export type WallResult = { wallVolumeCft: number; bricks: number; cementBags: number; sandCft: number };

export function estimateBrickWall(input: WallInput): WallResult {
  const wallVolumeCft = input.lengthFt * input.heightFt * (input.thicknessIn / 12);
  const bricks = Math.ceil(wallVolumeCft * BRICKS_PER_CFT);
  const dryMortarCft = wallVolumeCft * WALL_MORTAR_FRACTION;
  const totalParts = 1 + input.mortarSandParts;
  const cementCft = dryMortarCft / totalParts;
  const sandCft = dryMortarCft * (input.mortarSandParts / totalParts);
  return { wallVolumeCft: round2(wallVolumeCft), bricks, cementBags: Math.ceil(cementCft / CFT_PER_BAG), sandCft: round2(sandCft) };
}

export type SlabInput = {
  lengthFt: number;
  widthFt: number;
  thicknessIn: number;
  cementParts: number;
  sandParts: number;
  aggregateParts: number;
  steelKgPerSqft: number;
};
export type SlabResult = {
  areaSqft: number;
  volumeCft: number;
  cementBags: number;
  sandCft: number;
  aggregateCft: number;
  steelKg: number;
};

export function estimateRccSlab(input: SlabInput): SlabResult {
  const areaSqft = input.lengthFt * input.widthFt;
  const wetVolumeCft = areaSqft * (input.thicknessIn / 12);
  const dryVolumeCft = wetVolumeCft * RCC_DRY_FACTOR;
  const totalParts = input.cementParts + input.sandParts + input.aggregateParts;
  const cementCft = dryVolumeCft * (input.cementParts / totalParts);
  const sandCft = dryVolumeCft * (input.sandParts / totalParts);
  const aggregateCft = dryVolumeCft * (input.aggregateParts / totalParts);
  return {
    areaSqft: round2(areaSqft),
    volumeCft: round2(wetVolumeCft),
    cementBags: Math.ceil(cementCft / CFT_PER_BAG),
    sandCft: round2(sandCft),
    aggregateCft: round2(aggregateCft),
    steelKg: Math.ceil(areaSqft * input.steelKgPerSqft),
  };
}

export type PccInput = {
  lengthFt: number;
  widthFt: number;
  thicknessIn: number;
  cementParts: number;
  sandParts: number;
  aggregateParts: number;
};
export type PccResult = { volumeCft: number; cementBags: number; sandCft: number; aggregateCft: number };

export function estimatePcc(input: PccInput): PccResult {
  const wetVolumeCft = input.lengthFt * input.widthFt * (input.thicknessIn / 12);
  const dryVolumeCft = wetVolumeCft * RCC_DRY_FACTOR;
  const totalParts = input.cementParts + input.sandParts + input.aggregateParts;
  const cementCft = dryVolumeCft * (input.cementParts / totalParts);
  const sandCft = dryVolumeCft * (input.sandParts / totalParts);
  const aggregateCft = dryVolumeCft * (input.aggregateParts / totalParts);
  return {
    volumeCft: round2(wetVolumeCft),
    cementBags: Math.ceil(cementCft / CFT_PER_BAG),
    sandCft: round2(sandCft),
    aggregateCft: round2(aggregateCft),
  };
}

export type PlasterInput = { lengthFt: number; heightFt: number; thicknessIn: number; sandParts: number };
export type PlasterResult = { areaSqft: number; cementBags: number; sandCft: number };

export function estimatePlaster(input: PlasterInput): PlasterResult {
  const areaSqft = input.lengthFt * input.heightFt;
  const wetVolumeCft = areaSqft * (input.thicknessIn / 12);
  const dryVolumeCft = wetVolumeCft * PLASTER_DRY_FACTOR;
  const totalParts = 1 + input.sandParts;
  const cementCft = dryVolumeCft / totalParts;
  const sandCft = dryVolumeCft * (input.sandParts / totalParts);
  return { areaSqft: round2(areaSqft), cementBags: Math.ceil(cementCft / CFT_PER_BAG), sandCft: round2(sandCft) };
}
