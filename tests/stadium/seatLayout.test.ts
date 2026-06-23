import { describe, expect, it } from 'vitest';
import { DEFAULT_STADIUM_SPEC } from '../../src/stadium/StadiumSpec';
import {
  calculateSeatSpacingError,
  createCrowdSeatTransforms,
  createSeatLayout,
  isInsideTunnel,
} from '../../src/stadium/SeatLayout';
import { sectionLength } from '../../src/stadium/StadiumPath';
import type { SeatTransform, StadiumSectionId } from '../../src/stadium/StadiumTypes';

describe('stadium seat layout', () => {
  it('creates unique seat transforms from the stadium path', () => {
    const layout = createSeatLayout(DEFAULT_STADIUM_SPEC, { upperTierEnabled: true });
    const keys = new Set(layout.seats.map((seat) =>
      `${seat.sectionId}:${seat.tier}:${seat.row}:${seat.seatIndex}`));

    expect(layout.seats.length).toBeGreaterThan(25_000);
    expect(keys.size).toBe(layout.seats.length);
    expect(layout.seats.every((seat) => Number.isFinite(seat.facingRadians))).toBe(true);
  });

  it('keeps seat spacing regular on straight stands', () => {
    const layout = createSeatLayout(DEFAULT_STADIUM_SPEC, { upperTierEnabled: false });

    expect(calculateSeatSpacingError(layout.seats, 'sidelineLeft', 0)).toBeLessThan(1e-6);
    expect(calculateSeatSpacingError(layout.seats, 'sidelineRight', 0)).toBeLessThan(1e-6);
    expect(averageSeatSpacing(layout.seats, 'sidelineLeft', 0)).toBeCloseTo(
      DEFAULT_STADIUM_SPEC.seatSpacing,
      1,
    );
  });

  it('excludes seats from declared tunnel openings', () => {
    const layout = createSeatLayout(DEFAULT_STADIUM_SPEC, { upperTierEnabled: false });

    for (const tunnel of DEFAULT_STADIUM_SPEC.tunnels) {
      const seatsInSection = layout.seats.filter((seat) => seat.sectionId === tunnel.sectionId);
      expect(seatsInSection.some((seat) =>
        isInsideTunnel(
          DEFAULT_STADIUM_SPEC,
          tunnel.sectionId,
          seatDistanceWithinSection(seat),
        ))).toBe(false);
    }
  });

  it('caps crowd transforms to available stadium seats', () => {
    const availableSeats = createSeatLayout(DEFAULT_STADIUM_SPEC).seats;
    const crowdSeats = createCrowdSeatTransforms(50_000);

    expect(crowdSeats.length).toBeLessThanOrEqual(availableSeats.length);
    expect(crowdSeats.length).toBe(25_000);
  });

  it('derives crowd transforms from real seat transforms', () => {
    const layout = createSeatLayout(DEFAULT_STADIUM_SPEC, { requestedCount: 500 });
    const crowdSeats = createCrowdSeatTransforms(500);

    expect(crowdSeats).toHaveLength(500);
    for (let index = 0; index < crowdSeats.length; index += 1) {
      const crowdSeat = crowdSeats[index];
      const layoutSeat = layout.seats[index];
      expect(crowdSeat.sectionId).toBe(layoutSeat.sectionId);
      expect(crowdSeat.row).toBe(layoutSeat.row);
      expect(crowdSeat.seatIndex).toBe(layoutSeat.seatIndex);
      expect(crowdSeat.position).toEqual(layoutSeat.position);
    }
  });

  it('mirrors left/right and near/far seat sections around the field center', () => {
    const seats = createSeatLayout(DEFAULT_STADIUM_SPEC, { upperTierEnabled: false }).seats;
    const leftCenter = averagePosition(seats, 'sidelineLeft');
    const rightCenter = averagePosition(seats, 'sidelineRight');
    const nearCenter = averagePosition(seats, 'endZoneNear');
    const farCenter = averagePosition(seats, 'endZoneFar');

    expect(leftCenter.x).toBeCloseTo(-rightCenter.x, 6);
    expect(leftCenter.z).toBeCloseTo(rightCenter.z, 1);
    expect(nearCenter.z).toBeCloseTo(-farCenter.z, 6);
    expect(nearCenter.x).toBeCloseTo(farCenter.x, 1);
  });
});

function averageSeatSpacing(
  seats: readonly SeatTransform[],
  sectionId: StadiumSectionId,
  row: number,
): number {
  const rowSeats = seats
    .filter((seat) => seat.sectionId === sectionId && seat.row === row)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  const distances: number[] = [];
  for (let index = 1; index < rowSeats.length; index += 1) {
    if (rowSeats[index].seatIndex !== rowSeats[index - 1].seatIndex + 1) {
      continue;
    }
    const previous = rowSeats[index - 1].position;
    const current = rowSeats[index].position;
    distances.push(Math.hypot(current.x - previous.x, current.z - previous.z));
  }
  return distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
}

function seatDistanceWithinSection(seat: SeatTransform): number {
  const length = sectionLength(seat.sectionId, DEFAULT_STADIUM_SPEC);
  const originalSeatCount = Math.max(1, Math.floor(length / DEFAULT_STADIUM_SPEC.seatSpacing));
  return (seat.seatIndex + 0.5) * (length / originalSeatCount);
}

function averagePosition(
  seats: readonly SeatTransform[],
  sectionId: StadiumSectionId,
): { x: number; z: number } {
  const sectionSeats = seats.filter((seat) => seat.sectionId === sectionId);
  return {
    x: sectionSeats.reduce((sum, seat) => sum + seat.position.x, 0) / sectionSeats.length,
    z: sectionSeats.reduce((sum, seat) => sum + seat.position.z, 0) / sectionSeats.length,
  };
}
