import { FIELD_MARKING_DIMENSIONS, INITIAL_BALL_SPOT } from './fieldSpec';
import { cloneFootballSpot, type FootballSpot } from './fieldScale';

export type SnapLane = 'leftHash' | 'middle' | 'rightHash';

export interface SnapPlacement {
  lane: SnapLane;
  spot: FootballSpot;
}

export const SNAP_LANE_X: Record<SnapLane, number> = {
  leftHash: -FIELD_MARKING_DIMENSIONS.hashX,
  middle: 0,
  rightHash: FIELD_MARKING_DIMENSIONS.hashX,
} as const;

const SNAP_LANE_PRIORITY: SnapLane[] = ['middle', 'leftHash', 'rightHash'];

export function resolveSnapPlacement(deadBallSpot: FootballSpot): SnapPlacement {
  let selectedLane: SnapLane = SNAP_LANE_PRIORITY[0];
  let selectedDistance = Number.POSITIVE_INFINITY;

  for (const lane of SNAP_LANE_PRIORITY) {
    const distance = Math.abs(deadBallSpot.x - SNAP_LANE_X[lane]);

    if (distance < selectedDistance) {
      selectedLane = lane;
      selectedDistance = distance;
    }
  }

  return {
    lane: selectedLane,
    spot: {
      x: SNAP_LANE_X[selectedLane],
      z: deadBallSpot.z,
    },
  };
}

export function createCenterSnapPlacement(spot: FootballSpot = INITIAL_BALL_SPOT): SnapPlacement {
  return {
    lane: 'middle',
    spot: {
      x: SNAP_LANE_X.middle,
      z: spot.z,
    },
  };
}

export function cloneSnapPlacement(placement: SnapPlacement): SnapPlacement {
  return {
    lane: placement.lane,
    spot: cloneFootballSpot(placement.spot),
  };
}
