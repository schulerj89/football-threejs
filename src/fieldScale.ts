import { FIELD_DIRECTION, WORLD_SCALE } from './fieldSpec';

export interface FootballSpot {
  x: number;
  z: number;
}

export const FIELD_SCALE = {
  worldUnitsPerFootballYard: WORLD_SCALE.worldUnitsPerYard,
  playDirectionZ: FIELD_DIRECTION.playDirectionZ,
} as const;

export function cloneFootballSpot(spot: FootballSpot): FootballSpot {
  return { x: spot.x, z: spot.z };
}

export function worldUnitsToFootballYards(worldUnits: number): number {
  return worldUnits / FIELD_SCALE.worldUnitsPerFootballYard;
}

export function footballYardsToWorldUnits(yards: number): number {
  return yards * FIELD_SCALE.worldUnitsPerFootballYard;
}

export function calculateYardsGained(startingSpot: FootballSpot, endingSpot: FootballSpot): number {
  return worldUnitsToFootballYards((endingSpot.z - startingSpot.z) * FIELD_SCALE.playDirectionZ);
}
