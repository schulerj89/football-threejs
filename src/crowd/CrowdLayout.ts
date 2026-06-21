import { createCrowdSeatTransforms } from '../stadium/SeatLayout';
import type { CrowdPreviewPlacement } from './CrowdTypes';

export function createCrowdPlacements(requestedCount: number): readonly CrowdPreviewPlacement[] {
  return createCrowdSeatTransforms(requestedCount).map((seat, index) => ({
    colorSeed: stableHash(`${seat.sectionId}:${seat.row}:${seat.seatIndex}:${index}`),
    facingRadians: seat.facingRadians,
    lod: seat.lod,
    row: seat.row,
    scale: seat.scale,
    seatIndex: seat.seatIndex,
    stand: seat.sectionId,
    tier: seat.tier,
    x: seat.position.x,
    y: seat.position.y,
    z: seat.position.z,
  }));
}

export function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
