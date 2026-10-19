/** Execute rescue only after the frozen B-arm accepted-flow threshold passes. */
export function afterR2(r1, lostBySeed, runRescue) {
  const passingSeeds = Object.keys(r1).filter((seed) =>
    r1[seed].met && Number.isFinite(lostBySeed[seed]) && lostBySeed[seed] >= 1);
  if (passingSeeds.length === 0) return { met: false, passingSeeds };
  runRescue();
  return { met: true, passingSeeds };
}
