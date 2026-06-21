import { describe, expect, it } from 'vitest';
import { resolveSnapPlacement, SNAP_LANE_X } from '../src/ballSpotting';
import { INITIAL_BALL_SPOT } from '../src/field';
import {
  FORMATION_MEASUREMENTS,
  OFFENSE_PLAYER_IDS,
  DEFENSE_PLAYER_IDS,
  STABLE_PLAYER_IDS,
  resolveFormation,
  validateResolvedFormation,
  type ResolvedFormation,
} from '../src/formationLayout';
import { getPlay } from '../src/playbook';
import {
  ELEVEN_ON_ELEVEN_DEFENSE_PLAYER_IDS,
  ELEVEN_ON_ELEVEN_OFFENSE_PLAYER_IDS,
  ELEVEN_ON_ELEVEN_PLAYER_IDS,
  SEVEN_ON_SEVEN_DEFENSE_PLAYER_IDS,
  SEVEN_ON_SEVEN_OFFENSE_PLAYER_IDS,
  SEVEN_ON_SEVEN_PLAYER_IDS,
} from '../src/roster';

describe('formationLayout', () => {
  it('resolves every current play to a valid five-on-five roster', () => {
    for (const playId of ['inside-run', 'outside-run', 'quick-pass', 'slant-flat']) {
      const formation = resolvePlayFormation(playId);

      expect(formation.issues).toEqual([]);
      expect(formation.slots.map((slot) => slot.id).sort()).toEqual([...STABLE_PLAYER_IDS].sort());
      expect(formation.slots.filter((slot) => slot.team === 'offense').map((slot) => slot.id).sort()).toEqual(
        [...OFFENSE_PLAYER_IDS].sort(),
      );
      expect(formation.slots.filter((slot) => slot.team === 'defense').map((slot) => slot.id).sort()).toEqual(
        [...DEFENSE_PLAYER_IDS].sort(),
      );
    }
  });

  it('resolves every 7v7 play at every snap lane with the full fourteen-player roster', () => {
    for (const playId of ['inside-zone-7', 'outside-zone-7', 'quick-pass-7', 'twin-slants-flat']) {
      for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
        const formation = resolveFormation(getPlay(playId), {
          lane,
          spot: { x: SNAP_LANE_X[lane], z: INITIAL_BALL_SPOT.z },
        });

        expect(formation.issues).toEqual([]);
        expect(formation.slots.map((slot) => slot.id).sort()).toEqual([...SEVEN_ON_SEVEN_PLAYER_IDS].sort());
        expect(formation.slots.filter((slot) => slot.team === 'offense').map((slot) => slot.id).sort()).toEqual(
          [...SEVEN_ON_SEVEN_OFFENSE_PLAYER_IDS].sort(),
        );
        expect(formation.slots.filter((slot) => slot.team === 'defense').map((slot) => slot.id).sort()).toEqual(
          [...SEVEN_ON_SEVEN_DEFENSE_PLAYER_IDS].sort(),
        );
      }
    }
  });

  it('resolves Inside Zone 11 at every snap lane with the full twenty-two-player roster', () => {
    for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
      const formation = resolveFormation(getPlay('inside-zone-11'), {
        lane,
        spot: { x: SNAP_LANE_X[lane], z: INITIAL_BALL_SPOT.z },
      });

      expect(formation.issues).toEqual([]);
      expect(formation.slots.map((slot) => slot.id).sort()).toEqual([...ELEVEN_ON_ELEVEN_PLAYER_IDS].sort());
      expect(formation.slots.filter((slot) => slot.team === 'offense').map((slot) => slot.id).sort()).toEqual(
        [...ELEVEN_ON_ELEVEN_OFFENSE_PLAYER_IDS].sort(),
      );
      expect(formation.slots.filter((slot) => slot.team === 'defense').map((slot) => slot.id).sort()).toEqual(
        [...ELEVEN_ON_ELEVEN_DEFENSE_PLAYER_IDS].sort(),
      );
    }
  });

  it('keeps the offensive blockers symmetrical around the snap', () => {
    const formation = resolvePlayFormation('inside-run');
    const leftBlocker = getSlot(formation, 'offense-blocker-left');
    const rightBlocker = getSlot(formation, 'offense-blocker-right');
    const snapX = formation.snapPlacement.spot.x;

    expect(leftBlocker.position.z).toBeCloseTo(rightBlocker.position.z);
    expect((leftBlocker.position.x + rightBlocker.position.x) / 2).toBeCloseTo(snapX);
    expect(Math.abs(leftBlocker.position.x - snapX)).toBeCloseTo(
      FORMATION_MEASUREMENTS.blockerSpacing,
    );
    expect(Math.abs(rightBlocker.position.x - snapX)).toBeCloseTo(
      FORMATION_MEASUREMENTS.blockerSpacing,
    );
  });

  it('chooses the wide field side from hash placement without hard-coded outside-run signs', () => {
    const leftHashFormation = resolveFormation(
      getPlay('outside-run'),
      resolveSnapPlacement({ x: SNAP_LANE_X.leftHash, z: INITIAL_BALL_SPOT.z }),
    );
    const rightHashFormation = resolveFormation(
      getPlay('outside-run'),
      resolveSnapPlacement({ x: SNAP_LANE_X.rightHash, z: INITIAL_BALL_SPOT.z }),
    );

    expect(leftHashFormation.fieldSide).toBe('right');
    expect(rightHashFormation.fieldSide).toBe('left');
    expect(getSlot(leftHashFormation, 'offense-wr').position.x).toBeCloseTo(
      -getSlot(rightHashFormation, 'offense-wr').position.x,
    );
    expect(getSlot(leftHashFormation, 'offense-rb').lateralDistanceFromSnap).toBeGreaterThan(0);
    expect(getSlot(rightHashFormation, 'offense-rb').lateralDistanceFromSnap).toBeLessThan(0);
  });

  it('aligns rushers and coverage defenders to their semantic assignments', () => {
    const formation = resolvePlayFormation('slant-flat');

    expect(getSlot(formation, 'defense-rusher-left').position.x).toBeCloseTo(
      getSlot(formation, 'offense-blocker-left').position.x,
    );
    expect(getSlot(formation, 'defense-rusher-right').position.x).toBeCloseTo(
      getSlot(formation, 'offense-blocker-right').position.x,
    );
    expect(getSlot(formation, 'defense-cover-wr').position.x).toBeCloseTo(
      getSlot(formation, 'offense-wr').position.x,
    );
    expect(getSlot(formation, 'defense-cover-rb').position.x).toBeCloseTo(
      getSlot(formation, 'offense-rb').position.x,
    );
  });

  it('places the passing safety at the midpoint of eligible receivers', () => {
    const formation = resolvePlayFormation('slant-flat');
    const wideReceiver = getSlot(formation, 'offense-wr');
    const runningBack = getSlot(formation, 'offense-rb');
    const safety = getSlot(formation, 'defense-safety');

    expect(safety.position.x).toBeCloseTo((wideReceiver.position.x + runningBack.position.x) / 2);
  });

  it('reports invalid rosters as validation issues', () => {
    const play = getPlay('inside-run');
    const invalidFormation = resolveFormation(
      {
        ...play,
        formation: play.formation.slice(0, -1),
      },
      resolveSnapPlacement(INITIAL_BALL_SPOT),
    );

    expect(validateResolvedFormation(invalidFormation).map((issue) => issue.message)).toContain(
      'Expected five defense players, found 4',
    );
    expect(validateResolvedFormation(invalidFormation).map((issue) => issue.message)).toContain(
      'Missing stable player ID defense-safety',
    );
  });
});

function resolvePlayFormation(playId: string): ResolvedFormation {
  return resolveFormation(getPlay(playId), resolveSnapPlacement(INITIAL_BALL_SPOT));
}

function getSlot(formation: ResolvedFormation, playerId: string) {
  const slot = formation.slots.find((candidate) => candidate.id === playerId);

  if (!slot) {
    throw new Error(`Missing slot ${playerId}`);
  }

  return slot;
}
