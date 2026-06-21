import { DEFAULT_STADIUM_SPEC, getEnabledStadiumTiers } from './StadiumSpec';
import type {
  StadiumBounds,
  StadiumRowLayout,
  StadiumSpec,
  Vec2,
} from './StadiumTypes';

export function createStadiumRows(
  spec: StadiumSpec = DEFAULT_STADIUM_SPEC,
  upperTierEnabled = true,
): StadiumRowLayout[] {
  const rows: StadiumRowLayout[] = [];
  const tiers = getEnabledStadiumTiers(spec, upperTierEnabled);

  tiers.forEach((tier, tierIndex) => {
    for (let row = 0; row < tier.rowCount; row += 1) {
      rows.push({
        elevation: tier.baseElevation + row * spec.rowRise,
        globalRow: rows.length,
        offset: tier.baseOffset + row * spec.rowDepth,
        row,
        tier: tierIndex,
        tierId: tier.id,
      });
    }
  });

  return rows;
}

export function calculateOuterStadiumBounds(
  spec: StadiumSpec = DEFAULT_STADIUM_SPEC,
  upperTierEnabled = true,
): StadiumBounds {
  const rows = createStadiumRows(spec, upperTierEnabled);
  const maxOffset = Math.max(...rows.map((row) => row.offset + spec.rowDepth), 0);
  return {
    maxX: spec.innerBowlWidth / 2 + maxOffset + spec.cameraClearance,
    maxZ: spec.innerBowlDepth / 2 + maxOffset + spec.cameraClearance,
    minX: -spec.innerBowlWidth / 2 - maxOffset - spec.cameraClearance,
    minZ: -spec.innerBowlDepth / 2 - maxOffset - spec.cameraClearance,
  };
}

export function isOutsideProtectedBounds(
  point: Vec2,
  bounds: StadiumBounds,
): boolean {
  return (
    point.x <= bounds.minX ||
    point.x >= bounds.maxX ||
    point.z <= bounds.minZ ||
    point.z >= bounds.maxZ
  );
}

export function mirrorPointX(point: Vec2): Vec2 {
  return {
    x: -point.x,
    z: point.z,
  };
}

export function mirrorPointZ(point: Vec2): Vec2 {
  return {
    x: point.x,
    z: -point.z,
  };
}
