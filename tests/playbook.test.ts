import { describe, expect, it } from 'vitest';
import { INITIAL_BALL_SPOT } from '../src/field';
import {
  createFormationPlayers,
  getBlockingLaneTarget,
  getRushingPlay,
} from '../src/playbook';

describe('rushing playbook', () => {
  it('looks up the two stable rushing plays', () => {
    expect(getRushingPlay('inside-run')).toMatchObject({
      ballCarrierRole: 'runner',
      displayName: 'Inside Run',
      id: 'inside-run',
      initialMovementDirection: { x: 0, z: 1 },
    });
    expect(getRushingPlay('outside-run')).toMatchObject({
      ballCarrierRole: 'runner',
      displayName: 'Outside Run',
      id: 'outside-run',
      initialMovementDirection: { x: 0.7, z: 0.7 },
    });
  });

  it('rejects invalid play IDs', () => {
    expect(() => getRushingPlay('fake-run')).toThrow('Unknown rushing play fake-run');
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
});

function getPlayer<T extends { id: string }>(players: T[], playerId: string): T {
  const player = players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Missing player ${playerId}`);
  }

  return player;
}
