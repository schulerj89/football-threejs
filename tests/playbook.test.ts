import { describe, expect, it } from 'vitest';
import { INITIAL_BALL_SPOT, PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { STABLE_PLAYER_IDS } from '../src/formationLayout';
import { PLAYER_MOVEMENT_CONFIG } from '../src/playerModel';
import {
  createFormationPlayers,
  getAvailablePlays,
  getBlockingLaneTarget,
  getCoverageAssignmentReceiverId,
  getDefaultPlayId,
  getDeepHelpReceiverIds,
  getEligibleReceiverIds,
  getNextEligibleReceiverId,
  getPlay,
  getProtectionAssignmentDefenderId,
  getReceiverDisplayName,
  getReceiverRouteTarget,
  getRushingPlay,
  resetFormationPlayers,
} from '../src/playbook';
import { createSnapPlacementForLane } from '../src/formationPreview';
import { resolveFormation } from '../src/formationLayout';
import {
  ELEVEN_ON_ELEVEN_PLAYER_IDS,
  SEVEN_ON_SEVEN_PLAYER_IDS,
} from '../src/roster';

describe('playbook', () => {
  it('looks up the stable rushing and passing plays', () => {
    expect(getRushingPlay('inside-run')).toMatchObject({
      ballCarrierRole: 'runner',
      displayName: 'Inside Run',
      id: 'inside-run',
      initialMovementDirection: { x: 0, z: 1 },
      kind: 'run',
    });
    expect(getRushingPlay('outside-run')).toMatchObject({
      ballCarrierRole: 'runner',
      displayName: 'Outside Run',
      id: 'outside-run',
      initialMovementDirection: { x: 0, z: 1 },
      kind: 'run',
    });
    expect(getPlay('quick-pass')).toMatchObject({
      ballCarrierRole: 'quarterback',
      displayName: 'Quick Pass',
      id: 'quick-pass',
      initialMovementDirection: { x: 0, z: 1 },
      kind: 'pass',
      pass: { eligibleReceiverIds: ['offense-wr'] },
    });
    expect(getPlay('slant-flat')).toMatchObject({
      ballCarrierRole: 'quarterback',
      displayName: 'Slant Flat',
      id: 'slant-flat',
      initialMovementDirection: { x: 0, z: 1 },
      kind: 'pass',
      pass: { eligibleReceiverIds: ['offense-wr', 'offense-rb'] },
    });
  });

  it('rejects invalid play IDs', () => {
    expect(() => getPlay('fake-run')).toThrow('Unknown play fake-run');
  });

  it('places each play with the stable five-on-five roster', () => {
    const insidePlayers = createFormationPlayers(INITIAL_BALL_SPOT, getRushingPlay('inside-run'));
    const outsidePlayers = createFormationPlayers(INITIAL_BALL_SPOT, getRushingPlay('outside-run'));

    expect(insidePlayers.map((player) => player.id).sort()).toEqual([...STABLE_PLAYER_IDS].sort());
    expect(outsidePlayers).toHaveLength(10);
    expect(insidePlayers.filter((player) => player.team === 'offense')).toHaveLength(5);
    expect(insidePlayers.filter((player) => player.team === 'defense')).toHaveLength(5);
    expect(getPlayer(insidePlayers, 'offense-rb')).toMatchObject({
      position: { x: INITIAL_BALL_SPOT.x, z: INITIAL_BALL_SPOT.z - 8 },
      role: 'runner',
    });
    expect(getPlayer(outsidePlayers, 'offense-rb').position.x).toBeGreaterThan(
      getPlayer(insidePlayers, 'offense-rb').position.x,
    );
  });

  it('provides different blocker lane targets for inside and outside runs', () => {
    const insidePlay = getRushingPlay('inside-run');
    const outsidePlay = getRushingPlay('outside-run');
    const insideBlocker = getPlayer(
      createFormationPlayers(INITIAL_BALL_SPOT, insidePlay),
      'offense-blocker-left',
    );
    const outsideBlocker = getPlayer(
      createFormationPlayers(INITIAL_BALL_SPOT, outsidePlay),
      'offense-blocker-left',
    );

    expect(getBlockingLaneTarget(outsideBlocker, INITIAL_BALL_SPOT, outsidePlay).x).toBeGreaterThan(
      getBlockingLaneTarget(insideBlocker, INITIAL_BALL_SPOT, insidePlay).x,
    );
  });

  it('places Quick Pass roles and route data from the selected play definition', () => {
    const quickPass = getPlay('quick-pass');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, quickPass);
    const quarterback = getPlayer(players, 'offense-qb');
    const receiver = getPlayer(players, 'offense-wr');
    const blocker = getPlayer(players, 'offense-blocker-right');
    const runningBack = getPlayer(players, 'offense-rb');
    const coverageDefender = getPlayer(players, 'defense-cover-wr');

    expect(quarterback).toMatchObject({ role: 'quarterback', team: 'offense' });
    expect(receiver).toMatchObject({ role: 'receiver', team: 'offense' });
    expect(blocker).toMatchObject({ role: 'blocker', team: 'offense' });
    expect(runningBack).toMatchObject({ role: 'blocker', team: 'offense' });
    expect(coverageDefender).toMatchObject({ role: 'coverageDefender', team: 'defense' });
    expect(getReceiverRouteTarget(receiver, INITIAL_BALL_SPOT, quickPass)).toEqual({
      x: 0,
      z: INITIAL_BALL_SPOT.z + 11,
    });
    expect(getEligibleReceiverIds(quickPass)).toEqual(['offense-wr']);
    expect(getReceiverDisplayName(quickPass, 'offense-wr')).toBe('Receiver');
  });

  it('places Slant Flat roles and two data-defined receiver routes', () => {
    const slantFlat = getPlay('slant-flat');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, slantFlat);
    const quarterback = getPlayer(players, 'offense-qb');
    const wideReceiver = getPlayer(players, 'offense-wr');
    const runningBack = getPlayer(players, 'offense-rb');
    const wideCoverage = getPlayer(players, 'defense-cover-wr');
    const runningBackCoverage = getPlayer(players, 'defense-cover-rb');
    const passRusher = getPlayer(players, 'defense-rusher-left');

    expect(quarterback).toMatchObject({ role: 'quarterback', team: 'offense' });
    expect(wideReceiver).toMatchObject({ role: 'receiver', team: 'offense' });
    expect(runningBack).toMatchObject({ role: 'receiver', team: 'offense' });
    expect(wideCoverage).toMatchObject({ role: 'coverageDefender', team: 'defense' });
    expect(runningBackCoverage).toMatchObject({ role: 'coverageDefender', team: 'defense' });
    expect(passRusher).toMatchObject({ role: 'defender', team: 'defense' });
    expect(getEligibleReceiverIds(slantFlat)).toEqual(['offense-wr', 'offense-rb']);
    expect(getReceiverRouteTarget(wideReceiver, INITIAL_BALL_SPOT, slantFlat)).toEqual({
      x: 0,
      z: INITIAL_BALL_SPOT.z + 11,
    });
    expect(getReceiverRouteTarget(runningBack, INITIAL_BALL_SPOT, slantFlat)?.x).toBeLessThan(0);
    expect(getReceiverRouteTarget(runningBack, INITIAL_BALL_SPOT, slantFlat)?.z).toBe(
      INITIAL_BALL_SPOT.z + 5,
    );
    expect(getReceiverDisplayName(slantFlat, 'offense-wr')).toBe('Slant');
    expect(getReceiverDisplayName(slantFlat, 'offense-rb')).toBe('Flat');
  });

  it('keeps sideline formation positions and route targets inside the playable field', () => {
    const slantFlat = getPlay('slant-flat');
    const sidelineSpot = {
      x: PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.collisionRadius,
      z: INITIAL_BALL_SPOT.z,
    };
    const players = createFormationPlayers(sidelineSpot, slantFlat);
    const runningBack = getPlayer(players, 'offense-rb');
    const routeTarget = getReceiverRouteTarget(runningBack, sidelineSpot, slantFlat);

    for (const player of players) {
      expect(player.position.x).toBeLessThanOrEqual(
        PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.collisionRadius,
      );
      expect(player.position.x).toBeGreaterThanOrEqual(
        PLAYABLE_FIELD_BOUNDS.minX + PLAYER_MOVEMENT_CONFIG.collisionRadius,
      );
    }

    expect(routeTarget).toEqual(expect.any(Object));
    expect(routeTarget?.x).toBeLessThanOrEqual(
      PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.collisionRadius,
    );
  });

  it('resets stable player IDs into the newly selected play roles', () => {
    const players = createFormationPlayers(INITIAL_BALL_SPOT, getPlay('inside-run'));

    resetFormationPlayers(players, INITIAL_BALL_SPOT, getPlay('quick-pass'));

    expect(getPlayer(players, 'offense-qb').role).toBe('quarterback');
    expect(getPlayer(players, 'offense-wr').role).toBe('receiver');
    expect(getPlayer(players, 'offense-rb').role).toBe('blocker');
    expect(getPlayer(players, 'defense-cover-wr').role).toBe('coverageDefender');
  });

  it('defines a four-play 7v7 playbook as an explicit regression mode', () => {
    const plays = getAvailablePlays('7v7');

    expect(getDefaultPlayId('7v7')).toBe('inside-zone-7');
    expect(plays.map((candidate) => candidate.displayName)).toEqual([
      'Inside Zone 7',
      'Outside Zone 7',
      'Quick Pass 7',
      'Twin Slants Flat',
    ]);

    for (const play of plays) {
      const players = createFormationPlayers(INITIAL_BALL_SPOT, play);

      expect(play).toMatchObject({
        playbookId: '7v7',
        roster: { id: '7v7' },
      });
      expect(players.map((player) => player.id).sort()).toEqual([...SEVEN_ON_SEVEN_PLAYER_IDS].sort());
      expect(players).toHaveLength(14);
      expect(players.filter((player) => player.team === 'offense')).toHaveLength(7);
      expect(players.filter((player) => player.team === 'defense')).toHaveLength(7);
    }
  });

  it('uses running back possession for 7v7 runs and quarterback possession for 7v7 passes', () => {
    for (const playId of ['inside-zone-7', 'outside-zone-7']) {
      const play = getPlay(playId);
      const players = createFormationPlayers(INITIAL_BALL_SPOT, play);

      expect(play.ballCarrierRole).toBe('runner');
      expect(getPlayer(players, 'offense-rb')).toMatchObject({
        role: 'runner',
        team: 'offense',
      });
      expect(getPlayer(players, 'offense-qb')).toMatchObject({
        role: 'quarterback',
        team: 'offense',
      });
    }

    for (const playId of ['quick-pass-7', 'twin-slants-flat']) {
      const play = getPlay(playId);
      const players = createFormationPlayers(INITIAL_BALL_SPOT, play);

      expect(play.ballCarrierRole).toBe('quarterback');
      expect(getPlayer(players, 'offense-qb')).toMatchObject({
        role: 'quarterback',
        team: 'offense',
      });
    }
  });

  it('declares explicit one-to-one 7v7 run blocking assignments without linebacker or safety targets', () => {
    for (const playId of ['inside-zone-7', 'outside-zone-7']) {
      const play = getPlay(playId);
      const assignedDefenders = Object.values(play.protectionAssignments ?? {});

      expect(play.kind).toBe('run');
      expect(assignedDefenders).toHaveLength(5);
      expect(new Set(assignedDefenders).size).toBe(assignedDefenders.length);
      expect(assignedDefenders).not.toContain('defense-linebacker');
      expect(assignedDefenders).not.toContain('defense-safety');
      expect(getProtectionAssignmentDefenderId(play, 'offense-center')).toBe('defense-line-middle');
      expect(getProtectionAssignmentDefenderId(play, 'offense-line-left')).toBe('defense-line-left');
      expect(getProtectionAssignmentDefenderId(play, 'offense-line-right')).toBe('defense-line-right');
    }
  });

  it('defines Quick Pass 7 with three eligible receivers and distinct ordered routes', () => {
    const play = getPlay('quick-pass-7');

    expect(play).toMatchObject({
      ballCarrierRole: 'quarterback',
      displayName: 'Quick Pass 7',
      id: 'quick-pass-7',
      kind: 'pass',
      playbookId: '7v7',
    });
    expect(getEligibleReceiverIds(play)).toEqual([
      'offense-wr-left',
      'offense-wr-right',
      'offense-rb',
    ]);
    expect(play.receiverRoutes?.['offense-wr-left']?.waypoints.map((waypoint) => waypoint.id)).toEqual([
      'stem',
      'out',
    ]);
    expect(play.receiverRoutes?.['offense-wr-right']?.waypoints.map((waypoint) => waypoint.id)).toEqual([
      'clear-stem',
      'short-slant',
    ]);
    expect(play.receiverRoutes?.['offense-rb']?.waypoints.map((waypoint) => waypoint.id)).toEqual([
      'release',
      'checkdown',
    ]);
  });

  it('preserves Twin Slants Flat with three ordered receivers', () => {
    const play = getPlay('twin-slants-flat');

    expect(play).toMatchObject({
      ballCarrierRole: 'quarterback',
      displayName: 'Twin Slants Flat',
      id: 'twin-slants-flat',
      kind: 'pass',
      playbookId: '7v7',
      roster: { id: '7v7' },
    });
    expect(getEligibleReceiverIds(play)).toEqual([
      'offense-wr-left',
      'offense-wr-right',
      'offense-rb',
    ]);
    expect(getReceiverDisplayName(play, 'offense-wr-left')).toBe('Receiver Left');
    expect(getReceiverDisplayName(play, 'offense-wr-right')).toBe('Receiver Right');
    expect(getReceiverDisplayName(play, 'offense-rb')).toBe('Running Back');
  });

  it('resolves Twin Slants Flat routes from semantic field-side formation data', () => {
    const play = getPlay('twin-slants-flat');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, play);
    const leftReceiver = getPlayer(players, 'offense-wr-left');
    const rightReceiver = getPlayer(players, 'offense-wr-right');
    const runningBack = getPlayer(players, 'offense-rb');
    const leftRoute = getReceiverRouteTarget(leftReceiver, INITIAL_BALL_SPOT, play);
    const rightRoute = getReceiverRouteTarget(rightReceiver, INITIAL_BALL_SPOT, play);
    const flatRoute = getReceiverRouteTarget(runningBack, INITIAL_BALL_SPOT, play);

    expect(leftRoute?.x).toBeGreaterThan(leftReceiver.position.x);
    expect(leftRoute?.z).toBe(INITIAL_BALL_SPOT.z + 12);
    expect(rightRoute?.x).toBeLessThan(rightReceiver.position.x);
    expect(rightRoute?.z).toBe(INITIAL_BALL_SPOT.z + 12);
    expect(flatRoute?.x).toBeGreaterThan(runningBack.position.x);
    expect(flatRoute?.z).toBe(INITIAL_BALL_SPOT.z + 4.5);
    expect(flatRoute?.x).toBeLessThanOrEqual(
      PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.collisionRadius,
    );
  });

  it('declares distinct pass-protection and coverage assignments for Twin Slants Flat', () => {
    const play = getPlay('twin-slants-flat');

    expect(getProtectionAssignmentDefenderId(play, 'offense-center')).toBe('defense-line-middle');
    expect(getProtectionAssignmentDefenderId(play, 'offense-line-left')).toBe('defense-line-left');
    expect(getProtectionAssignmentDefenderId(play, 'offense-line-right')).toBe('defense-line-right');
    expect(new Set(Object.values(play.protectionAssignments ?? {})).size).toBe(3);
    expect(getCoverageAssignmentReceiverId(play, 'defense-corner-left')).toBe('offense-wr-left');
    expect(getCoverageAssignmentReceiverId(play, 'defense-corner-right')).toBe('offense-wr-right');
    expect(getCoverageAssignmentReceiverId(play, 'defense-linebacker')).toBe('offense-rb');
  });

  it('aligns the Twin Slants Flat safety to the wide receiver midpoint at every snap lane', () => {
    const play = getPlay('twin-slants-flat');

    for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
      const formation = resolveFormation(play, createSnapPlacementForLane(lane));
      const leftReceiver = getPlayer(formation.slots, 'offense-wr-left');
      const rightReceiver = getPlayer(formation.slots, 'offense-wr-right');
      const safety = getPlayer(formation.slots, 'defense-safety');
      const expectedX = (leftReceiver.position.x + rightReceiver.position.x) / 2;

      expect(formation.issues).toEqual([]);
      expect(safety.position.x).toBeCloseTo(expectedX);
    }
  });

  it('defines 11v11 as the default two-play normal playbook', () => {
    const plays = getAvailablePlays('11v11');
    const play = getPlay('inside-zone-11');

    expect(getDefaultPlayId('11v11')).toBe('inside-zone-11');
    expect(getAvailablePlays().map((candidate) => candidate.id)).toEqual([
      'inside-zone-11',
      'spread-quick-11',
    ]);
    expect(plays.map((candidate) => candidate.id)).toEqual([
      'inside-zone-11',
      'spread-quick-11',
    ]);
    expect(play).toMatchObject({
      ballCarrierRole: 'runner',
      displayName: 'Inside Zone 11',
      id: 'inside-zone-11',
      kind: 'run',
      playbookId: '11v11',
      roster: { id: '11v11' },
    });
  });

  it('defines Spread Quick 11 with five ordered receivers, protection, and coverage', () => {
    const play = getPlay('spread-quick-11');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, play);
    const assignedRushers = Object.values(play.protectionAssignments ?? {});

    expect(play).toMatchObject({
      ballCarrierRole: 'quarterback',
      displayName: 'Spread Quick 11',
      id: 'spread-quick-11',
      kind: 'pass',
      playbookId: '11v11',
      roster: { id: '11v11' },
    });
    expect(players).toHaveLength(22);
    expect(players.filter((player) => player.team === 'offense')).toHaveLength(11);
    expect(players.filter((player) => player.team === 'defense')).toHaveLength(11);
    expect(getEligibleReceiverIds(play)).toEqual([
      'offense-wr-left',
      'offense-wr-right',
      'offense-slot',
      'offense-tight-end',
      'offense-rb',
    ]);
    expect(getNextEligibleReceiverId(play, 'offense-wr-left')).toBe('offense-wr-right');
    expect(getNextEligibleReceiverId(play, 'offense-wr-right')).toBe('offense-slot');
    expect(getNextEligibleReceiverId(play, 'offense-slot')).toBe('offense-tight-end');
    expect(getNextEligibleReceiverId(play, 'offense-tight-end')).toBe('offense-rb');
    expect(getNextEligibleReceiverId(play, 'offense-rb')).toBe('offense-wr-left');
    expect(Object.keys(play.protectionAssignments ?? {}).sort()).toEqual([
      'offense-center',
      'offense-line-left',
      'offense-line-right',
      'offense-tackle-left',
      'offense-tackle-right',
    ]);
    expect(assignedRushers).toHaveLength(5);
    expect(new Set(assignedRushers).size).toBe(5);
    expect(getProtectionAssignmentDefenderId(play, 'offense-center')).toBe('defense-line-middle');
    expect(getProtectionAssignmentDefenderId(play, 'offense-tackle-left')).toBe('defense-linebacker-left');
    expect(getProtectionAssignmentDefenderId(play, 'offense-tackle-right')).toBe('defense-linebacker-right');
    expect(getCoverageAssignmentReceiverId(play, 'defense-corner-left')).toBe('offense-wr-left');
    expect(getCoverageAssignmentReceiverId(play, 'defense-corner-right')).toBe('offense-wr-right');
    expect(getCoverageAssignmentReceiverId(play, 'defense-linebacker')).toBe('offense-rb');
    expect(getCoverageAssignmentReceiverId(play, 'defense-linebacker-inside')).toBe('offense-tight-end');
    expect(getCoverageAssignmentReceiverId(play, 'defense-safety-strong')).toBe('offense-slot');
    expect(getDeepHelpReceiverIds(play, 'defense-safety')).toEqual([
      'offense-wr-left',
      'offense-wr-right',
      'offense-slot',
      'offense-tight-end',
      'offense-rb',
    ]);
    expect(getReceiverDisplayName(play, 'offense-tight-end')).toBe('Tight End');
  });

  it('resolves Spread Quick 11 routes semantically at every snap lane', () => {
    const play = getPlay('spread-quick-11');

    for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
      const snapPlacement = createSnapPlacementForLane(lane);
      const formation = resolveFormation(play, snapPlacement);
      const players = createFormationPlayers(snapPlacement.spot, play);
      const leftReceiverSlot = getPlayer(formation.slots, 'offense-wr-left');
      const rightReceiverSlot = getPlayer(formation.slots, 'offense-wr-right');
      const slotSlot = getPlayer(formation.slots, 'offense-slot');
      const tightEndSlot = getPlayer(formation.slots, 'offense-tight-end');
      const runningBackSlot = getPlayer(formation.slots, 'offense-rb');
      const freeSafety = getPlayer(formation.slots, 'defense-safety');
      const leftReceiver = getPlayer(players, 'offense-wr-left');
      const rightReceiver = getPlayer(players, 'offense-wr-right');
      const slot = getPlayer(players, 'offense-slot');
      const tightEnd = getPlayer(players, 'offense-tight-end');
      const runningBack = getPlayer(players, 'offense-rb');
      const expectedSafetyX =
        (leftReceiverSlot.position.x +
          rightReceiverSlot.position.x +
          slotSlot.position.x +
          tightEndSlot.position.x +
          runningBackSlot.position.x) / 5;
      const leftRoute = getReceiverRouteTarget(leftReceiver, snapPlacement.spot, play);
      const tightEndRoute = getReceiverRouteTarget(tightEnd, snapPlacement.spot, play);
      const runningBackRoute = getReceiverRouteTarget(runningBack, snapPlacement.spot, play);

      expect(formation.issues).toEqual([]);
      expect(freeSafety.position.x).toBeCloseTo(expectedSafetyX);
      expect(leftRoute?.z).toBeGreaterThan(leftReceiver.position.z);
      expect(leftRoute?.x).toBeCloseTo(
        lane === 'rightHash' ? snapPlacement.spot.x - 4 : snapPlacement.spot.x + 4,
      );
      expect(getReceiverRouteTarget(rightReceiver, snapPlacement.spot, play)?.x).toBeCloseTo(
        rightReceiver.position.x,
      );
      expect(getReceiverRouteTarget(slot, snapPlacement.spot, play)?.z).toBeGreaterThan(slot.position.z);
      expect(tightEndRoute?.x).toBeGreaterThanOrEqual(PLAYABLE_FIELD_BOUNDS.minX);
      expect(tightEndRoute?.x).toBeLessThanOrEqual(PLAYABLE_FIELD_BOUNDS.maxX);
      expect(runningBackRoute?.x).toBeGreaterThanOrEqual(PLAYABLE_FIELD_BOUNDS.minX);
      expect(runningBackRoute?.x).toBeLessThanOrEqual(PLAYABLE_FIELD_BOUNDS.maxX);
    }
  });

  it('places Inside Zone 11 with twenty-two players and running back possession role', () => {
    const play = getPlay('inside-zone-11');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, play);

    expect(players.map((player) => player.id).sort()).toEqual([...ELEVEN_ON_ELEVEN_PLAYER_IDS].sort());
    expect(players).toHaveLength(22);
    expect(players.filter((player) => player.team === 'offense')).toHaveLength(11);
    expect(players.filter((player) => player.team === 'defense')).toHaveLength(11);
    expect(getPlayer(players, 'offense-rb')).toMatchObject({
      role: 'runner',
      team: 'offense',
    });
    expect(getPlayer(players, 'offense-qb')).toMatchObject({
      role: 'quarterback',
      team: 'offense',
    });
  });

  it('declares one-to-one Inside Zone 11 blocking assignments and leaves safeties unblocked', () => {
    const play = getPlay('inside-zone-11');
    const assignments = play.protectionAssignments ?? {};
    const assignedDefenders = Object.values(assignments);

    expect(Object.keys(assignments).sort()).toEqual([
      'offense-center',
      'offense-line-left',
      'offense-line-right',
      'offense-slot',
      'offense-tackle-left',
      'offense-tackle-right',
      'offense-tight-end',
      'offense-wr-left',
      'offense-wr-right',
    ]);
    expect(assignedDefenders).toHaveLength(9);
    expect(new Set(assignedDefenders).size).toBe(assignedDefenders.length);
    expect(assignedDefenders).not.toContain('defense-safety');
    expect(assignedDefenders).not.toContain('defense-safety-strong');
    expect(getProtectionAssignmentDefenderId(play, 'offense-center')).toBe('defense-line-middle');
    expect(getProtectionAssignmentDefenderId(play, 'offense-tackle-left')).toBe('defense-linebacker-left');
    expect(getProtectionAssignmentDefenderId(play, 'offense-tight-end')).toBe('defense-linebacker-inside');
    expect(getProtectionAssignmentDefenderId(play, 'offense-slot')).toBe('defense-linebacker');
  });

  it('resolves Inside Zone 11 at every snap lane without corrupting assignments', () => {
    const play = getPlay('inside-zone-11');

    for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
      const snapPlacement = createSnapPlacementForLane(lane);
      const snapSpot = { x: snapPlacement.spot.x, z: INITIAL_BALL_SPOT.z };
      const formation = resolveFormation(play, snapPlacement);
      const players = createFormationPlayers(snapSpot, play);

      expect(formation.issues).toEqual([]);
      expect(players).toHaveLength(22);
      for (const [blockerId, defenderId] of Object.entries(play.protectionAssignments ?? {})) {
        const blocker = getPlayer(players, blockerId);
        const defender = getPlayer(players, defenderId);
        const laneTarget = getBlockingLaneTarget(blocker, snapSpot, play);

        expect(blocker.team).toBe('offense');
        expect(defender.team).toBe('defense');
        expect(defender.role).toBe('defender');
        expect(laneTarget.x).toBeGreaterThanOrEqual(PLAYABLE_FIELD_BOUNDS.minX);
        expect(laneTarget.x).toBeLessThanOrEqual(PLAYABLE_FIELD_BOUNDS.maxX);
        expect(laneTarget.z).toBeGreaterThan(INITIAL_BALL_SPOT.z);
      }
    }
  });
});

function getPlayer<T extends { id: string }>(players: T[], playerId: string): T {
  const player = players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Missing player ${playerId}`);
  }

  return player;
}
