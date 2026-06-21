import { describe, expect, it } from 'vitest';
import { INITIAL_BALL_SPOT, PLAYABLE_FIELD_BOUNDS } from '../src/field';
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
      initialMovementDirection: { x: 0.7, z: 0.7 },
      kind: 'run',
    });
    expect(getPlay('quick-pass')).toMatchObject({
      ballCarrierRole: 'quarterback',
      displayName: 'Quick Pass',
      id: 'quick-pass',
      initialMovementDirection: { x: 0, z: 1 },
      kind: 'pass',
      pass: { eligibleReceiverIds: ['blocker-left'] },
    });
    expect(getPlay('slant-flat')).toMatchObject({
      ballCarrierRole: 'quarterback',
      displayName: 'Slant Flat',
      id: 'slant-flat',
      initialMovementDirection: { x: 0, z: 1 },
      kind: 'pass',
      pass: { eligibleReceiverIds: ['blocker-left', 'blocker-right'] },
    });
  });

  it('rejects invalid play IDs', () => {
    expect(() => getPlay('fake-run')).toThrow('Unknown play fake-run');
  });

  it('places each play formation relative to the ball spot', () => {
    const insidePlayers = createFormationPlayers(INITIAL_BALL_SPOT, getRushingPlay('inside-run'));
    const outsidePlayers = createFormationPlayers(INITIAL_BALL_SPOT, getRushingPlay('outside-run'));

    expect(insidePlayers).toHaveLength(6);
    expect(outsidePlayers).toHaveLength(6);
    expect(getPlayer(insidePlayers, 'runner').position).toEqual(INITIAL_BALL_SPOT);
    expect(getPlayer(outsidePlayers, 'runner').position.x).toBeGreaterThan(
      getPlayer(insidePlayers, 'runner').position.x,
    );
  });

  it('provides different blocker lane targets for inside and outside runs', () => {
    const insidePlay = getRushingPlay('inside-run');
    const outsidePlay = getRushingPlay('outside-run');
    const insideBlocker = getPlayer(createFormationPlayers(INITIAL_BALL_SPOT, insidePlay), 'blocker-left');
    const outsideBlocker = getPlayer(createFormationPlayers(INITIAL_BALL_SPOT, outsidePlay), 'blocker-left');

    expect(getBlockingLaneTarget(outsideBlocker, INITIAL_BALL_SPOT, outsidePlay).x).toBeGreaterThan(
      getBlockingLaneTarget(insideBlocker, INITIAL_BALL_SPOT, insidePlay).x,
    );
  });

  it('places Quick Pass roles and route data from the selected play definition', () => {
    const quickPass = getPlay('quick-pass');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, quickPass);
    const quarterback = getPlayer(players, 'runner');
    const receiver = getPlayer(players, 'blocker-left');
    const blocker = getPlayer(players, 'blocker-right');
    const coverageDefender = getPlayer(players, 'defender-left');

    expect(quarterback).toMatchObject({ role: 'quarterback', team: 'offense' });
    expect(receiver).toMatchObject({ role: 'receiver', team: 'offense' });
    expect(blocker).toMatchObject({ role: 'blocker', team: 'offense' });
    expect(coverageDefender).toMatchObject({ role: 'coverageDefender', team: 'defense' });
    expect(getReceiverRouteTarget(receiver, INITIAL_BALL_SPOT, quickPass)).toEqual({
      x: -1.5,
      z: INITIAL_BALL_SPOT.z + 11,
    });
    expect(getEligibleReceiverIds(quickPass)).toEqual(['blocker-left']);
    expect(getReceiverDisplayName(quickPass, 'blocker-left')).toBe('Receiver');
  });

  it('places Slant Flat roles and two data-defined receiver routes', () => {
    const slantFlat = getPlay('slant-flat');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, slantFlat);
    const quarterback = getPlayer(players, 'runner');
    const leftReceiver = getPlayer(players, 'blocker-left');
    const rightReceiver = getPlayer(players, 'blocker-right');
    const leftCoverage = getPlayer(players, 'defender-left');
    const passRusher = getPlayer(players, 'defender-middle');
    const rightCoverage = getPlayer(players, 'defender-right');

    expect(quarterback).toMatchObject({ role: 'quarterback', team: 'offense' });
    expect(leftReceiver).toMatchObject({ role: 'receiver', team: 'offense' });
    expect(rightReceiver).toMatchObject({ role: 'receiver', team: 'offense' });
    expect(leftCoverage).toMatchObject({ role: 'coverageDefender', team: 'defense' });
    expect(rightCoverage).toMatchObject({ role: 'coverageDefender', team: 'defense' });
    expect(passRusher).toMatchObject({ role: 'defender', team: 'defense' });
    expect(getEligibleReceiverIds(slantFlat)).toEqual(['blocker-left', 'blocker-right']);
    expect(getReceiverRouteTarget(leftReceiver, INITIAL_BALL_SPOT, slantFlat)).toEqual({
      x: -2,
      z: INITIAL_BALL_SPOT.z + 11,
    });
    expect(getReceiverRouteTarget(rightReceiver, INITIAL_BALL_SPOT, slantFlat)).toEqual({
      x: 15,
      z: INITIAL_BALL_SPOT.z + 5,
    });
    expect(getReceiverDisplayName(slantFlat, 'blocker-left')).toBe('Slant');
    expect(getReceiverDisplayName(slantFlat, 'blocker-right')).toBe('Flat');
  });

  it('keeps sideline formation positions and route targets inside the playable field', () => {
    const slantFlat = getPlay('slant-flat');
    const sidelineSpot = {
      x: PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.collisionRadius,
      z: INITIAL_BALL_SPOT.z,
    };
    const players = createFormationPlayers(sidelineSpot, slantFlat);
    const rightReceiver = getPlayer(players, 'blocker-right');
    const routeTarget = getReceiverRouteTarget(rightReceiver, sidelineSpot, slantFlat);

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

    expect(getPlayer(players, 'runner').role).toBe('quarterback');
    expect(getPlayer(players, 'blocker-left').role).toBe('receiver');
    expect(getPlayer(players, 'defender-left').role).toBe('coverageDefender');
  });
});

function getPlayer<T extends { id: string }>(players: T[], playerId: string): T {
  const player = players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Missing player ${playerId}`);
  }

  return player;
}
