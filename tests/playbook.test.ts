import { describe, expect, it } from 'vitest';
import { INITIAL_BALL_SPOT } from '../src/field';
import {
  createFormationPlayers,
  getBlockingLaneTarget,
  getPlay,
  getReceiverRouteTarget,
  getRushingPlay,
  resetFormationPlayers,
} from '../src/playbook';

describe('playbook', () => {
  it('looks up the two stable rushing plays and the Quick Pass play', () => {
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
      pass: { eligibleReceiverId: 'blocker-left' },
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
