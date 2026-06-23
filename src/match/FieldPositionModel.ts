import type { SnapLane } from '../ballSpotting';
import { PLAYABLE_FIELD_BOUNDS } from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';

type PossessionFrame = 'opponent' | 'user';

export interface WorldFieldSpot {
  x: number;
  z: number;
}

export interface OffenseRelativeSpot {
  x: number;
  z: number;
}

export interface PossessionFieldPosition {
  yardsFromOwnGoalLine: number;
  lateralX: number;
}

export interface TouchbackRules {
  defaultSnapLane: SnapLane;
  freeKickYardLine: number;
  otherTouchbackYardLine: number;
}

export const DEFAULT_TOUCHBACK_RULES: TouchbackRules = {
  defaultSnapLane: 'middle',
  freeKickYardLine: 25,
  otherTouchbackYardLine: 20,
} as const;

export function possessionFieldPositionToOffenseSpot(
  position: PossessionFieldPosition,
): OffenseRelativeSpot {
  return {
    x: clampLateral(position.lateralX),
    z: clampYards(position.yardsFromOwnGoalLine) + PLAYABLE_FIELD_BOUNDS.minZ,
  };
}

export function offenseSpotToPossessionFieldPosition(
  spot: OffenseRelativeSpot | FootballSpot,
): PossessionFieldPosition {
  return {
    lateralX: clampLateral(spot.x),
    yardsFromOwnGoalLine: clampYards(spot.z - PLAYABLE_FIELD_BOUNDS.minZ),
  };
}

export function changePossessionFieldPosition(
  position: PossessionFieldPosition,
): PossessionFieldPosition {
  return {
    lateralX: clampLateral(-clampLateral(position.lateralX)),
    yardsFromOwnGoalLine: 100 - clampYards(position.yardsFromOwnGoalLine),
  };
}

export function possessionFieldPositionToWorldSpot(
  position: PossessionFieldPosition,
  possession: PossessionFrame,
): WorldFieldSpot {
  const offenseSpot = possessionFieldPositionToOffenseSpot(position);
  return offenseSpotToWorldSpot(offenseSpot, possession);
}

export function worldSpotToPossessionFieldPosition(
  spot: WorldFieldSpot | FootballSpot,
  possession: PossessionFrame,
): PossessionFieldPosition {
  return offenseSpotToPossessionFieldPosition(worldSpotToOffenseSpot(spot, possession));
}

export function offenseSpotToWorldSpot(
  spot: OffenseRelativeSpot | FootballSpot,
  possession: PossessionFrame,
): WorldFieldSpot {
  if (possession === 'user') {
    return {
      x: clampLateral(spot.x),
      z: clampWorldZ(spot.z),
    };
  }

  return {
    x: clampLateral(-spot.x),
    z: clampWorldZ(-spot.z),
  };
}

export function worldSpotToOffenseSpot(
  spot: WorldFieldSpot | FootballSpot,
  possession: PossessionFrame,
): OffenseRelativeSpot {
  if (possession === 'user') {
    return {
      x: clampLateral(spot.x),
      z: clampWorldZ(spot.z),
    };
  }

  return {
    x: clampLateral(-spot.x),
    z: clampWorldZ(-spot.z),
  };
}

export function formatPossessionFieldPosition(position: PossessionFieldPosition): string {
  const yardsFromOwnGoalLine = Math.round(clampYards(position.yardsFromOwnGoalLine));
  if (yardsFromOwnGoalLine === 50) {
    return 'MIDFIELD';
  }

  if (yardsFromOwnGoalLine < 50) {
    return `OWN ${yardsFromOwnGoalLine}`;
  }

  return `OPP ${100 - yardsFromOwnGoalLine}`;
}

export function createOwnYardLinePosition(
  yardLine: number,
  lateralX = 0,
): PossessionFieldPosition {
  return {
    lateralX: clampLateral(lateralX),
    yardsFromOwnGoalLine: clampYards(yardLine),
  };
}

export function createOpponentYardLinePosition(
  yardLine: number,
  lateralX = 0,
): PossessionFieldPosition {
  return {
    lateralX: clampLateral(lateralX),
    yardsFromOwnGoalLine: 100 - clampYards(yardLine),
  };
}

export function createFreeKickTouchbackPosition(
  rules: TouchbackRules = DEFAULT_TOUCHBACK_RULES,
): PossessionFieldPosition {
  return createOwnYardLinePosition(rules.freeKickYardLine);
}

export function createOtherTouchbackPosition(
  rules: TouchbackRules = DEFAULT_TOUCHBACK_RULES,
): PossessionFieldPosition {
  return createOwnYardLinePosition(rules.otherTouchbackYardLine);
}

export function calculatePossessionYardsGained(
  start: PossessionFieldPosition,
  end: PossessionFieldPosition,
): number {
  return Math.round(clampYards(end.yardsFromOwnGoalLine) - clampYards(start.yardsFromOwnGoalLine));
}

export function clonePossessionFieldPosition(
  position: PossessionFieldPosition,
): PossessionFieldPosition {
  return {
    lateralX: position.lateralX,
    yardsFromOwnGoalLine: position.yardsFromOwnGoalLine,
  };
}

function clampYards(value: number): number {
  return normalizeZero(Math.min(100, Math.max(0, value)));
}

function clampLateral(value: number): number {
  return normalizeZero(Math.min(PLAYABLE_FIELD_BOUNDS.maxX, Math.max(PLAYABLE_FIELD_BOUNDS.minX, value)));
}

function clampWorldZ(value: number): number {
  return normalizeZero(Math.min(PLAYABLE_FIELD_BOUNDS.maxZ, Math.max(PLAYABLE_FIELD_BOUNDS.minZ, value)));
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
