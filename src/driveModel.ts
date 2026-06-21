import { INITIAL_BALL_SPOT, OPPOSING_GOAL_LINE_Z } from './field';
import {
  cloneFootballSpot,
  worldUnitsToFootballYards,
  type FootballSpot,
} from './fieldScale';

export type Down = 1 | 2 | 3 | 4;
export type DriveState = 'active' | 'over';
export type DriveEndType = 'touchdown' | 'turnoverOnDowns';

export interface DrivePlayResult {
  endingBallSpot: FootballSpot;
  id: number;
  reason: 'tackle' | 'outOfBounds' | 'touchdown';
  scoringTeam: 'offense' | null;
  startingBallSpot: FootballSpot;
  type: 'tackle' | 'outOfBounds' | 'touchdown';
  yardsGained: number;
}

export interface DriveEndResult {
  nextDriveStartSpot: FootballSpot;
  reason: DriveEndType;
  type: DriveEndType;
}

export interface DriveModel {
  currentDown: Down;
  firstDownMarker: FootballSpot;
  lastAppliedPlayResultId: number | null;
  lastDriveResult: DriveEndResult | null;
  lineOfScrimmage: FootballSpot;
  state: DriveState;
  yardsToFirstDown: number;
}

export interface DriveSnapshot {
  currentDown: Down;
  firstDownMarker: FootballSpot;
  lastDriveResult: DriveEndResult | null;
  lineOfScrimmage: FootballSpot;
  state: DriveState;
  yardsToFirstDown: number;
}

export interface DriveUpdate {
  applied: boolean;
  driveEnded: boolean;
  newFirstDown: boolean;
  nextBallSpot: FootballSpot;
}

export const DRIVE_CONFIG = {
  firstDownYards: 10,
  maxDown: 4,
  startingBallSpot: INITIAL_BALL_SPOT,
} as const;

const SPOT_EPSILON = 0.0001;

export function createDriveModel(startingSpot: FootballSpot = DRIVE_CONFIG.startingBallSpot): DriveModel {
  const lineOfScrimmage = cloneFootballSpot(startingSpot);
  const firstDownMarker = calculateFirstDownMarker(lineOfScrimmage);

  return {
    currentDown: 1,
    firstDownMarker,
    lastAppliedPlayResultId: null,
    lastDriveResult: null,
    lineOfScrimmage,
    state: 'active',
    yardsToFirstDown: calculateYardsToMarker(lineOfScrimmage, firstDownMarker),
  };
}

export function resetDriveModel(
  drive: DriveModel,
  startingSpot: FootballSpot = DRIVE_CONFIG.startingBallSpot,
): void {
  const resetDrive = createDriveModel(startingSpot);

  drive.currentDown = resetDrive.currentDown;
  drive.firstDownMarker = resetDrive.firstDownMarker;
  drive.lastAppliedPlayResultId = null;
  drive.lastDriveResult = null;
  drive.lineOfScrimmage = resetDrive.lineOfScrimmage;
  drive.state = resetDrive.state;
  drive.yardsToFirstDown = resetDrive.yardsToFirstDown;
}

export function applyPlayResultToDrive(
  drive: DriveModel,
  playResult: DrivePlayResult,
): DriveUpdate {
  if (drive.lastAppliedPlayResultId === playResult.id || drive.state === 'over') {
    return createDriveUpdate(false, drive.state === 'over', false, drive.lineOfScrimmage);
  }

  drive.lastAppliedPlayResultId = playResult.id;

  if (playResult.type === 'touchdown') {
    drive.state = 'over';
    drive.lastDriveResult = createDriveEndResult('touchdown');
    return createDriveUpdate(true, true, false, DRIVE_CONFIG.startingBallSpot);
  }

  const endingSpot = cloneFootballSpot(playResult.endingBallSpot);

  if (hasReachedLineToGain(drive, endingSpot)) {
    setFirstAndTenAt(drive, endingSpot);
    return createDriveUpdate(true, false, true, endingSpot);
  }

  if (drive.currentDown === DRIVE_CONFIG.maxDown) {
    drive.lineOfScrimmage = endingSpot;
    drive.yardsToFirstDown = calculateYardsToMarker(endingSpot, drive.firstDownMarker);
    drive.state = 'over';
    drive.lastDriveResult = createDriveEndResult('turnoverOnDowns');
    return createDriveUpdate(true, true, false, DRIVE_CONFIG.startingBallSpot);
  }

  drive.currentDown = nextDown(drive.currentDown);
  drive.lineOfScrimmage = endingSpot;
  drive.yardsToFirstDown = calculateYardsToMarker(endingSpot, drive.firstDownMarker);
  drive.lastDriveResult = null;

  return createDriveUpdate(true, false, false, endingSpot);
}

export function snapshotDriveModel(drive: DriveModel): DriveSnapshot {
  return {
    currentDown: drive.currentDown,
    firstDownMarker: cloneFootballSpot(drive.firstDownMarker),
    lastDriveResult: cloneDriveEndResult(drive.lastDriveResult),
    lineOfScrimmage: cloneFootballSpot(drive.lineOfScrimmage),
    state: drive.state,
    yardsToFirstDown: drive.yardsToFirstDown,
  };
}

function setFirstAndTenAt(drive: DriveModel, spot: FootballSpot): void {
  const lineOfScrimmage = cloneFootballSpot(spot);

  drive.currentDown = 1;
  drive.lineOfScrimmage = lineOfScrimmage;
  drive.firstDownMarker = calculateFirstDownMarker(lineOfScrimmage);
  drive.lastDriveResult = null;
  drive.state = 'active';
  drive.yardsToFirstDown = calculateYardsToMarker(lineOfScrimmage, drive.firstDownMarker);
}

function calculateFirstDownMarker(lineOfScrimmage: FootballSpot): FootballSpot {
  return {
    x: 0,
    z: Math.min(
      OPPOSING_GOAL_LINE_Z,
      lineOfScrimmage.z + DRIVE_CONFIG.firstDownYards,
    ),
  };
}

function calculateYardsToMarker(lineOfScrimmage: FootballSpot, marker: FootballSpot): number {
  return Math.max(0, worldUnitsToFootballYards(marker.z - lineOfScrimmage.z));
}

function hasReachedLineToGain(drive: DriveModel, spot: FootballSpot): boolean {
  return spot.z >= drive.firstDownMarker.z - SPOT_EPSILON;
}

function nextDown(down: Down): Down {
  return Math.min(DRIVE_CONFIG.maxDown, down + 1) as Down;
}

function createDriveEndResult(type: DriveEndType): DriveEndResult {
  return {
    nextDriveStartSpot: cloneFootballSpot(DRIVE_CONFIG.startingBallSpot),
    reason: type,
    type,
  };
}

function createDriveUpdate(
  applied: boolean,
  driveEnded: boolean,
  newFirstDown: boolean,
  nextBallSpot: FootballSpot,
): DriveUpdate {
  return {
    applied,
    driveEnded,
    newFirstDown,
    nextBallSpot: cloneFootballSpot(nextBallSpot),
  };
}

function cloneDriveEndResult(result: DriveEndResult | null): DriveEndResult | null {
  if (!result) {
    return null;
  }

  return {
    nextDriveStartSpot: cloneFootballSpot(result.nextDriveStartSpot),
    reason: result.reason,
    type: result.type,
  };
}
