import { describe, expect, it } from 'vitest';
import {
  changePossessionFieldPosition,
  createFreeKickTouchbackPosition,
  DEFAULT_TOUCHBACK_RULES,
  createOpponentYardLinePosition,
  createOtherTouchbackPosition,
  createOwnYardLinePosition,
  formatPossessionFieldPosition,
  offenseSpotToPossessionFieldPosition,
  possessionFieldPositionToOffenseSpot,
  possessionFieldPositionToWorldSpot,
  worldSpotToPossessionFieldPosition,
} from '../../src/match/FieldPositionModel';

describe('possession-relative field position model', () => {
  it('resolves free-kick and other touchbacks from explicit rules', () => {
    expect(createFreeKickTouchbackPosition()).toEqual({
      lateralX: 0,
      yardsFromOwnGoalLine: 25,
    });
    expect(createOtherTouchbackPosition()).toEqual({
      lateralX: 0,
      yardsFromOwnGoalLine: 20,
    });
    expect(DEFAULT_TOUCHBACK_RULES.defaultSnapLane).toBe('middle');
  });

  it('converts own yard lines into offense-relative spots', () => {
    expect(possessionFieldPositionToOffenseSpot(createOwnYardLinePosition(25))).toEqual({
      x: 0,
      z: -25,
    });
    expect(possessionFieldPositionToOffenseSpot(createOwnYardLinePosition(20))).toEqual({
      x: 0,
      z: -30,
    });
    expect(possessionFieldPositionToOffenseSpot(createOpponentYardLinePosition(35))).toEqual({
      x: 0,
      z: 15,
    });
  });

  it('changes possession by mirroring yard line and lateral position exactly once', () => {
    const original = createOpponentYardLinePosition(35, 7);
    const changed = changePossessionFieldPosition(original);

    expect(changed).toEqual({
      lateralX: -7,
      yardsFromOwnGoalLine: 35,
    });
    expect(changePossessionFieldPosition(changed)).toEqual(original);
    expect(changePossessionFieldPosition(createOwnYardLinePosition(50, 3))).toEqual({
      lateralX: -3,
      yardsFromOwnGoalLine: 50,
    });
  });

  it('converts between world and possession frames for either possessing team', () => {
    const userOwn25World = possessionFieldPositionToWorldSpot(createOwnYardLinePosition(25, 4), 'user');
    const opponentOwn25World = possessionFieldPositionToWorldSpot(createOwnYardLinePosition(25, 4), 'opponent');

    expect(userOwn25World).toEqual({ x: 4, z: -25 });
    expect(opponentOwn25World).toEqual({ x: -4, z: 25 });
    expect(worldSpotToPossessionFieldPosition(userOwn25World, 'user')).toEqual({
      lateralX: 4,
      yardsFromOwnGoalLine: 25,
    });
    expect(worldSpotToPossessionFieldPosition(opponentOwn25World, 'opponent')).toEqual({
      lateralX: 4,
      yardsFromOwnGoalLine: 25,
    });
  });

  it('formats own, midfield, and opponent territory independently of UI teams', () => {
    expect(formatPossessionFieldPosition(createOwnYardLinePosition(25))).toBe('OWN 25');
    expect(formatPossessionFieldPosition(createOwnYardLinePosition(42))).toBe('OWN 42');
    expect(formatPossessionFieldPosition(createOwnYardLinePosition(50))).toBe('MIDFIELD');
    expect(formatPossessionFieldPosition(createOpponentYardLinePosition(38))).toBe('OPP 38');
    expect(formatPossessionFieldPosition(createOpponentYardLinePosition(5))).toBe('OPP 5');
  });

  it('round-trips offense-relative spots through the canonical model', () => {
    const position = offenseSpotToPossessionFieldPosition({ x: -6, z: 12 });

    expect(position).toEqual({
      lateralX: -6,
      yardsFromOwnGoalLine: 62,
    });
    expect(possessionFieldPositionToOffenseSpot(position)).toEqual({ x: -6, z: 12 });
  });
});
