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

describe('five-on-five rushing drill simulation', () => {
  it('creates five offensive and five defensive players without overlap', () => {
    const players = createFormationPlayers(INITIAL_BALL_SPOT, getPlay('inside-run'));

    expect(players).toHaveLength(10);
    expect(players.filter((player) => player.team === 'offense')).toHaveLength(5);
    expect(players.filter((player) => player.team === 'defense')).toHaveLength(5);
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
      makePlayer('offense-rb', 'offense', 'runner', 0, 0),
      makePlayer('offense-blocker-left', 'offense', 'blocker', -1, 0),
      makePlayer('offense-blocker-right', 'offense', 'blocker', 1, 0),
      makePlayer('defense-rusher-left', 'defense', 'defender', -1, 1),
      makePlayer('defense-rusher-right', 'defense', 'defender', 1, 1),
    ];
    const blocking = createBlockingState();

    acquireBlockingEngagements(players, blocking);

    expect(blocking.engagements).toHaveLength(2);
    expect(new Set(blocking.engagements.map((engagement) => engagement.blockerId)).size).toBe(2);
    expect(new Set(blocking.engagements.map((engagement) => engagement.defenderId)).size).toBe(2);
  });

  it('impedes engaged defenders while unblocked defenders pursue at full speed', () => {
    const play = getRushingPlay('inside-run');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, play);
    const runner = getPlayer(players, 'offense-rb');
    const blocking = createBlockingState();

    getPlayer(players, 'offense-blocker-left').position = { x: 7, z: -3.2 };
    getPlayer(players, 'defense-rusher-left').position = { x: 7, z: -3 };

    updateRushingDrillAi(players, blocking, runner, {
      bounds: PLAYABLE_FIELD_BOUNDS,
      deltaSeconds: 0.1,
      lineOfScrimmage: INITIAL_BALL_SPOT,
      play,
    });

    const engagedDefender = getPlayer(players, 'defense-rusher-left');
    const unblockedDefender = getPlayer(players, 'defense-rusher-right');

    expect(blocking.engagements).toEqual([
      expect.objectContaining({
        blockerId: 'offense-blocker-left',
        defenderId: 'defense-rusher-left',
      }),
    ]);
    expect(vectorLength(engagedDefender.velocity)).toBeCloseTo(
      DEFENDER_CONFIG.pursuitSpeed * BLOCKING_CONFIG.engagedDefenderSpeedMultiplier,
    );
    expect(vectorLength(unblockedDefender.velocity)).toBeCloseTo(DEFENDER_CONFIG.pursuitSpeed);
  });

  it('runs the Quick Pass receiver route and has the coverage defender track the receiver', () => {
    const play = getPlay('quick-pass');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, play);
    const quarterback = getPlayer(players, 'offense-qb');
    const receiver = getPlayer(players, 'offense-wr');
    const coverageDefender = getPlayer(players, 'defense-cover-wr');
    const passRusher = getPlayer(players, 'defense-rusher-left');
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
    const quarterback = getPlayer(players, 'offense-qb');
    const wideReceiver = getPlayer(players, 'offense-wr');
    const runningBack = getPlayer(players, 'offense-rb');
    const wideCoverage = getPlayer(players, 'defense-cover-wr');
    const runningBackCoverage = getPlayer(players, 'defense-cover-rb');
    const passRusher = getPlayer(players, 'defense-rusher-left');
    const wideReceiverStart = { ...wideReceiver.position };
    const runningBackStart = { ...runningBack.position };

    updateRushingDrillAi(players, createBlockingState(), quarterback, {
      bounds: PLAYABLE_FIELD_BOUNDS,
      deltaSeconds: 0.1,
      lineOfScrimmage: INITIAL_BALL_SPOT,
      play,
    });

    expect(wideReceiver.position.z).toBeGreaterThan(wideReceiverStart.z);
    expect(runningBack.position.x).toBeLessThan(runningBackStart.x);
    expect(wideCoverage.currentState).toBe('pursuing');
    expect(runningBackCoverage.currentState).toBe('pursuing');
    expect(wideCoverage.velocity.z).toBeLessThan(0);
    expect(runningBackCoverage.velocity.z).toBeLessThan(0);
    expect(runningBackCoverage.velocity.x).toBeLessThan(0);
    expect(passRusher.currentState).toBe('pursuing');
    expect(passRusher.velocity.z).toBeLessThan(0);
  });

  it('uses explicit Twin Slants Flat pass-protection assignments before falling back to proximity', () => {
    const play = getPlay('twin-slants-flat');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, play);
    const blocking = createBlockingState();

    getPlayer(players, 'offense-center').position = { x: 0, z: 0 };
    getPlayer(players, 'defense-line-middle').position = { x: 0, z: 1 };
    getPlayer(players, 'offense-line-left').position = { x: -5, z: 0 };
    getPlayer(players, 'defense-line-left').position = { x: -5, z: 1 };
    getPlayer(players, 'offense-line-right').position = { x: 5, z: 0 };
    getPlayer(players, 'defense-line-right').position = { x: 5, z: 1 };

    acquireBlockingEngagements(players, blocking, play);

    expect(blocking.engagements).toEqual(
      expect.arrayContaining([
        { blockerId: 'offense-center', defenderId: 'defense-line-middle' },
        { blockerId: 'offense-line-left', defenderId: 'defense-line-left' },
        { blockerId: 'offense-line-right', defenderId: 'defense-line-right' },
      ]),
    );
  });

  it('runs all Twin Slants Flat routes after the snap and keeps coverage on assignments', () => {
    const play = getPlay('twin-slants-flat');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, play);
    const quarterback = getPlayer(players, 'offense-qb');
    const leftReceiver = getPlayer(players, 'offense-wr-left');
    const rightReceiver = getPlayer(players, 'offense-wr-right');
    const runningBack = getPlayer(players, 'offense-rb');
    const leftCoverage = getPlayer(players, 'defense-corner-left');
    const rightCoverage = getPlayer(players, 'defense-corner-right');
    const linebacker = getPlayer(players, 'defense-linebacker');
    const leftStart = { ...leftReceiver.position };
    const rightStart = { ...rightReceiver.position };
    const backStart = { ...runningBack.position };

    updateRushingDrillAi(players, createBlockingState(), quarterback, {
      bounds: PLAYABLE_FIELD_BOUNDS,
      deltaSeconds: 0.1,
      lineOfScrimmage: INITIAL_BALL_SPOT,
      play,
    });

    expect(leftReceiver.position.x).toBeGreaterThan(leftStart.x);
    expect(leftReceiver.position.z).toBeGreaterThan(leftStart.z);
    expect(rightReceiver.position.x).toBeLessThan(rightStart.x);
    expect(rightReceiver.position.z).toBeGreaterThan(rightStart.z);
    expect(runningBack.position.x).toBeGreaterThan(backStart.x);
    expect(leftCoverage.currentState).toBe('pursuing');
    expect(rightCoverage.currentState).toBe('pursuing');
    expect(linebacker.currentState).toBe('pursuing');
  });

  it('turns coverage defenders into carrier pursuit after a Twin Slants Flat completion', () => {
    const play = getPlay('twin-slants-flat');
    const players = createFormationPlayers(INITIAL_BALL_SPOT, play);
    const runningBack = getPlayer(players, 'offense-rb');
    const assignedReceiver = getPlayer(players, 'offense-wr-left');
    const corner = getPlayer(players, 'defense-corner-left');

    runningBack.position = { x: 10, z: 0 };
    assignedReceiver.position = { x: -10, z: 0 };
    corner.position = { x: 0, z: 0 };
    corner.facingRadians = 0;

    updateRushingDrillAi(players, createBlockingState(), runningBack, {
      bounds: PLAYABLE_FIELD_BOUNDS,
      deltaSeconds: 0.1,
      lineOfScrimmage: INITIAL_BALL_SPOT,
      play,
    });

    expect(corner.velocity.x).toBeGreaterThan(0);
  });

  it('keeps AI receivers inside the sideline while routes run from a sideline spot', () => {
    const play = getPlay('slant-flat');
    const sidelineSpot = {
      x: PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.collisionRadius,
      z: INITIAL_BALL_SPOT.z,
    };
    const players = createFormationPlayers(sidelineSpot, play);
    const quarterback = getPlayer(players, 'offense-qb');
    const runningBack = getPlayer(players, 'offense-rb');

    for (let frame = 0; frame < 20; frame += 1) {
      updateRushingDrillAi(players, createBlockingState(), quarterback, {
        bounds: PLAYABLE_FIELD_BOUNDS,
        deltaSeconds: 0.1,
        lineOfScrimmage: sidelineSpot,
        play,
      });
    }

    expect(runningBack.position.x).toBeLessThanOrEqual(
      PLAYABLE_FIELD_BOUNDS.maxX - runningBack.collisionRadius,
    );
    expect(runningBack.position.x).toBeGreaterThanOrEqual(
      PLAYABLE_FIELD_BOUNDS.minX + runningBack.collisionRadius,
    );
  });

  it('disengages blockers and defenders after they separate', () => {
    const players = createFormationPlayers(INITIAL_BALL_SPOT, getPlay('inside-run'));
    const blocker = getPlayer(players, 'offense-blocker-left');
    const defender = getPlayer(players, 'defense-rusher-left');
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
