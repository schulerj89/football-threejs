import { describe, expect, it } from 'vitest';
import { BALL_CARRY_ATTACHMENT, updateCarriedBallPosition } from '../src/ballModel';
import {
  DEFENDER_COLLISION_RADII,
  DEFENDER_CONFIG,
  isTackleContact,
  updateDefenderPursuit,
} from '../src/defenderModel';
import { INITIAL_BALL_SPOT, LINE_OF_SCRIMMAGE_Z, PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { calculateYardsGained } from '../src/fieldScale';
import { PLAYER_MOVEMENT_CONFIG } from '../src/playerModel';
import {
  GAMEPLAY_CONFIG,
  createGameplayModel,
  hasCrossedOpposingGoalLine,
  hasCrossedSideline,
  markPlayDead,
  resetPlay,
  snapshotGameplayModel,
  startPlay,
  updateGameplayModel,
} from '../src/playState';

describe('play state transitions', () => {
  it('starts in preSnap at the line of scrimmage without ball possession', () => {
    const gameplay = createGameplayModel();

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.player.position).toEqual({ x: 0, z: LINE_OF_SCRIMMAGE_Z });
    expect(gameplay.player.velocity).toEqual({ x: 0, z: 0 });
    expect(gameplay.activePlayStartSpot).toBeNull();
    expect(gameplay.currentBallSpot).toEqual(INITIAL_BALL_SPOT);
    expect(gameplay.nextBallSpot).toEqual(INITIAL_BALL_SPOT);
    expect(gameplay.drive).toMatchObject({
      currentDown: 1,
      firstDownMarker: { x: 0, z: LINE_OF_SCRIMMAGE_Z + 10 },
      lineOfScrimmage: INITIAL_BALL_SPOT,
      state: 'active',
      yardsToFirstDown: 10,
    });
    expect(gameplay.defender.position).toEqual(DEFENDER_CONFIG.initialPosition);
    expect(gameplay.defender.velocity).toEqual({ x: 0, z: 0 });
    expect(gameplay.ball.possession).toEqual({ kind: 'none' });
    expect(gameplay.lastPlayResult).toBeNull();
  });

  it('starts a valid play from preSnap and gives the player possession', () => {
    const gameplay = createGameplayModel();

    expect(startPlay(gameplay)).toBe(true);

    expect(gameplay.playState).toBe('live');
    expect(gameplay.activePlayStartSpot).toEqual(INITIAL_BALL_SPOT);
    expect(gameplay.drive.currentDown).toBe(1);
    expect(gameplay.drive.yardsToFirstDown).toBe(10);
    expect(gameplay.ball.possession).toEqual({
      kind: 'player',
      playerId: gameplay.player.id,
    });
    expect(gameplay.ball.position.x).toBeCloseTo(gameplay.player.position.x + BALL_CARRY_ATTACHMENT.x);
    expect(gameplay.ball.position.y).toBeCloseTo(BALL_CARRY_ATTACHMENT.y);
    expect(gameplay.ball.position.z).toBeCloseTo(gameplay.player.position.z + BALL_CARRY_ATTACHMENT.z);
  });

  it('rejects invalid start and dead transitions', () => {
    const gameplay = createGameplayModel();

    expect(markPlayDead(gameplay)).toBe(false);
    expect(gameplay.playState).toBe('preSnap');
    expect(startPlay(gameplay)).toBe(true);
    expect(startPlay(gameplay)).toBe(false);
    expect(gameplay.playState).toBe('live');
    expect(markPlayDead(gameplay)).toBe(true);
    expect(startPlay(gameplay)).toBe(false);
    expect(markPlayDead(gameplay)).toBe(false);
    expect(gameplay.playState).toBe('dead');
  });

  it('resets to preSnap and clears possession from live or dead', () => {
    const gameplay = createGameplayModel();

    startPlay(gameplay);
    gameplay.player.position.x = 8;
    gameplay.player.position.z = -4;
    gameplay.player.velocity.x = 12;
    resetPlay(gameplay);

    expect(snapshotGameplayModel(gameplay)).toMatchObject({
      ball: {
        possession: { kind: 'none' },
        position: { x: 0, y: BALL_CARRY_ATTACHMENT.y, z: LINE_OF_SCRIMMAGE_Z },
      },
      player: {
        position: { x: 0, z: LINE_OF_SCRIMMAGE_Z },
        velocity: { x: 0, z: 0 },
      },
      currentBallSpot: INITIAL_BALL_SPOT,
      lastPlayResult: null,
      nextBallSpot: INITIAL_BALL_SPOT,
      playState: 'preSnap',
    });

    startPlay(gameplay);
    markPlayDead(gameplay);
    resetPlay(gameplay);
    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.ball.possession).toEqual({ kind: 'none' });
  });

  it('keeps carried ball position derived from the gameplay player model', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.x = 3;
    gameplay.player.position.z = -10;
    gameplay.player.facingRadians = Math.PI / 2;

    updateCarriedBallPosition(gameplay.ball, gameplay.player);

    expect(gameplay.ball.position.x).toBeCloseTo(3 + BALL_CARRY_ATTACHMENT.z);
    expect(gameplay.ball.position.z).toBeCloseTo(-10 - BALL_CARRY_ATTACHMENT.x);
  });

  it('scores when the possessed player crosses the opposing goal line during live play', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.z =
      GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;

    expect(hasCrossedOpposingGoalLine(gameplay.player)).toBe(true);
    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: { z: GAMEPLAY_CONFIG.opposingGoalLineZ },
      reason: 'touchdown',
      scoringTeam: 'offense',
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'touchdown',
    });
    expect(gameplay.lastPlayResult?.yardsGained).toBeCloseTo(
      calculateYardsGained(INITIAL_BALL_SPOT, {
        x: gameplay.player.position.x,
        z: GAMEPLAY_CONFIG.opposingGoalLineZ,
      }),
    );
    expect(gameplay.drive.state).toBe('over');
    expect(gameplay.drive.lastDriveResult).toMatchObject({
      nextDriveStartSpot: INITIAL_BALL_SPOT,
      reason: 'touchdown',
      type: 'touchdown',
    });
    expect(gameplay.nextBallSpot).toEqual(INITIAL_BALL_SPOT);
    expect(gameplay.score).toBe(GAMEPLAY_CONFIG.touchdownPoints);
    expect(gameplay.playResetTimerSeconds).toBe(GAMEPLAY_CONFIG.touchdownResetDelaySeconds);
  });

  it('does not score before crossing the opposing goal line', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.z =
      GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth - 0.01;

    expect(hasCrossedOpposingGoalLine(gameplay.player)).toBe(false);
    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('live');
    expect(gameplay.lastPlayResult).toBeNull();
    expect(gameplay.score).toBe(0);
  });

  it('does not record multiple touchdowns during one play', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.z =
      GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;

    updateGameplayModel(gameplay, 0);
    updateGameplayModel(gameplay, 0.1);
    updateGameplayModel(gameplay, 0.1);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.score).toBe(GAMEPLAY_CONFIG.touchdownPoints);
  });

  it('records positive yards and resets the next play at a tackle spot', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z + 5;
    gameplay.defender.position.x = gameplay.player.position.x;
    gameplay.defender.position.z = gameplay.player.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: { x: 0, z: LINE_OF_SCRIMMAGE_Z + 5 },
      reason: 'tackle',
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'tackle',
    });
    expect(gameplay.lastPlayResult?.yardsGained).toBeCloseTo(5);
    expect(gameplay.drive).toMatchObject({
      currentDown: 2,
      firstDownMarker: { x: 0, z: LINE_OF_SCRIMMAGE_Z + 10 },
      lineOfScrimmage: { x: 0, z: LINE_OF_SCRIMMAGE_Z + 5 },
      state: 'active',
    });
    expect(gameplay.drive.yardsToFirstDown).toBeCloseTo(5);
    expect(gameplay.nextBallSpot).toEqual({ x: 0, z: LINE_OF_SCRIMMAGE_Z + 5 });

    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.tackleResetDelaySeconds);

    expect(gameplay.currentBallSpot).toEqual({ x: 0, z: LINE_OF_SCRIMMAGE_Z + 5 });
    expect(gameplay.drive.currentDown).toBe(2);
    expect(gameplay.drive.yardsToFirstDown).toBeCloseTo(5);
    expect(gameplay.player.position).toEqual({ x: 0, z: LINE_OF_SCRIMMAGE_Z + 5 });
    expect(gameplay.ball.position).toMatchObject({
      x: 0,
      y: BALL_CARRY_ATTACHMENT.y,
      z: LINE_OF_SCRIMMAGE_Z + 5,
    });
    expect(gameplay.lastPlayResult).toBeNull();
  });

  it('records negative yards when the carrier is tackled behind the starting spot', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z - 4;
    gameplay.defender.position.x = gameplay.player.position.x;
    gameplay.defender.position.z = gameplay.player.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: { x: 0, z: LINE_OF_SCRIMMAGE_Z - 4 },
      reason: 'tackle',
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'tackle',
    });
    expect(gameplay.lastPlayResult?.yardsGained).toBeCloseTo(-4);
    expect(gameplay.drive.currentDown).toBe(2);
    expect(gameplay.drive.yardsToFirstDown).toBeCloseTo(14);
    expect(gameplay.nextBallSpot).toEqual({ x: 0, z: LINE_OF_SCRIMMAGE_Z - 4 });
  });

  it('ends live play out of bounds and spots the ball at the sideline', () => {
    const gameplay = createGameplayModel();
    const expectedSpot = {
      x: PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.halfWidth,
      z: LINE_OF_SCRIMMAGE_Z + 6,
    };

    startPlay(gameplay);
    gameplay.player.position.x = PLAYABLE_FIELD_BOUNDS.maxX;
    gameplay.player.position.z = expectedSpot.z;

    expect(hasCrossedSideline(gameplay.player)).toBe(true);
    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: expectedSpot,
      reason: 'outOfBounds',
      scoringTeam: null,
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'outOfBounds',
    });
    expect(gameplay.lastPlayResult?.yardsGained).toBeCloseTo(6);
    expect(gameplay.drive.currentDown).toBe(2);
    expect(gameplay.drive.yardsToFirstDown).toBeCloseTo(4);
    expect(gameplay.nextBallSpot).toEqual(expectedSpot);
    expect(gameplay.playResetTimerSeconds).toBe(GAMEPLAY_CONFIG.outOfBoundsResetDelaySeconds);

    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.outOfBoundsResetDelaySeconds);

    expect(gameplay.currentBallSpot).toEqual(expectedSpot);
    expect(gameplay.player.position).toEqual(expectedSpot);
  });

  it('auto-resets after the configured touchdown delay without clearing score', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.player.position.z =
      GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;

    updateGameplayModel(gameplay, 0);
    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.touchdownResetDelaySeconds);

    expect(snapshotGameplayModel(gameplay)).toMatchObject({
      ball: { possession: { kind: 'none' } },
      currentBallSpot: INITIAL_BALL_SPOT,
      drive: {
        currentDown: 1,
        lineOfScrimmage: INITIAL_BALL_SPOT,
        state: 'active',
        yardsToFirstDown: 10,
      },
      defender: { position: DEFENDER_CONFIG.initialPosition, velocity: { x: 0, z: 0 } },
      lastPlayResult: null,
      nextBallSpot: INITIAL_BALL_SPOT,
      player: { position: { x: 0, z: LINE_OF_SCRIMMAGE_Z }, velocity: { x: 0, z: 0 } },
      playState: 'preSnap',
      score: GAMEPLAY_CONFIG.touchdownPoints,
    });
  });

  it('keeps the defender stationary during preSnap', () => {
    const gameplay = createGameplayModel();

    updateGameplayModel(gameplay, 1);

    expect(gameplay.defender.position).toEqual(DEFENDER_CONFIG.initialPosition);
    expect(gameplay.defender.velocity).toEqual({ x: 0, z: 0 });
    expect(gameplay.playState).toBe('preSnap');
  });

  it('steers the defender toward the carrier without instantly matching direction changes', () => {
    const gameplay = createGameplayModel();
    gameplay.defender.position.x = 0;
    gameplay.defender.position.z = 0;
    gameplay.defender.facingRadians = 0;
    gameplay.player.position.x = 10;
    gameplay.player.position.z = 0;

    updateDefenderPursuit(gameplay.defender, gameplay.player, 0.1);

    expect(gameplay.defender.facingRadians).toBeGreaterThan(0);
    expect(gameplay.defender.facingRadians).toBeLessThan(Math.PI / 2);
    expect(gameplay.defender.facingRadians).toBeCloseTo(
      DEFENDER_CONFIG.steeringRateRadiansPerSecond * 0.1,
    );
    expect(gameplay.defender.velocity.x).toBeGreaterThan(0);
  });

  it('detects tackles using the configured tackle radius', () => {
    const gameplay = createGameplayModel();
    gameplay.defender.position.x = 0;
    gameplay.defender.position.z = 0;
    gameplay.player.position.x = DEFENDER_CONFIG.tackleRadius - 0.01;
    gameplay.player.position.z = 0;

    expect(DEFENDER_CONFIG.tackleRadius).toBe(
      DEFENDER_COLLISION_RADII.ballCarrier + DEFENDER_COLLISION_RADII.defender,
    );
    expect(isTackleContact(gameplay.defender, gameplay.player)).toBe(true);

    gameplay.player.position.x = DEFENDER_CONFIG.tackleRadius + 0.01;
    expect(isTackleContact(gameplay.defender, gameplay.player)).toBe(false);
  });

  it('changes live play to dead on tackle and resets after the configured delay', () => {
    const gameplay = createGameplayModel();
    startPlay(gameplay);
    gameplay.defender.position.x = gameplay.player.position.x + DEFENDER_CONFIG.tackleRadius;
    gameplay.defender.position.z = gameplay.player.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: INITIAL_BALL_SPOT,
      reason: 'tackle',
      scoringTeam: null,
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'tackle',
      yardsGained: 0,
    });
    expect(gameplay.drive.currentDown).toBe(2);
    expect(gameplay.drive.yardsToFirstDown).toBe(10);
    expect(gameplay.score).toBe(0);
    expect(gameplay.playResetTimerSeconds).toBe(GAMEPLAY_CONFIG.tackleResetDelaySeconds);

    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.tackleResetDelaySeconds);

    expect(snapshotGameplayModel(gameplay)).toMatchObject({
      defender: { position: DEFENDER_CONFIG.initialPosition, velocity: { x: 0, z: 0 } },
      lastPlayResult: null,
      playState: 'preSnap',
      score: 0,
    });
  });
});
