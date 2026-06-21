import { describe, expect, it } from 'vitest';
import { INITIAL_BALL_SPOT, LINE_OF_SCRIMMAGE_Z } from '../src/field';
import {
  DRIVE_CONFIG,
  applyPlayResultToDrive,
  createDriveModel,
  resetDriveModel,
  type DrivePlayResult,
} from '../src/driveModel';
import type { FootballSpot } from '../src/fieldScale';

describe('drive and down model', () => {
  it('starts a drive at first-and-10 from the configured starting spot', () => {
    const drive = createDriveModel();

    expect(drive.currentDown).toBe(1);
    expect(drive.lineOfScrimmage).toEqual(INITIAL_BALL_SPOT);
    expect(drive.firstDownMarker).toEqual({
      x: 0,
      z: LINE_OF_SCRIMMAGE_Z + DRIVE_CONFIG.firstDownYards,
    });
    expect(drive.yardsToFirstDown).toBe(10);
    expect(drive.state).toBe('active');
  });

  it('turns a three-yard first-down run into second-and-7', () => {
    const drive = createDriveModel();
    const endingSpot = { x: 0, z: LINE_OF_SCRIMMAGE_Z + 3 };

    const update = applyPlayResultToDrive(drive, createPlayResult(1, 'tackle', endingSpot));

    expect(update).toMatchObject({
      applied: true,
      driveEnded: false,
      newFirstDown: false,
      nextBallSpot: endingSpot,
    });
    expect(drive.currentDown).toBe(2);
    expect(drive.lineOfScrimmage).toEqual(endingSpot);
    expect(drive.firstDownMarker).toEqual({
      x: 0,
      z: LINE_OF_SCRIMMAGE_Z + DRIVE_CONFIG.firstDownYards,
    });
    expect(drive.yardsToFirstDown).toBeCloseTo(7);
  });

  it('advances the down without moving the ball after an incomplete pass', () => {
    const drive = createDriveModel();

    const update = applyPlayResultToDrive(drive, createPlayResult(1, 'incomplete', INITIAL_BALL_SPOT));

    expect(update).toMatchObject({
      applied: true,
      driveEnded: false,
      newFirstDown: false,
      nextBallSpot: INITIAL_BALL_SPOT,
    });
    expect(drive.currentDown).toBe(2);
    expect(drive.lineOfScrimmage).toEqual(INITIAL_BALL_SPOT);
    expect(drive.yardsToFirstDown).toBeCloseTo(10);
  });

  it('advances the down and spots the ball after a sack', () => {
    const drive = createDriveModel();
    const sackSpot = { x: 0, z: LINE_OF_SCRIMMAGE_Z - 5 };

    const update = applyPlayResultToDrive(drive, createPlayResult(1, 'sack', sackSpot));

    expect(update).toMatchObject({
      applied: true,
      driveEnded: false,
      newFirstDown: false,
      nextBallSpot: sackSpot,
    });
    expect(drive.currentDown).toBe(2);
    expect(drive.lineOfScrimmage).toEqual(sackSpot);
    expect(drive.yardsToFirstDown).toBeCloseTo(15);
  });


  it('awards first-and-10 when the line to gain is reached', () => {
    const drive = createDriveModel();
    const endingSpot = {
      x: 0,
      z: LINE_OF_SCRIMMAGE_Z + DRIVE_CONFIG.firstDownYards,
    };

    const update = applyPlayResultToDrive(drive, createPlayResult(1, 'tackle', endingSpot));

    expect(update).toMatchObject({
      applied: true,
      driveEnded: false,
      newFirstDown: true,
      nextBallSpot: endingSpot,
    });
    expect(drive.currentDown).toBe(1);
    expect(drive.lineOfScrimmage).toEqual(endingSpot);
    expect(drive.firstDownMarker).toEqual({
      x: 0,
      z: endingSpot.z + DRIVE_CONFIG.firstDownYards,
    });
    expect(drive.yardsToFirstDown).toBeCloseTo(10);
  });

  it('ends the drive when fourth down fails', () => {
    const drive = createDriveModel();

    applyPlayResultToDrive(drive, createPlayResult(1, 'tackle', { x: 0, z: LINE_OF_SCRIMMAGE_Z }));
    applyPlayResultToDrive(drive, createPlayResult(2, 'tackle', { x: 0, z: LINE_OF_SCRIMMAGE_Z }));
    applyPlayResultToDrive(drive, createPlayResult(3, 'tackle', { x: 0, z: LINE_OF_SCRIMMAGE_Z }));
    const update = applyPlayResultToDrive(
      drive,
      createPlayResult(4, 'tackle', { x: 0, z: LINE_OF_SCRIMMAGE_Z }),
    );

    expect(update).toMatchObject({
      applied: true,
      driveEnded: true,
      newFirstDown: false,
      nextBallSpot: INITIAL_BALL_SPOT,
    });
    expect(drive.currentDown).toBe(4);
    expect(drive.state).toBe('over');
    expect(drive.lastDriveResult).toMatchObject({
      nextDriveStartSpot: INITIAL_BALL_SPOT,
      reason: 'turnoverOnDowns',
      type: 'turnoverOnDowns',
    });
  });

  it('resets the next drive to first-and-10 after a touchdown', () => {
    const drive = createDriveModel();
    const update = applyPlayResultToDrive(
      drive,
      createPlayResult(1, 'touchdown', { x: 0, z: 50 }),
    );

    expect(update).toMatchObject({
      applied: true,
      driveEnded: true,
      newFirstDown: false,
      nextBallSpot: INITIAL_BALL_SPOT,
    });
    expect(drive.lastDriveResult?.type).toBe('touchdown');

    resetDriveModel(drive, drive.lastDriveResult?.nextDriveStartSpot);

    expect(drive.currentDown).toBe(1);
    expect(drive.lineOfScrimmage).toEqual(INITIAL_BALL_SPOT);
    expect(drive.yardsToFirstDown).toBe(10);
    expect(drive.state).toBe('active');
    expect(drive.lastDriveResult).toBeNull();
  });

  it('does not apply the same play result more than once', () => {
    const drive = createDriveModel();
    const result = createPlayResult(1, 'tackle', { x: 0, z: LINE_OF_SCRIMMAGE_Z + 3 });

    expect(applyPlayResultToDrive(drive, result).applied).toBe(true);
    expect(drive.currentDown).toBe(2);
    expect(drive.yardsToFirstDown).toBeCloseTo(7);

    expect(applyPlayResultToDrive(drive, result)).toMatchObject({
      applied: false,
      driveEnded: false,
      newFirstDown: false,
    });
    expect(drive.currentDown).toBe(2);
    expect(drive.yardsToFirstDown).toBeCloseTo(7);
  });
});

function createPlayResult(
  id: number,
  type: DrivePlayResult['type'],
  endingBallSpot: FootballSpot,
): DrivePlayResult {
  return {
    endingBallSpot,
    id,
    reason: type,
    scoringTeam: type === 'touchdown' ? 'offense' : null,
    startingBallSpot: INITIAL_BALL_SPOT,
    type,
    yardsGained: endingBallSpot.z - INITIAL_BALL_SPOT.z,
  };
}
