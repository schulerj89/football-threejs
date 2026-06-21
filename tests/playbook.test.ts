import { describe, expect, it } from 'vitest';
import { INITIAL_BALL_SPOT, PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { STABLE_PLAYER_IDS } from '../src/formationLayout';
import { PLAYER_MOVEMENT_CONFIG } from '../src/playerModel';
import {
  createFormationPlayers,
  getBlockingLaneTarget,
  getEligibleReceiverIds,
  getPlay,
  getReceiverDisplayName,
  getReceiverRouteTarget,
  getRushingPlay,
  resetFormationPlayers,
} from '../src/playbook';

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
});

function getPlayer<T extends { id: string }>(players: T[], playerId: string): T {
  const player = players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Missing player ${playerId}`);
  }

  return player;
}
