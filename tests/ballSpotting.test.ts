import { describe, expect, it } from 'vitest';
import { SNAP_LANE_X, resolveSnapPlacement } from '../src/ballSpotting';
import { FIELD_MARKING_DIMENSIONS, HASH_X } from '../src/fieldSpec';

describe('ball spotting', () => {
  it('resolves a dead ball far left to the left hash', () => {
    expect(resolveSnapPlacement({ x: -20, z: 12 })).toEqual({
      lane: 'leftHash',
      spot: { x: SNAP_LANE_X.leftHash, z: 12 },
    });
  });

  it('resolves a dead ball at midfield width to middle', () => {
    expect(resolveSnapPlacement({ x: 0, z: -3 })).toEqual({
      lane: 'middle',
      spot: { x: 0, z: -3 },
    });
  });

  it('resolves a dead ball far right to the right hash', () => {
    expect(resolveSnapPlacement({ x: 20, z: 8 })).toEqual({
      lane: 'rightHash',
      spot: { x: SNAP_LANE_X.rightHash, z: 8 },
    });
  });

  it('prefers middle when a dead ball is exactly halfway between middle and a hash', () => {
    expect(resolveSnapPlacement({ x: SNAP_LANE_X.rightHash / 2, z: 4 })).toEqual({
      lane: 'middle',
      spot: { x: 0, z: 4 },
    });
  });

  it('does not mutate the exact dead-ball object', () => {
    const deadBallSpot = { x: -20, z: 7 };
    const originalSpot = { ...deadBallSpot };

    resolveSnapPlacement(deadBallSpot);

    expect(deadBallSpot).toEqual(originalSpot);
  });

  it('preserves the exact Z coordinate while normalizing only X', () => {
    const placement = resolveSnapPlacement({ x: 20, z: 13.25 });

    expect(placement.spot.x).toBe(SNAP_LANE_X.rightHash);
    expect(placement.spot.z).toBe(13.25);
  });

  it('uses the same authoritative hash X as painted field hashes', () => {
    expect(SNAP_LANE_X.rightHash).toBeCloseTo(HASH_X);
    expect(SNAP_LANE_X.rightHash).toBeCloseTo(FIELD_MARKING_DIMENSIONS.hashX);
    expect(SNAP_LANE_X.leftHash).toBeCloseTo(-FIELD_MARKING_DIMENSIONS.hashX);
  });
});
