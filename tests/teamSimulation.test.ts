import { describe, expect, it } from 'vitest';
import { DEFENDER_CONFIG, isTackleContact } from '../src/defenderModel';
import { INITIAL_BALL_SPOT, PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { createFormationPlayers, getPlay, getRushingPlay } from '../src/playbook';
import { PLAYER_MOVEMENT_CONFIG, createPlayerModel, type PlayerModel } from '../src/playerModel';
import {
  BLOCKING_CONFIG,
  acquireBlockingEngagements,
  createBlockingState,
  releaseSeparatedEngagements,
  resolvePlayerOverlaps,
  updateRushingDrillAi,
} from '../src/teamSimulation';

describe('three-on-three rushing drill simulation', () => {
  it('creates three offensive and three defensive players without overlap', () => {
    const players = createFormationPlayers(INITIAL_BALL_SPOT);

    expect(players).toHaveLength(6);
    expect(players.filter((player) => player.team === 'offense')).toHaveLength(3);
    expect(players.filter((player) => player.team === 'defense')).toHaveLength(3);
    expect(players.every((player) => player.currentState === 'idle')).toBe(true);

    for (let outer = 0; outer < players.length; outer += 1) {
      for (let inner = outer + 1; inner < players.length; inner += 1) {
        expect(distanceBetween(players[outer], players[inner])).toBeGreaterThanOrEqual(
          players[outer].collisionRadius + players[inner].collisionRadius,
        );
      }
    }
  });

  it('assigns blockers to eligible defenders one-to-one', () => {
    const players = [
      makePlayer('runner', 'offense', 'runner', 0, 0),
      makePlayer('blocker-left', 'offense', 'blocker', -1, 0),
      makePlayer('blocker-right', 'offense', 'blocker', 1, 0),
      makePlayer('defender-left', 'defense', 'defender', -1, 1),
      makePlayer('defender-right', 'defense', 'defender', 1, 1),
    ];
    const blocking = createBlockingState();

    acquireBlockingEngagements(players, blocking);

    expect(blocking.engagements).toHaveLength(2);
    expect(new Set(blocking.engagements.map((engagement) => engagement.blockerId)).size).toBe(2);
    expect(new Set(blocking.engagements.map((engagement) => engagement.defenderId)).size).toBe(2);
  });

  it('impedes engaged defenders while unblocked defenders pursue at full speed', () => {
    const players = createFormationPlayers(INITIAL_BALL_SPOT);
    const play = getRushingPlay('inside-run');
    const runner = getPlayer(players, 'runner');
    const blocking = createBlockingState();

    getPlayer(players, 'blocker-left').position = { x: 7, z: -3.2 };
    getPlayer(players, 'defender-left').position = { x: 7, z: -3 };

    updateRushingDrillAi(players, blocking, runner, {
      bounds: PLAYABLE_FIELD_BOUNDS,
      deltaSeconds: 0.1,
      lineOfScrimmage: INITIAL_BALL_SPOT,
      play,
    });

    const engagedDefender = getPlayer(players, 'defender-left');
    const unblockedDefender = getPlayer(players, 'defender-middle');

    expect(blocking.engagements).toEqual([
      expect.objectContaining({ blockerId: 'blocker-left', defenderId: 'defender-left' }),
    ]);
    expect(vectorLength(engagedDefender.velocity)).toBeCloseTo(
      DEFENDER_CONFIG.pursuitSpeed * BLOCKING_CONFIG.engagedDefenderSpeedMultiplier,
    );
    expect(vectorLength(unblockedDefender.velocity)).toBeCloseTo(DEFENDER_CONFIG.pursuitSpeed);
  });

  it('runs the Quick Pass receiver route and has the coverage defender track the receiver', () => {
    const play = getPlay('quick-pass');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, play);
    const quarterback = getPlayer(players, 'runner');
    const receiver = getPlayer(players, 'blocker-left');
    const coverageDefender = getPlayer(players, 'defender-left');
    const passRusher = getPlayer(players, 'defender-middle');
    const receiverStart = { ...receiver.position };

    updateRushingDrillAi(players, createBlockingState(), quarterback, {
      bounds: PLAYABLE_FIELD_BOUNDS,
      deltaSeconds: 0.1,
      lineOfScrimmage: INITIAL_BALL_SPOT,
      play,
    });

    expect(receiver.currentState).toBe('runningRoute');
    expect(receiver.position.z).toBeGreaterThan(receiverStart.z);
    expect(coverageDefender.currentState).toBe('pursuing');
    expect(coverageDefender.velocity.z).toBeLessThan(0);
    expect(passRusher.currentState).toBe('pursuing');
    expect(passRusher.velocity.z).toBeLessThan(0);
  });

  it('runs both Slant Flat receiver routes and assigns coverage defenders deterministically', () => {
    const play = getPlay('slant-flat');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, play);
    const quarterback = getPlayer(players, 'runner');
    const leftReceiver = getPlayer(players, 'blocker-left');
    const rightReceiver = getPlayer(players, 'blocker-right');
    const leftCoverage = getPlayer(players, 'defender-left');
    const rightCoverage = getPlayer(players, 'defender-right');
    const passRusher = getPlayer(players, 'defender-middle');
    const leftReceiverStart = { ...leftReceiver.position };
    const rightReceiverStart = { ...rightReceiver.position };

    updateRushingDrillAi(players, createBlockingState(), quarterback, {
      bounds: PLAYABLE_FIELD_BOUNDS,
      deltaSeconds: 0.1,
      lineOfScrimmage: INITIAL_BALL_SPOT,
      play,
    });

    expect(leftReceiver.position.z).toBeGreaterThan(leftReceiverStart.z);
    expect(rightReceiver.position.x).toBeGreaterThan(rightReceiverStart.x);
    expect(leftCoverage.currentState).toBe('pursuing');
    expect(rightCoverage.currentState).toBe('pursuing');
    expect(leftCoverage.velocity.z).toBeLessThan(0);
    expect(rightCoverage.velocity.z).toBeLessThan(0);
    expect(rightCoverage.velocity.x).toBeGreaterThan(0);
    expect(passRusher.currentState).toBe('pursuing');
    expect(passRusher.velocity.z).toBeLessThan(0);
  });

  it('keeps AI receivers inside the sideline while routes run from a sideline spot', () => {
    const play = getPlay('slant-flat');
    const sidelineSpot = {
      x: PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.collisionRadius,
      z: INITIAL_BALL_SPOT.z,
    };
    const players = createFormationPlayers(sidelineSpot, play);
    const quarterback = getPlayer(players, 'runner');
    const rightReceiver = getPlayer(players, 'blocker-right');

    for (let frame = 0; frame < 20; frame += 1) {
      updateRushingDrillAi(players, createBlockingState(), quarterback, {
        bounds: PLAYABLE_FIELD_BOUNDS,
        deltaSeconds: 0.1,
        lineOfScrimmage: sidelineSpot,
        play,
      });
    }

    expect(rightReceiver.position.x).toBeLessThanOrEqual(
      PLAYABLE_FIELD_BOUNDS.maxX - rightReceiver.collisionRadius,
    );
    expect(rightReceiver.position.x).toBeGreaterThanOrEqual(
      PLAYABLE_FIELD_BOUNDS.minX + rightReceiver.collisionRadius,
    );
  });

  it('disengages blockers and defenders after they separate', () => {
    const players = createFormationPlayers(INITIAL_BALL_SPOT);
    const blocker = getPlayer(players, 'blocker-left');
    const defender = getPlayer(players, 'defender-left');
    const blocking = createBlockingState();

    blocking.engagements.push({ blockerId: blocker.id, defenderId: defender.id });
    blocker.currentState = 'engaged';
    defender.currentState = 'engaged';
    blocker.position = { x: 0, z: 0 };
    defender.position = { x: BLOCKING_CONFIG.disengageDistance + 0.1, z: 0 };

    releaseSeparatedEngagements(players, blocking);

    expect(blocking.engagements).toEqual([]);
    expect(blocker.currentState).toBe('movingToLane');
    expect(defender.currentState).toBe('pursuing');
  });

  it('separates players that occupy the exact same position', () => {
    const first = makePlayer('first', 'offense', 'blocker', 0, 0);
    const second = makePlayer('second', 'defense', 'defender', 0, 0);

    resolvePlayerOverlaps([first, second]);

    expect(distanceBetween(first, second)).toBeGreaterThan(0);
    expect(distanceBetween(first, second)).toBeCloseTo(
      first.collisionRadius + second.collisionRadius,
    );
  });

  it('detects tackles using common gameplay player collision radii', () => {
    const runner = makePlayer('runner', 'offense', 'runner', 0, 0);
    const defender = makePlayer('defender', 'defense', 'defender', DEFENDER_CONFIG.tackleRadius, 0);

    expect(isTackleContact(defender, runner)).toBe(true);

    defender.position.x = DEFENDER_CONFIG.tackleRadius + 0.01;
    expect(isTackleContact(defender, runner)).toBe(false);
  });
});

function makePlayer(
  id: string,
  team: PlayerModel['team'],
  role: PlayerModel['role'],
  x: number,
  z: number,
): PlayerModel {
  return createPlayerModel(
    { x, z },
    {
      id,
      role,
      team,
    },
  );
}

function getPlayer(players: PlayerModel[], playerId: string): PlayerModel {
  const player = players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Missing player ${playerId}`);
  }

  return player;
}

function distanceBetween(first: PlayerModel, second: PlayerModel): number {
  return Math.hypot(first.position.x - second.position.x, first.position.z - second.position.z);
}

function vectorLength(vector: { x: number; z: number }): number {
  return Math.hypot(vector.x, vector.z);
}
