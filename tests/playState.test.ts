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
import { PLAYER_MOVEMENT_CONFIG, type PlayerModel } from '../src/playerModel';
import { PRE_SNAP_FACING_RADIANS } from '../src/playbook';
import {
  GAMEPLAY_CONFIG,
  attemptPass,
  createGameplayModel,
  hasCrossedOpposingGoalLine,
  hasCrossedSideline,
  markPlayDead,
  resetPlay,
  selectPlay,
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
    expect(gameplay.players).toHaveLength(6);
    expect(gameplay.players.filter((player) => player.team === 'offense')).toHaveLength(3);
    expect(gameplay.players.filter((player) => player.team === 'defense')).toHaveLength(3);
    expect(gameplay.players.every((player) => player.currentState === 'idle')).toBe(true);
    expect(getPrimaryDefender(gameplay.players).position).toEqual(DEFENDER_CONFIG.initialPosition);
    expect(getPrimaryDefender(gameplay.players).velocity).toEqual({ x: 0, z: 0 });
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
    expect(gameplay.player.currentState).toBe('userControlled');
    expect(gameplay.players.filter((player) => player.role === 'blocker')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currentState: 'movingToLane' }),
        expect.objectContaining({ currentState: 'movingToLane' }),
      ]),
    );
    expect(gameplay.players.filter((player) => player.role === 'defender')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currentState: 'pursuing' }),
        expect.objectContaining({ currentState: 'pursuing' }),
        expect.objectContaining({ currentState: 'pursuing' }),
      ]),
    );
    expect(gameplay.ball.possession).toEqual({
      kind: 'player',
      playerId: gameplay.player.id,
    });
    expect(gameplay.ball.position.x).toBeCloseTo(gameplay.player.position.x + BALL_CARRY_ATTACHMENT.x);
    expect(gameplay.ball.position.y).toBeCloseTo(BALL_CARRY_ATTACHMENT.y);
    expect(gameplay.ball.position.z).toBeCloseTo(gameplay.player.position.z + BALL_CARRY_ATTACHMENT.z);
  });

  it('selects a rushing play during preSnap and resets players into that formation', () => {
    const gameplay = createGameplayModel();

    expect(gameplay.selectedPlay.id).toBe('inside-run');
    expect(selectPlay(gameplay, 'outside-run')).toBe(true);

    expect(gameplay.selectedPlay.id).toBe('outside-run');
    expect(gameplay.player.position.x).toBeCloseTo(2.5);
    expect(gameplay.players.every((player) => player.currentState === 'idle')).toBe(true);
    expect(gameplay.ball.possession).toEqual({ kind: 'none' });
    expect(gameplay.ball.position.z).toBeCloseTo(LINE_OF_SCRIMMAGE_Z);
  });

  it('prevents play selection during live play', () => {
    const gameplay = createGameplayModel();

    startPlay(gameplay);
    expect(selectPlay(gameplay, 'outside-run')).toBe(false);

    expect(gameplay.selectedPlay.id).toBe('inside-run');
    expect(gameplay.player.currentState).toBe('userControlled');
  });

  it('preserves the selected play when resetting', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'outside-run');
    startPlay(gameplay);
    gameplay.player.position.x = 8;
    resetPlay(gameplay);

    expect(gameplay.selectedPlay.id).toBe('outside-run');
    expect(gameplay.player.position.x).toBeCloseTo(2.5);
    expect(gameplay.playState).toBe('preSnap');
  });

  it('sets Outside Run blockers in neutral pre-snap facing at their formation positions', () => {
    const gameplay = createGameplayModel();

    expect(selectPlay(gameplay, 'outside-run')).toBe(true);
    const leftBlocker = getPlayer(gameplay.players, 'blocker-left');
    const rightBlocker = getPlayer(gameplay.players, 'blocker-right');

    expect(leftBlocker.position).toEqual({ x: 6, z: LINE_OF_SCRIMMAGE_Z + 1.5 });
    expect(rightBlocker.position).toEqual({ x: 9, z: LINE_OF_SCRIMMAGE_Z + 0.5 });
    expect(leftBlocker.velocity).toEqual({ x: 0, z: 0 });
    expect(rightBlocker.velocity).toEqual({ x: 0, z: 0 });
    expect(leftBlocker.facingRadians).toBe(PRE_SNAP_FACING_RADIANS.playDirection);
    expect(rightBlocker.facingRadians).toBe(PRE_SNAP_FACING_RADIANS.playDirection);
  });

  it('does not let preSnap simulation frames change Outside Run blocker facing', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'outside-run');
    const leftBlocker = getPlayer(gameplay.players, 'blocker-left');
    const rightBlocker = getPlayer(gameplay.players, 'blocker-right');
    const leftStart = snapshotBlockerFormation(leftBlocker);
    const rightStart = snapshotBlockerFormation(rightBlocker);

    updateGameplayModel(gameplay, 0.1);
    updateGameplayModel(gameplay, 0.1);
    updateGameplayModel(gameplay, 0.1);

    expect(snapshotBlockerFormation(leftBlocker)).toEqual(leftStart);
    expect(snapshotBlockerFormation(rightBlocker)).toEqual(rightStart);
  });

  it('allows Outside Run blockers to turn toward assignments after the snap', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'outside-run');
    const leftBlocker = getPlayer(gameplay.players, 'blocker-left');
    const rightBlocker = getPlayer(gameplay.players, 'blocker-right');
    const leftPreSnapFacing = leftBlocker.facingRadians;
    const rightPreSnapFacing = rightBlocker.facingRadians;

    startPlay(gameplay);
    updateGameplayModel(gameplay, 0.1);

    expect(leftBlocker.facingRadians).not.toBeCloseTo(leftPreSnapFacing);
    expect(rightBlocker.facingRadians).not.toBeCloseTo(rightPreSnapFacing);
  });

  it('restores Outside Run blocker formation position and pre-snap facing on reset', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'outside-run');
    const leftBlocker = getPlayer(gameplay.players, 'blocker-left');
    const rightBlocker = getPlayer(gameplay.players, 'blocker-right');
    const leftStart = snapshotBlockerFormation(leftBlocker);
    const rightStart = snapshotBlockerFormation(rightBlocker);

    startPlay(gameplay);
    updateGameplayModel(gameplay, 0.1);
    resetPlay(gameplay);

    expect(snapshotBlockerFormation(leftBlocker)).toEqual(leftStart);
    expect(snapshotBlockerFormation(rightBlocker)).toEqual(rightStart);
  });

  it('keeps Inside Run blockers in neutral pre-snap facing', () => {
    const gameplay = createGameplayModel();
    const leftBlocker = getPlayer(gameplay.players, 'blocker-left');
    const rightBlocker = getPlayer(gameplay.players, 'blocker-right');

    expect(gameplay.selectedPlay.id).toBe('inside-run');
    expect(leftBlocker.facingRadians).toBe(PRE_SNAP_FACING_RADIANS.playDirection);
    expect(rightBlocker.facingRadians).toBe(PRE_SNAP_FACING_RADIANS.playDirection);
  });

  it('selects Quick Pass during preSnap and starts the receiver route only after the snap', () => {
    const gameplay = createGameplayModel();

    expect(selectPlay(gameplay, 'quick-pass')).toBe(true);
    const receiver = getPlayer(gameplay.players, 'blocker-left');
    const initialReceiverPosition = { ...receiver.position };

    expect(gameplay.selectedPlay).toMatchObject({
      displayName: 'Quick Pass',
      id: 'quick-pass',
      kind: 'pass',
    });
    expect(gameplay.player).toMatchObject({ id: 'runner', role: 'quarterback' });
    expect(receiver).toMatchObject({ role: 'receiver', currentState: 'idle' });

    updateGameplayModel(gameplay, 0.3);

    expect(receiver.position).toEqual(initialReceiverPosition);
    expect(receiver.currentState).toBe('idle');

    expect(startPlay(gameplay)).toBe(true);
    expect(gameplay.ball.state).toEqual({ kind: 'possessed', playerId: gameplay.player.id });
    expect(receiver.currentState).toBe('runningRoute');

    updateGameplayModel(gameplay, 0.1);

    expect(receiver.position.z).toBeGreaterThan(initialReceiverPosition.z);
  });

  it('throws Quick Pass once and transitions the ball to inFlight state', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);

    expect(attemptPass(gameplay)).toBe(true);
    expect(gameplay.passAttempted).toBe(true);
    expect(gameplay.ball.possession).toEqual({ kind: 'none' });
    expect(gameplay.ball.state).toMatchObject({ kind: 'inFlight' });
    expect(gameplay.player.currentState).toBe('idle');
    expect(attemptPass(gameplay)).toBe(false);
  });

  it('records a sack when an ordinary defender contacts the quarterback before a pass', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z - 4;
    const passRusher = getPrimaryDefender(gameplay.players);
    passRusher.position.x = gameplay.player.position.x;
    passRusher.position.z = gameplay.player.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: { x: 0, z: LINE_OF_SCRIMMAGE_Z - 4 },
      reason: 'sack',
      scoringTeam: null,
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'sack',
    });
    expect(gameplay.lastPlayResult?.yardsGained).toBeCloseTo(-4);
    expect(gameplay.drive.currentDown).toBe(2);
    expect(gameplay.drive.lineOfScrimmage).toEqual({ x: 0, z: LINE_OF_SCRIMMAGE_Z - 4 });
    expect(gameplay.nextBallSpot).toEqual({ x: 0, z: LINE_OF_SCRIMMAGE_Z - 4 });
    expect(gameplay.playResetTimerSeconds).toBe(GAMEPLAY_CONFIG.sackResetDelaySeconds);
  });

  it('does not end the play when the quarterback is contacted after throwing', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);
    const passRusher = getPrimaryDefender(gameplay.players);
    passRusher.position.x = gameplay.player.position.x;
    passRusher.position.z = gameplay.player.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('live');
    expect(gameplay.lastPlayResult).toBeNull();
    expect(gameplay.ball.state).toMatchObject({ kind: 'inFlight' });
  });

  it('classifies quarterback contact beyond the line of scrimmage as a tackle, not a sack', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z + 2;
    const passRusher = getPrimaryDefender(gameplay.players);
    passRusher.position.x = gameplay.player.position.x;
    passRusher.position.z = gameplay.player.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: { x: 0, z: LINE_OF_SCRIMMAGE_Z + 2 },
      reason: 'tackle',
      type: 'tackle',
    });
    expect(gameplay.lastPlayResult?.yardsGained).toBeCloseTo(2);
  });

  it('catches a pass, transfers possession and control to the receiver, and records completed-pass yardage', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);

    updateGameplayModel(gameplay, 0.2);
    const receiver = getPlayer(gameplay.players, 'blocker-left');
    receiver.position.x = gameplay.ball.position.x;
    receiver.position.z = gameplay.ball.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.ball.state).toEqual({ kind: 'caught', playerId: receiver.id });
    expect(gameplay.ball.possession).toEqual({ kind: 'player', playerId: receiver.id });
    expect(gameplay.player.id).toBe(receiver.id);
    expect(gameplay.player.currentState).toBe('userControlled');

    receiver.position.x = 0;
    receiver.position.z = LINE_OF_SCRIMMAGE_Z + 8;
    const defender = getPrimaryDefender(gameplay.players);
    defender.position.x = receiver.position.x;
    defender.position.z = receiver.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: { x: 0, z: LINE_OF_SCRIMMAGE_Z + 8 },
      reason: 'tackle',
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'tackle',
    });
    expect(gameplay.lastPlayResult?.type).not.toBe('sack');
    expect(gameplay.lastPlayResult?.yardsGained).toBeCloseTo(8);
    expect(gameplay.drive.currentDown).toBe(2);
    expect(gameplay.drive.yardsToFirstDown).toBeCloseTo(2);
  });

  it('ends an incomplete Quick Pass at the original line of scrimmage and advances the down', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);

    updateGameplayModel(gameplay, 2);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.ball.state).toEqual({ kind: 'incomplete' });
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: INITIAL_BALL_SPOT,
      reason: 'incomplete',
      scoringTeam: null,
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'incomplete',
      yardsGained: 0,
    });
    expect(gameplay.drive.currentDown).toBe(2);
    expect(gameplay.drive.lineOfScrimmage).toEqual(INITIAL_BALL_SPOT);
    expect(gameplay.nextBallSpot).toEqual(INITIAL_BALL_SPOT);
    expect(gameplay.playResetTimerSeconds).toBe(GAMEPLAY_CONFIG.incompleteResetDelaySeconds);
  });

  it('lets the receiver score after catching Quick Pass', () => {
    const gameplay = createGameplayModel();

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);
    updateGameplayModel(gameplay, 0.2);
    const receiver = getPlayer(gameplay.players, 'blocker-left');
    receiver.position.x = gameplay.ball.position.x;
    receiver.position.z = gameplay.ball.position.z;
    updateGameplayModel(gameplay, 0);

    receiver.position.z = GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;
    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult?.type).toBe('touchdown');
    expect(gameplay.score).toBe(GAMEPLAY_CONFIG.touchdownPoints);
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
    const defender = getPrimaryDefender(gameplay.players);
    startPlay(gameplay);
    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z + 5;
    defender.position.x = gameplay.player.position.x;
    defender.position.z = gameplay.player.position.z;

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
    const defender = getPrimaryDefender(gameplay.players);
    startPlay(gameplay);
    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z - 4;
    defender.position.x = gameplay.player.position.x;
    defender.position.z = gameplay.player.position.z;

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

    expect(getPrimaryDefender(gameplay.players).position).toEqual(DEFENDER_CONFIG.initialPosition);
    expect(getPrimaryDefender(gameplay.players).velocity).toEqual({ x: 0, z: 0 });
    expect(gameplay.players.every((player) => player.velocity.x === 0 && player.velocity.z === 0)).toBe(true);
    expect(gameplay.playState).toBe('preSnap');
  });

  it('steers the defender toward the carrier without instantly matching direction changes', () => {
    const gameplay = createGameplayModel();
    const defender = getPrimaryDefender(gameplay.players);
    defender.position.x = 0;
    defender.position.z = 0;
    defender.facingRadians = 0;
    gameplay.player.position.x = 10;
    gameplay.player.position.z = 0;

    updateDefenderPursuit(defender, gameplay.player, 0.1);

    expect(defender.facingRadians).toBeGreaterThan(0);
    expect(defender.facingRadians).toBeLessThan(Math.PI / 2);
    expect(defender.facingRadians).toBeCloseTo(
      DEFENDER_CONFIG.steeringRateRadiansPerSecond * 0.1,
    );
    expect(defender.velocity.x).toBeGreaterThan(0);
  });

  it('detects tackles using the configured tackle radius', () => {
    const gameplay = createGameplayModel();
    const defender = getPrimaryDefender(gameplay.players);
    defender.position.x = 0;
    defender.position.z = 0;
    gameplay.player.position.x = DEFENDER_CONFIG.tackleRadius - 0.01;
    gameplay.player.position.z = 0;

    expect(DEFENDER_CONFIG.tackleRadius).toBe(
      DEFENDER_COLLISION_RADII.ballCarrier + DEFENDER_COLLISION_RADII.defender,
    );
    expect(isTackleContact(defender, gameplay.player)).toBe(true);

    gameplay.player.position.x = DEFENDER_CONFIG.tackleRadius + 0.01;
    expect(isTackleContact(defender, gameplay.player)).toBe(false);
  });

  it('changes live play to dead on tackle and resets after the configured delay', () => {
    const gameplay = createGameplayModel();
    const defender = getPrimaryDefender(gameplay.players);
    startPlay(gameplay);
    defender.position.x = gameplay.player.position.x + DEFENDER_CONFIG.tackleRadius;
    defender.position.z = gameplay.player.position.z;

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
    expect(gameplay.lastPlayResult?.type).not.toBe('sack');
    expect(gameplay.drive.currentDown).toBe(2);
    expect(gameplay.drive.yardsToFirstDown).toBe(10);
    expect(gameplay.score).toBe(0);
    expect(gameplay.playResetTimerSeconds).toBe(GAMEPLAY_CONFIG.tackleResetDelaySeconds);

    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.tackleResetDelaySeconds);

    expect(snapshotGameplayModel(gameplay)).toMatchObject({
      lastPlayResult: null,
      playState: 'preSnap',
      score: 0,
    });
  });
});

function getPrimaryDefender(players: PlayerModel[]): PlayerModel {
  const defender = players.find((player) => player.id === 'defender-middle');

  if (!defender) {
    throw new Error('Missing middle defender');
  }

  return defender;
}

function getPlayer(players: PlayerModel[], playerId: string): PlayerModel {
  const player = players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Missing player ${playerId}`);
  }

  return player;
}

function snapshotBlockerFormation(player: PlayerModel): {
  facingRadians: number;
  position: PlayerModel['position'];
  velocity: PlayerModel['velocity'];
} {
  return {
    facingRadians: player.facingRadians,
    position: { ...player.position },
    velocity: { ...player.velocity },
  };
}
