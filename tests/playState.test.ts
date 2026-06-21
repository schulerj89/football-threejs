import { describe, expect, it } from 'vitest';
import { BALL_CARRY_ATTACHMENT, PASSING_CONFIG, updateCarriedBallPosition } from '../src/ballModel';
import { SNAP_LANE_X } from '../src/ballSpotting';
import {
  DEFENDER_COLLISION_RADII,
  DEFENDER_CONFIG,
  isTackleContact,
  updateDefenderPursuit,
} from '../src/defenderModel';
import { INITIAL_BALL_SPOT, LINE_OF_SCRIMMAGE_Z, PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { calculateYardsGained } from '../src/fieldScale';
import { FORMATION_MEASUREMENTS } from '../src/formationLayout';
import { FORWARD_PASS_CONFIG } from '../src/passRules';
import { PLAYER_MOVEMENT_CONFIG, type PlayerModel } from '../src/playerModel';
import { PRE_SNAP_FACING_RADIANS } from '../src/playbook';
import {
  GAMEPLAY_CONFIG,
  attemptPass,
  createGameplayModel,
  cycleSelectedReceiver,
  hasCrossedOpposingGoalLine,
  hasCrossedSideline,
  markPlayDead,
  resetPlay,
  restartScoreAttack,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
  updateGameplayModel,
} from '../src/playState';

describe('play state transitions', () => {
  it('defaults to the 11v11 playbook and Inside Zone 11', () => {
    const gameplay = createGameplayModel();

    expect(gameplay.playbookId).toBe('11v11');
    expect(gameplay.selectedPlay).toMatchObject({
      displayName: 'Inside Zone 11',
      id: 'inside-zone-11',
      kind: 'run',
    });
    expect(gameplay.availablePlays.map((play) => play.id)).toEqual([
      'inside-zone-11',
      'spread-quick-11',
    ]);
    expect(gameplay.players).toHaveLength(22);
    expect(gameplay.players.filter((player) => player.team === 'offense')).toHaveLength(11);
    expect(gameplay.players.filter((player) => player.team === 'defense')).toHaveLength(11);
    expect(gameplay.player).toMatchObject({
      id: 'offense-rb',
      role: 'runner',
    });
  });

  it('creates the 11v11 Inside Zone play with twenty-two active players', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });

    expect(gameplay.playbookId).toBe('11v11');
    expect(gameplay.availablePlays.map((play) => play.id)).toEqual([
      'inside-zone-11',
      'spread-quick-11',
    ]);
    expect(gameplay.selectedPlay).toMatchObject({
      displayName: 'Inside Zone 11',
      id: 'inside-zone-11',
      kind: 'run',
    });
    expect(gameplay.players).toHaveLength(22);
    expect(gameplay.players.filter((player) => player.team === 'offense')).toHaveLength(11);
    expect(gameplay.players.filter((player) => player.team === 'defense')).toHaveLength(11);
    expect(gameplay.player).toMatchObject({
      id: 'offense-rb',
      role: 'runner',
    });
    expect(getPlayer(gameplay.players, 'offense-qb')).toMatchObject({
      role: 'quarterback',
      currentState: 'idle',
    });
  });

  it('starts Inside Zone 11 with running back possession and the quarterback as a decoy', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });

    expect(startPlay(gameplay)).toBe(true);

    expect(gameplay.playState).toBe('live');
    expect(gameplay.player).toMatchObject({
      id: 'offense-rb',
      currentState: 'userControlled',
      role: 'runner',
    });
    expect(getPlayer(gameplay.players, 'offense-qb')).toMatchObject({
      currentState: 'idle',
      role: 'quarterback',
    });
    expect(gameplay.ball.possession).toEqual({
      kind: 'player',
      playerId: 'offense-rb',
    });
    expect(gameplay.ball.state).toMatchObject({
      kind: 'possessed',
      playerId: 'offense-rb',
    });
    expect(gameplay.players.filter((player) => player.team === 'offense' && player.role === 'blocker')).toHaveLength(9);
    expect(gameplay.players.filter((player) => player.team === 'defense' && player.currentState === 'pursuing')).toHaveLength(11);
  });

  it('resets Inside Zone 11 with all twenty-two players and no stale engagements', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    const initialPositions = Object.fromEntries(
      gameplay.players.map((player) => [player.id, { ...player.position }]),
    );

    startPlay(gameplay);
    gameplay.blocking.engagements.push({
      blockerId: 'offense-center',
      defenderId: 'defense-line-middle',
    });
    gameplay.player.position.x += 3;
    gameplay.player.position.z += 8;

    resetPlay(gameplay);

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.players).toHaveLength(22);
    expect(gameplay.blocking.engagements).toEqual([]);
    expect(gameplay.player.id).toBe('offense-rb');
    expect(gameplay.players.map((player) => player.id).sort()).toEqual(
      Object.keys(initialPositions).sort(),
    );
    for (const player of gameplay.players) {
      expect(player.position).toEqual(initialPositions[player.id]);
      expect(player.velocity).toEqual({ x: 0, z: 0 });
      expect(player.currentState).toBe('idle');
    }
  });

  it('records Inside Zone 11 tackle, first-down, touchdown, and out-of-bounds results', () => {
    const tackle = createGameplayModel({ playbookId: '11v11' });
    startPlay(tackle);
    tackle.player.position = { ...tackle.currentBallSpot };
    getPlayer(tackle.players, 'defense-safety').position = { ...tackle.player.position };
    updateGameplayModel(tackle, 0);

    expect(tackle.playState).toBe('dead');
    expect(tackle.lastPlayResult).toMatchObject({
      type: 'tackle',
      yardsGained: 0,
    });

    const firstDown = createGameplayModel({ playbookId: '11v11' });
    startPlay(firstDown);
    firstDown.player.position.z = firstDown.currentBallSpot.z + 11;
    getPlayer(firstDown.players, 'defense-safety').position = { ...firstDown.player.position };
    updateGameplayModel(firstDown, 0);

    expect(firstDown.lastPlayResult).toMatchObject({
      type: 'tackle',
      yardsGained: 11,
    });
    expect(firstDown.drive.currentDown).toBe(1);
    expect(firstDown.drive.yardsToFirstDown).toBe(10);

    const touchdown = createGameplayModel({ playbookId: '11v11' });
    startPlay(touchdown);
    touchdown.player.position.z = GAMEPLAY_CONFIG.opposingGoalLineZ;
    updateGameplayModel(touchdown, 0);

    expect(touchdown.lastPlayResult).toMatchObject({
      scoringTeam: 'offense',
      type: 'touchdown',
    });
    expect(touchdown.score).toBe(GAMEPLAY_CONFIG.touchdownPoints);

    const outOfBounds = createGameplayModel({ playbookId: '11v11' });
    startPlay(outOfBounds);
    outOfBounds.player.position.x = PLAYABLE_FIELD_BOUNDS.maxX + outOfBounds.player.collisionRadius + 0.1;
    updateGameplayModel(outOfBounds, 0);

    expect(outOfBounds.lastPlayResult).toMatchObject({
      type: 'outOfBounds',
    });
    expect(outOfBounds.nextSnapSpot.x).toBeLessThanOrEqual(PLAYABLE_FIELD_BOUNDS.maxX);
  });

  it('starts Spread Quick 11 with five stable receiver targets', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });

    expect(selectPlay(gameplay, 'spread-quick-11')).toBe(true);
    expect(gameplay.selectedPlay).toMatchObject({
      displayName: 'Spread Quick 11',
      id: 'spread-quick-11',
      kind: 'pass',
    });
    expect(gameplay.players).toHaveLength(22);
    expect(gameplay.player).toMatchObject({ id: 'offense-qb', role: 'quarterback' });
    expect(gameplay.selectedReceiverId).toBe('offense-wr-left');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-wr-right');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-slot');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-tight-end');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-rb');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-wr-left');
    expect(snapshotGameplayModel(gameplay).selectedReceiver).toEqual({
      displayName: 'Receiver Left',
      id: 'offense-wr-left',
    });
  });

  it('starts Spread Quick 11 routes only after snap and throws to each receiver', () => {
    const targetIds = [
      'offense-wr-left',
      'offense-wr-right',
      'offense-slot',
      'offense-tight-end',
      'offense-rb',
    ];

    for (const receiverId of targetIds) {
      const gameplay = createGameplayModel({ playbookId: '11v11' });
      selectPlay(gameplay, 'spread-quick-11');
      selectReceiver(gameplay, receiverId);
      const receiver = getPlayer(gameplay.players, receiverId);
      const receiverStart = { ...receiver.position };

      updateGameplayModel(gameplay, 0.25);

      expect(receiver.position).toEqual(receiverStart);

      startPlay(gameplay);
      updateGameplayModel(gameplay, 0.15);

      expect(receiver.position).not.toEqual(receiverStart);
      expect(attemptPass(gameplay)).toBe(true);
      expect(gameplay.passAudit).toMatchObject({
        selectedReceiverId: receiverId,
        resultReason: 'inFlight',
      });
      expect(cycleSelectedReceiver(gameplay)).toBe(false);

      for (let step = 0; step < 120 && gameplay.ball.state.kind === 'inFlight'; step += 1) {
        updateGameplayModel(gameplay, 1 / 60);
      }

      expect(gameplay.ball.state.kind).not.toBe('inFlight');
    }
  });

  it('catches Spread Quick 11, transfers control, and turns defenders into pursuit', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });

    selectPlay(gameplay, 'spread-quick-11');
    selectReceiver(gameplay, 'offense-slot');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);
    updateGameplayModel(gameplay, 0.2);
    const receiver = getPlayer(gameplay.players, 'offense-slot');
    receiver.position.x = gameplay.ball.position.x;
    receiver.position.z = gameplay.ball.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.ball.state).toEqual({ kind: 'caught', playerId: receiver.id });
    expect(gameplay.ball.possession).toEqual({ kind: 'player', playerId: receiver.id });
    expect(gameplay.player.id).toBe(receiver.id);
    expect(receiver.currentState).toBe('userControlled');

    const linebacker = getPlayer(gameplay.players, 'defense-linebacker');
    linebacker.position = { x: receiver.position.x + 10, z: receiver.position.z };
    linebacker.velocity = { x: 0, z: 0 };
    updateGameplayModel(gameplay, 0.1);

    expect(linebacker.currentState).toBe('pursuing');
    expect(linebacker.velocity.x).toBeLessThan(0);
  });

  it('keeps Spread Quick 11 incompletions at the original line of scrimmage', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });

    selectPlay(gameplay, 'spread-quick-11');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);
    for (const receiver of gameplay.players.filter((player) => player.role === 'receiver')) {
      receiver.position.x = PLAYABLE_FIELD_BOUNDS.minX + receiver.collisionRadius;
      receiver.position.z = PLAYABLE_FIELD_BOUNDS.minZ + receiver.collisionRadius;
    }
    updateGameplayModel(gameplay, 2);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.ball.state).toEqual({ kind: 'incomplete' });
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: INITIAL_BALL_SPOT,
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'incomplete',
      yardsGained: 0,
    });
    expect(gameplay.drive.lineOfScrimmage).toEqual(INITIAL_BALL_SPOT);
  });

  it('classifies Spread Quick 11 pre-release contact as a sack but ignores post-release quarterback contact', () => {
    const sack = createGameplayModel({ playbookId: '11v11' });

    selectPlay(sack, 'spread-quick-11');
    startPlay(sack);
    const middleRusher = getPlayer(sack.players, 'defense-line-middle');
    middleRusher.position = { ...sack.player.position };
    updateGameplayModel(sack, 0);

    expect(sack.playState).toBe('dead');
    expect(sack.lastPlayResult?.type).toBe('sack');
    expect(sack.lastPlayResult?.yardsGained).toBeLessThan(0);

    const postRelease = createGameplayModel({ playbookId: '11v11' });
    selectPlay(postRelease, 'spread-quick-11');
    startPlay(postRelease);
    expect(attemptPass(postRelease)).toBe(true);
    const lateRusher = getPlayer(postRelease.players, 'defense-line-middle');
    lateRusher.position = { ...postRelease.player.position };
    updateGameplayModel(postRelease, 0);

    expect(postRelease.playState).toBe('live');
    expect(postRelease.lastPlayResult).toBeNull();
    expect(postRelease.ball.state.kind).toBe('inFlight');
  });

  it('resets Spread Quick 11 routes, engagements, target, and pass state', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });

    selectPlay(gameplay, 'spread-quick-11');
    selectReceiver(gameplay, 'offense-rb');
    startPlay(gameplay);
    updateGameplayModel(gameplay, 0.2);
    gameplay.blocking.engagements.push({
      blockerId: 'offense-center',
      defenderId: 'defense-line-middle',
    });
    expect(attemptPass(gameplay)).toBe(true);

    resetPlay(gameplay);

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.selectedPlay.id).toBe('spread-quick-11');
    expect(gameplay.selectedReceiverId).toBe('offense-wr-left');
    expect(gameplay.blocking.engagements).toEqual([]);
    expect(gameplay.passAttempted).toBe(false);
    expect(gameplay.passAudit).toBeNull();
    expect(gameplay.forwardPassEligible).toBe(true);
    expect(gameplay.ball.state).toEqual({ kind: 'dead' });
    expect(Object.values(gameplay.receiverRouteStates).every((state) => state.distanceAlongRoute === 0)).toBe(true);
    expect(gameplay.players).toHaveLength(22);
    expect(gameplay.players.every((player) => player.currentState === 'idle')).toBe(true);
  });

  it('starts in preSnap at the line of scrimmage without ball possession', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.player).toMatchObject({
      id: 'offense-rb',
      position: { x: 0, z: LINE_OF_SCRIMMAGE_Z - FORMATION_MEASUREMENTS.runningBackDepth },
      role: 'runner',
    });
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
    expect(gameplay.players).toHaveLength(10);
    expect(gameplay.players.filter((player) => player.team === 'offense')).toHaveLength(5);
    expect(gameplay.players.filter((player) => player.team === 'defense')).toHaveLength(5);
    expect(gameplay.players.every((player) => player.currentState === 'idle')).toBe(true);
    expect(getPrimaryDefender(gameplay.players).velocity).toEqual({ x: 0, z: 0 });
    expect(gameplay.ball.possession).toEqual({ kind: 'none' });
    expect(gameplay.lastPlayResult).toBeNull();
    expect(gameplay.scoreAttack).toMatchObject({
      finalScore: null,
      remainingSeconds: 120,
      state: 'ready',
    });
    expect(snapshotGameplayModel(gameplay).scoreAttack).toMatchObject({
      finalScore: null,
      remainingSeconds: 120,
      state: 'ready',
    });
  });

  it('starts a valid play from preSnap and gives the player possession', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

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
    expect(gameplay.players.filter((player) => player.team === 'defense')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currentState: 'pursuing' }),
        expect.objectContaining({ currentState: 'pursuing' }),
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
    expect(gameplay.scoreAttack).toMatchObject({
      remainingSeconds: 120,
      state: 'running',
    });
  });

  it('keeps the score attack clock at 120 before the first snap', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    updateGameplayModel(gameplay, 30);

    expect(gameplay.scoreAttack.remainingSeconds).toBe(120);
    expect(gameplay.scoreAttack.state).toBe('ready');
  });

  it('decreases the score attack clock from supplied delta after the first snap', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    startPlay(gameplay);
    updateGameplayModel(gameplay, 12.25);

    expect(gameplay.scoreAttack.remainingSeconds).toBeCloseTo(107.75);
    expect(snapshotGameplayModel(gameplay).scoreAttack.remainingSeconds).toBeCloseTo(107.75);
  });

  it('runs the clock during dead-play delays and preSnap between plays', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const defender = getPrimaryDefender(gameplay.players);

    startPlay(gameplay);
    defender.position.x = gameplay.player.position.x;
    defender.position.z = gameplay.player.position.z;
    updateGameplayModel(gameplay, 0);
    const remainingAtResult = gameplay.scoreAttack.remainingSeconds;

    updateGameplayModel(gameplay, 0.5);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.scoreAttack.remainingSeconds).toBeCloseTo(remainingAtResult - 0.5);

    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.tackleResetDelaySeconds);
    expect(gameplay.playState).toBe('preSnap');
    const remainingAtPreSnap = gameplay.scoreAttack.remainingSeconds;

    updateGameplayModel(gameplay, 1);

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.scoreAttack.remainingSeconds).toBeCloseTo(remainingAtPreSnap - 1);
  });

  it('allows a live play to finish when the score attack clock reaches zero', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    startPlay(gameplay);
    updateGameplayModel(gameplay, 121);

    expect(gameplay.scoreAttack).toMatchObject({
      remainingSeconds: 0,
      state: 'expired',
    });
    expect(gameplay.playState).toBe('live');

    gameplay.player.position.z =
      GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;
    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult?.type).toBe('touchdown');
    expect(gameplay.score).toBe(GAMEPLAY_CONFIG.touchdownPoints);

    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.touchdownResetDelaySeconds);

    expect(gameplay.playState).toBe('gameOver');
    expect(gameplay.scoreAttack).toMatchObject({
      finalScore: GAMEPLAY_CONFIG.touchdownPoints,
      remainingSeconds: 0,
      state: 'gameOver',
    });
    expect(startPlay(gameplay)).toBe(false);
  });

  it('prevents another snap after the score attack clock reaches zero in preSnap', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const defender = getPrimaryDefender(gameplay.players);

    startPlay(gameplay);
    defender.position.x = gameplay.player.position.x;
    defender.position.z = gameplay.player.position.z;
    updateGameplayModel(gameplay, 0);
    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.tackleResetDelaySeconds);

    expect(gameplay.playState).toBe('preSnap');

    updateGameplayModel(gameplay, 121);

    expect(gameplay.playState).toBe('gameOver');
    expect(gameplay.scoreAttack.remainingSeconds).toBe(0);
    expect(startPlay(gameplay)).toBe(false);
  });

  it('restarts the score attack from gameOver with clock, drive, score, and default play reset', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'slant-flat');
    startPlay(gameplay);
    updateGameplayModel(gameplay, 121);
    gameplay.player.position.z =
      GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;
    updateGameplayModel(gameplay, 0);
    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.touchdownResetDelaySeconds);

    expect(gameplay.playState).toBe('gameOver');
    expect(gameplay.score).toBe(GAMEPLAY_CONFIG.touchdownPoints);
    expect(gameplay.selectedPlay.id).toBe('slant-flat');

    expect(restartScoreAttack(gameplay)).toBe(true);

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.score).toBe(0);
    expect(gameplay.scoreAttack).toMatchObject({
      finalScore: null,
      remainingSeconds: 120,
      state: 'ready',
    });
    expect(gameplay.drive).toMatchObject({
      currentDown: 1,
      lineOfScrimmage: INITIAL_BALL_SPOT,
      state: 'active',
      yardsToFirstDown: 10,
    });
    expect(gameplay.selectedPlay.id).toBe('inside-run');
    expect(gameplay.player.position).toEqual({
      x: 0,
      z: LINE_OF_SCRIMMAGE_Z - FORMATION_MEASUREMENTS.runningBackDepth,
    });
    expect(gameplay.ball.possession).toEqual({ kind: 'none' });
  });

  it('selects a rushing play during preSnap and resets players into that formation', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    expect(gameplay.selectedPlay.id).toBe('inside-run');
    expect(selectPlay(gameplay, 'outside-run')).toBe(true);

    expect(gameplay.selectedPlay.id).toBe('outside-run');
    expect(gameplay.player.position.x).toBeCloseTo(2.5);
    expect(gameplay.player.position.z).toBeCloseTo(
      LINE_OF_SCRIMMAGE_Z - FORMATION_MEASUREMENTS.runningBackDepth,
    );
    expect(gameplay.players.every((player) => player.currentState === 'idle')).toBe(true);
    expect(gameplay.ball.possession).toEqual({ kind: 'none' });
    expect(gameplay.ball.position.z).toBeCloseTo(LINE_OF_SCRIMMAGE_Z);
  });

  it('prevents play selection during live play', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    startPlay(gameplay);
    expect(selectPlay(gameplay, 'outside-run')).toBe(false);

    expect(gameplay.selectedPlay.id).toBe('inside-run');
    expect(gameplay.player.currentState).toBe('userControlled');
  });

  it('preserves the selected play when resetting', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'outside-run');
    startPlay(gameplay);
    gameplay.player.position.x = 8;
    resetPlay(gameplay);

    expect(gameplay.selectedPlay.id).toBe('outside-run');
    expect(gameplay.player.position.x).toBeCloseTo(2.5);
    expect(gameplay.player.position.z).toBeCloseTo(
      LINE_OF_SCRIMMAGE_Z - FORMATION_MEASUREMENTS.runningBackDepth,
    );
    expect(gameplay.playState).toBe('preSnap');
  });

  it('sets Outside Run blockers in neutral pre-snap facing at their formation positions', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    expect(selectPlay(gameplay, 'outside-run')).toBe(true);
    const leftBlocker = getPlayer(gameplay.players, 'offense-blocker-left');
    const rightBlocker = getPlayer(gameplay.players, 'offense-blocker-right');

    expect(leftBlocker.position).toEqual({
      x: -FORMATION_MEASUREMENTS.blockerSpacing,
      z: LINE_OF_SCRIMMAGE_Z - FORMATION_MEASUREMENTS.offensiveLineSetback,
    });
    expect(rightBlocker.position).toEqual({
      x: FORMATION_MEASUREMENTS.blockerSpacing,
      z: LINE_OF_SCRIMMAGE_Z - FORMATION_MEASUREMENTS.offensiveLineSetback,
    });
    expect(leftBlocker.velocity).toEqual({ x: 0, z: 0 });
    expect(rightBlocker.velocity).toEqual({ x: 0, z: 0 });
    expect(leftBlocker.facingRadians).toBe(PRE_SNAP_FACING_RADIANS.playDirection);
    expect(rightBlocker.facingRadians).toBe(PRE_SNAP_FACING_RADIANS.playDirection);
  });

  it('does not let preSnap simulation frames change Outside Run blocker facing', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'outside-run');
    const leftBlocker = getPlayer(gameplay.players, 'offense-blocker-left');
    const rightBlocker = getPlayer(gameplay.players, 'offense-blocker-right');
    const leftStart = snapshotBlockerFormation(leftBlocker);
    const rightStart = snapshotBlockerFormation(rightBlocker);

    updateGameplayModel(gameplay, 0.1);
    updateGameplayModel(gameplay, 0.1);
    updateGameplayModel(gameplay, 0.1);

    expect(snapshotBlockerFormation(leftBlocker)).toEqual(leftStart);
    expect(snapshotBlockerFormation(rightBlocker)).toEqual(rightStart);
  });

  it('allows Outside Run blockers to turn toward assignments after the snap', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'outside-run');
    const leftBlocker = getPlayer(gameplay.players, 'offense-blocker-left');
    const rightBlocker = getPlayer(gameplay.players, 'offense-blocker-right');
    const leftPreSnapFacing = leftBlocker.facingRadians;
    const rightPreSnapFacing = rightBlocker.facingRadians;

    startPlay(gameplay);
    updateGameplayModel(gameplay, 0.1);

    expect(leftBlocker.facingRadians).not.toBeCloseTo(leftPreSnapFacing);
    expect(rightBlocker.facingRadians).not.toBeCloseTo(rightPreSnapFacing);
  });

  it('restores Outside Run blocker formation position and pre-snap facing on reset', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'outside-run');
    const leftBlocker = getPlayer(gameplay.players, 'offense-blocker-left');
    const rightBlocker = getPlayer(gameplay.players, 'offense-blocker-right');
    const leftStart = snapshotBlockerFormation(leftBlocker);
    const rightStart = snapshotBlockerFormation(rightBlocker);

    startPlay(gameplay);
    updateGameplayModel(gameplay, 0.1);
    resetPlay(gameplay);

    expect(snapshotBlockerFormation(leftBlocker)).toEqual(leftStart);
    expect(snapshotBlockerFormation(rightBlocker)).toEqual(rightStart);
  });

  it('keeps Inside Run blockers in neutral pre-snap facing', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const leftBlocker = getPlayer(gameplay.players, 'offense-blocker-left');
    const rightBlocker = getPlayer(gameplay.players, 'offense-blocker-right');

    expect(gameplay.selectedPlay.id).toBe('inside-run');
    expect(leftBlocker.facingRadians).toBe(PRE_SNAP_FACING_RADIANS.playDirection);
    expect(rightBlocker.facingRadians).toBe(PRE_SNAP_FACING_RADIANS.playDirection);
  });

  it('selects Quick Pass during preSnap and starts the receiver route only after the snap', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    expect(selectPlay(gameplay, 'quick-pass')).toBe(true);
    const receiver = getPlayer(gameplay.players, 'offense-wr');
    const initialReceiverPosition = { ...receiver.position };

    expect(gameplay.selectedPlay).toMatchObject({
      displayName: 'Quick Pass',
      id: 'quick-pass',
      kind: 'pass',
    });
    expect(gameplay.player).toMatchObject({ id: 'offense-qb', role: 'quarterback' });
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

  it('selects Slant Flat with two receivers and starts both routes only after the snap', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    expect(selectPlay(gameplay, 'slant-flat')).toBe(true);
    const leftReceiver = getPlayer(gameplay.players, 'offense-wr');
    const rightReceiver = getPlayer(gameplay.players, 'offense-rb');
    const initialLeftPosition = { ...leftReceiver.position };
    const initialRightPosition = { ...rightReceiver.position };

    expect(gameplay.selectedPlay).toMatchObject({
      displayName: 'Slant Flat',
      id: 'slant-flat',
      kind: 'pass',
    });
    expect(gameplay.selectedReceiverId).toBe('offense-wr');
    expect(snapshotGameplayModel(gameplay).selectedReceiver).toEqual({
      displayName: 'Slant',
      id: 'offense-wr',
    });
    expect(leftReceiver).toMatchObject({ role: 'receiver', currentState: 'idle' });
    expect(rightReceiver).toMatchObject({ role: 'receiver', currentState: 'idle' });

    updateGameplayModel(gameplay, 0.3);

    expect(leftReceiver.position).toEqual(initialLeftPosition);
    expect(rightReceiver.position).toEqual(initialRightPosition);
    expect(leftReceiver.currentState).toBe('idle');
    expect(rightReceiver.currentState).toBe('idle');

    expect(startPlay(gameplay)).toBe(true);
    expect(leftReceiver.currentState).toBe('runningRoute');
    expect(rightReceiver.currentState).toBe('runningRoute');

    updateGameplayModel(gameplay, 0.1);

    expect(leftReceiver.position.z).toBeGreaterThan(initialLeftPosition.z);
    expect(rightReceiver.position.x).toBeLessThan(initialRightPosition.x);
  });

  it('cycles Slant Flat receivers deterministically before and after the snap', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'slant-flat');

    expect(gameplay.selectedReceiverId).toBe('offense-wr');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-rb');
    expect(snapshotGameplayModel(gameplay).selectedReceiver).toEqual({
      displayName: 'Flat',
      id: 'offense-rb',
    });
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-wr');

    startPlay(gameplay);
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-rb');
  });

  it('throws Slant Flat toward the selected receiver and locks selection after the throw', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'slant-flat');
    cycleSelectedReceiver(gameplay);
    startPlay(gameplay);

    expect(gameplay.selectedReceiverId).toBe('offense-rb');
    expect(attemptPass(gameplay)).toBe(true);

    expect(gameplay.passAttempted).toBe(true);
    expect(gameplay.ball.state).toMatchObject({
      kind: 'inFlight',
      target: expect.objectContaining({
        x: expect.any(Number),
      }),
    });
    if (gameplay.ball.state.kind !== 'inFlight') {
      throw new Error('Expected Slant Flat pass to be in flight');
    }
    expect(gameplay.ball.state.target.x).toBeLessThan(0);
    expect(cycleSelectedReceiver(gameplay)).toBe(false);
    expect(gameplay.selectedReceiverId).toBe('offense-rb');
  });

  it('restores the Slant Flat default target on reset', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'slant-flat');
    cycleSelectedReceiver(gameplay);
    startPlay(gameplay);

    expect(gameplay.selectedReceiverId).toBe('offense-rb');

    resetPlay(gameplay);

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.selectedPlay.id).toBe('slant-flat');
    expect(gameplay.selectedReceiverId).toBe('offense-wr');
    expect(getPlayer(gameplay.players, 'offense-wr').position.x).toBeGreaterThan(0);
    expect(getPlayer(gameplay.players, 'offense-wr').position.z).toBeCloseTo(
      LINE_OF_SCRIMMAGE_Z - FORMATION_MEASUREMENTS.offensiveLineSetback,
    );
    expect(getPlayer(gameplay.players, 'offense-rb').position).toEqual({
      x: 0,
      z: LINE_OF_SCRIMMAGE_Z - FORMATION_MEASUREMENTS.runningBackDepth,
    });
  });

  it('resets receiver route progress when the play resets', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'slant-flat');
    startPlay(gameplay);
    updateGameplayModel(gameplay, 0.25);

    expect(gameplay.receiverRouteStates['offense-wr'].distanceAlongRoute).toBeGreaterThan(0);
    expect(gameplay.receiverRouteStates['offense-rb'].distanceAlongRoute).toBeGreaterThan(0);

    resetPlay(gameplay);

    expect(gameplay.receiverRouteStates['offense-wr'].distanceAlongRoute).toBe(0);
    expect(gameplay.receiverRouteStates['offense-wr'].segmentIndex).toBe(0);
    expect(gameplay.receiverRouteStates['offense-wr'].completed).toBe(false);
    expect(gameplay.receiverRouteStates['offense-rb'].distanceAlongRoute).toBe(0);
  });

  it('stops automatic route following after catch control transfers to the receiver', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);
    updateGameplayModel(gameplay, 0.2);
    const receiver = getPlayer(gameplay.players, 'offense-wr');
    receiver.position.x = gameplay.ball.position.x;
    receiver.position.z = gameplay.ball.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.player.id).toBe(receiver.id);
    expect(receiver.currentState).toBe('userControlled');

    const caughtPosition = { ...receiver.position };
    for (const defender of gameplay.players.filter((player) => player.team === 'defense')) {
      defender.position.x = PLAYABLE_FIELD_BOUNDS.maxX - defender.collisionRadius;
      defender.position.z = PLAYABLE_FIELD_BOUNDS.maxZ - defender.collisionRadius;
    }

    updateGameplayModel(gameplay, 0.25);

    expect(receiver.position).toEqual(caughtPosition);
  });

  it('records route-aware pass audit details for the selected receiver and clears them on reset', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'slant-flat');
    cycleSelectedReceiver(gameplay);
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);

    expect(gameplay.passAudit).toMatchObject({
      selectedReceiverId: 'offense-rb',
      resultReason: 'inFlight',
    });
    expect(gameplay.passAudit?.predictedReceiverRouteDistance).toBeGreaterThan(0);
    expect(snapshotGameplayModel(gameplay).passAudit?.selectedReceiverId).toBe('offense-rb');

    updateGameplayModel(gameplay, 1 / 60);

    expect(gameplay.passAudit?.actualClosestApproach).not.toBeNull();
    expect(gameplay.previousPlayerPositions['offense-rb']).toBeDefined();

    resetPlay(gameplay);

    expect(gameplay.passAudit).toBeNull();
    expect(snapshotGameplayModel(gameplay).passAudit).toBeNull();
    expect(gameplay.previousPlayerPositions).toEqual({});
  });

  it('produces the same pass result at 30, 60, and 120 updates per second', () => {
    const results = [30, 60, 120].map((fps) => runSlantFlatPassUntilResolved(fps, 0.2));

    expect(results.map((result) => result.ballState)).toEqual(['caught', 'caught', 'caught']);
    expect(results.every((result) => result.controlledPlayerId === 'offense-wr')).toBe(true);
    for (const result of results) {
      expect(result.passAudit?.resultReason).toBe('catch');
      expect(result.passAudit?.horizontalMissDistance).toBeLessThanOrEqual(PASSING_CONFIG.catchRadius);
    }
  });

  it('starts Twin Slants Flat in playable 7v7 mode with three deterministic targets', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });

    expect(gameplay.playbookId).toBe('7v7');
    expect(gameplay.availablePlays.map((play) => play.id)).toEqual([
      'inside-zone-7',
      'outside-zone-7',
      'quick-pass-7',
      'twin-slants-flat',
    ]);
    expect(gameplay.selectedPlay.id).toBe('inside-zone-7');
    expect(selectPlay(gameplay, 'twin-slants-flat')).toBe(true);
    expect(gameplay.selectedPlay).toMatchObject({
      displayName: 'Twin Slants Flat',
      id: 'twin-slants-flat',
      kind: 'pass',
    });
    expect(gameplay.players).toHaveLength(14);
    expect(gameplay.players.filter((player) => player.team === 'offense')).toHaveLength(7);
    expect(gameplay.players.filter((player) => player.team === 'defense')).toHaveLength(7);
    expect(gameplay.player).toMatchObject({ id: 'offense-qb', role: 'quarterback' });
    expect(gameplay.selectedReceiverId).toBe('offense-wr-left');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-wr-right');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-rb');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-wr-left');
    expect(snapshotGameplayModel(gameplay).selectedReceiver).toEqual({
      displayName: 'Receiver Left',
      id: 'offense-wr-left',
    });
  });

  it('starts Twin Slants Flat receiver routes only after the snap', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });
    selectPlay(gameplay, 'twin-slants-flat');
    const leftReceiver = getPlayer(gameplay.players, 'offense-wr-left');
    const rightReceiver = getPlayer(gameplay.players, 'offense-wr-right');
    const runningBack = getPlayer(gameplay.players, 'offense-rb');
    const leftStart = { ...leftReceiver.position };
    const rightStart = { ...rightReceiver.position };
    const backStart = { ...runningBack.position };

    updateGameplayModel(gameplay, 0.3);
    expect(leftReceiver.position).toEqual(leftStart);
    expect(rightReceiver.position).toEqual(rightStart);
    expect(runningBack.position).toEqual(backStart);

    expect(startPlay(gameplay)).toBe(true);
    expect(leftReceiver.currentState).toBe('runningRoute');
    expect(rightReceiver.currentState).toBe('runningRoute');
    expect(runningBack.currentState).toBe('runningRoute');

    updateGameplayModel(gameplay, 0.1);

    expect(leftReceiver.position.x).toBeGreaterThan(leftStart.x);
    expect(leftReceiver.position.z).toBeGreaterThan(leftStart.z);
    expect(rightReceiver.position.x).toBeLessThan(rightStart.x);
    expect(rightReceiver.position.z).toBeGreaterThan(rightStart.z);
    expect(runningBack.position.x).toBeGreaterThan(backStart.x);
  });

  it('cycles Quick Pass 7 receivers in deterministic order', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });

    expect(selectPlay(gameplay, 'quick-pass-7')).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-wr-left');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-wr-right');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-rb');
    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    expect(gameplay.selectedReceiverId).toBe('offense-wr-left');
  });

  it('throws Twin Slants Flat toward each selected receiver and locks selection after release', () => {
    const targetExpectations = [
      { direction: 'right', receiverId: 'offense-wr-left' },
      { direction: 'left', receiverId: 'offense-wr-right' },
      { direction: 'right', receiverId: 'offense-rb' },
    ] as const;

    for (const expectation of targetExpectations) {
      const gameplay = createGameplayModel({ playbookId: '7v7' });
      selectPlay(gameplay, 'twin-slants-flat');
      selectReceiver(gameplay, expectation.receiverId);
      const receiver = getPlayer(gameplay.players, expectation.receiverId);
      const receiverX = receiver.position.x;

      startPlay(gameplay);
      expect(attemptPass(gameplay)).toBe(true);

      if (gameplay.ball.state.kind !== 'inFlight') {
        throw new Error('Expected Twin Slants Flat pass to be in flight');
      }

      if (expectation.direction === 'right') {
        expect(gameplay.ball.state.target.x).toBeGreaterThan(receiverX);
      } else {
        expect(gameplay.ball.state.target.x).toBeLessThan(receiverX);
      }

      expect(cycleSelectedReceiver(gameplay)).toBe(false);
      expect(gameplay.selectedReceiverId).toBe(expectation.receiverId);
    }
  });

  it('catches Twin Slants Flat, transfers control, and then has defenders pursue the receiver', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });

    selectPlay(gameplay, 'twin-slants-flat');
    selectReceiver(gameplay, 'offense-rb');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);
    updateGameplayModel(gameplay, 0.2);
    const receiver = getPlayer(gameplay.players, 'offense-rb');
    receiver.position.x = gameplay.ball.position.x;
    receiver.position.z = gameplay.ball.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.ball.state).toEqual({ kind: 'caught', playerId: receiver.id });
    expect(gameplay.ball.possession).toEqual({ kind: 'player', playerId: receiver.id });
    expect(gameplay.player.id).toBe(receiver.id);
    expect(receiver.currentState).toBe('userControlled');

    const corner = getPlayer(gameplay.players, 'defense-corner-left');
    corner.position = { x: receiver.position.x + 10, z: receiver.position.z };
    corner.velocity = { x: 0, z: 0 };
    updateGameplayModel(gameplay, 0.1);

    expect(corner.currentState).toBe('pursuing');
    expect(corner.velocity.x).toBeLessThan(0);
  });

  it('keeps Twin Slants Flat incompletions at the original line of scrimmage', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });

    selectPlay(gameplay, 'twin-slants-flat');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);
    for (const receiver of gameplay.players.filter((player) => player.role === 'receiver')) {
      receiver.position.x = PLAYABLE_FIELD_BOUNDS.minX + receiver.collisionRadius;
      receiver.position.z = PLAYABLE_FIELD_BOUNDS.minZ + receiver.collisionRadius;
    }
    updateGameplayModel(gameplay, 2);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.ball.state).toEqual({ kind: 'incomplete' });
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: INITIAL_BALL_SPOT,
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'incomplete',
      yardsGained: 0,
    });
    expect(gameplay.drive.lineOfScrimmage).toEqual(INITIAL_BALL_SPOT);
  });

  it('classifies pre-throw 7v7 quarterback contact as a sack and post-release contact as live play', () => {
    const sack = createGameplayModel({ playbookId: '7v7' });

    selectPlay(sack, 'twin-slants-flat');
    startPlay(sack);
    const middleRusher = getPlayer(sack.players, 'defense-line-middle');
    middleRusher.position.x = sack.player.position.x;
    middleRusher.position.z = sack.player.position.z;
    updateGameplayModel(sack, 0);

    expect(sack.playState).toBe('dead');
    expect(sack.lastPlayResult?.type).toBe('sack');
    expect(sack.lastPlayResult?.yardsGained).toBeLessThan(0);

    const postRelease = createGameplayModel({ playbookId: '7v7' });
    selectPlay(postRelease, 'twin-slants-flat');
    startPlay(postRelease);
    expect(attemptPass(postRelease)).toBe(true);
    const lateRusher = getPlayer(postRelease.players, 'defense-line-middle');
    lateRusher.position.x = postRelease.player.position.x;
    lateRusher.position.z = postRelease.player.position.z;
    updateGameplayModel(postRelease, 0);

    expect(postRelease.playState).toBe('live');
    expect(postRelease.lastPlayResult).toBeNull();
    expect(postRelease.ball.state.kind).toBe('inFlight');
  });

  it('resets Twin Slants Flat to all fourteen players and the default target', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });

    selectPlay(gameplay, 'twin-slants-flat');
    selectReceiver(gameplay, 'offense-rb');
    startPlay(gameplay);
    gameplay.player.position.x = 7;
    resetPlay(gameplay);

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.selectedPlay.id).toBe('twin-slants-flat');
    expect(gameplay.selectedReceiverId).toBe('offense-wr-left');
    expect(gameplay.players).toHaveLength(14);
    expect(gameplay.players.every((player) => player.currentState === 'idle')).toBe(true);
    expect(getPlayer(gameplay.players, 'offense-qb').position).toEqual({
      x: 0,
      z: LINE_OF_SCRIMMAGE_Z - 4.4,
    });
  });

  it('throws Quick Pass once and transitions the ball to inFlight state', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);

    expect(attemptPass(gameplay)).toBe(true);
    expect(gameplay.passAttempted).toBe(true);
    expect(gameplay.ball.possession).toEqual({ kind: 'none' });
    expect(gameplay.ball.state).toMatchObject({ kind: 'inFlight' });
    expect(gameplay.player.currentState).toBe('idle');
    expect(attemptPass(gameplay)).toBe(false);
  });

  it('allows a forward pass while the quarterback is behind the original line', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z - 0.5;

    expect(gameplay.forwardPassEligible).toBe(true);
    expect(attemptPass(gameplay)).toBe(true);

    expect(gameplay.forwardPassEligible).toBe(true);
    expect(gameplay.passAttempted).toBe(true);
    expect(gameplay.ball.state).toMatchObject({ kind: 'inFlight' });
  });

  it('does not remove forward-pass eligibility inside the line epsilon', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    gameplay.player.position.z =
      LINE_OF_SCRIMMAGE_Z + FORWARD_PASS_CONFIG.lineOfScrimmageEpsilon / 2;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.forwardPassEligible).toBe(true);
  });

  it('permanently disables forward passing after the quarterback crosses the original line', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    gameplay.player.position.z =
      LINE_OF_SCRIMMAGE_Z + FORWARD_PASS_CONFIG.lineOfScrimmageEpsilon * 2;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.forwardPassEligible).toBe(false);

    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z - 3;
    updateGameplayModel(gameplay, 0);

    expect(gameplay.forwardPassEligible).toBe(false);
  });

  it('rejects an ineligible pass without changing ball state or passAttempted', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z + 2;
    updateGameplayModel(gameplay, 0);
    const ballState = { ...gameplay.ball.state };
    const ballPossession = { ...gameplay.ball.possession };

    expect(attemptPass(gameplay)).toBe(false);

    expect(gameplay.forwardPassEligible).toBe(false);
    expect(gameplay.passAttempted).toBe(false);
    expect(gameplay.ball.state).toEqual(ballState);
    expect(gameplay.ball.possession).toEqual(ballPossession);
    expect(snapshotGameplayModel(gameplay).passFeedback).toBe('pastLineOfScrimmage');
  });

  it('records a sack when an ordinary defender contacts the quarterback before a pass', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

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
    const gameplay = createGameplayModel({ playbookId: '5v5' });

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
    const gameplay = createGameplayModel({ playbookId: '5v5' });

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
    expect(gameplay.forwardPassEligible).toBe(false);
  });

  it('catches a pass, transfers possession and control to the receiver, and records completed-pass yardage', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);

    updateGameplayModel(gameplay, 0.2);
    const receiver = getPlayer(gameplay.players, 'offense-wr');
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
    const gameplay = createGameplayModel({ playbookId: '5v5' });

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
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);
    updateGameplayModel(gameplay, 0.2);
    const receiver = getPlayer(gameplay.players, 'offense-wr');
    receiver.position.x = gameplay.ball.position.x;
    receiver.position.z = gameplay.ball.position.z;
    updateGameplayModel(gameplay, 0);

    receiver.position.z = GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;
    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult?.type).toBe('touchdown');
    expect(gameplay.score).toBe(GAMEPLAY_CONFIG.touchdownPoints);
  });

  it('lets the quarterback score a rushing touchdown after crossing the line', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    gameplay.player.position.z = GAMEPLAY_CONFIG.opposingGoalLineZ - PLAYER_MOVEMENT_CONFIG.halfDepth;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.forwardPassEligible).toBe(false);
    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult?.type).toBe('touchdown');
    expect(gameplay.score).toBe(GAMEPLAY_CONFIG.touchdownPoints);
  });

  it('restores forward-pass eligibility on reset', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'quick-pass');
    startPlay(gameplay);
    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z + 2;
    updateGameplayModel(gameplay, 0);

    expect(gameplay.forwardPassEligible).toBe(false);

    resetPlay(gameplay);

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.forwardPassEligible).toBe(true);
    expect(gameplay.passAttempted).toBe(false);
    expect(snapshotGameplayModel(gameplay).passFeedback).toBeNull();
  });

  it('rejects invalid start and dead transitions', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

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
    const gameplay = createGameplayModel({ playbookId: '5v5' });

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
        position: { x: 0, z: LINE_OF_SCRIMMAGE_Z - FORMATION_MEASUREMENTS.runningBackDepth },
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
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    startPlay(gameplay);
    gameplay.player.position.x = 3;
    gameplay.player.position.z = -10;
    gameplay.player.facingRadians = Math.PI / 2;

    updateCarriedBallPosition(gameplay.ball, gameplay.player);

    expect(gameplay.ball.position.x).toBeCloseTo(3 + BALL_CARRY_ATTACHMENT.z);
    expect(gameplay.ball.position.z).toBeCloseTo(-10 - BALL_CARRY_ATTACHMENT.x);
  });

  it('scores when the possessed player crosses the opposing goal line during live play', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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
    expect(gameplay.player.position).toEqual({
      x: 0,
      z: LINE_OF_SCRIMMAGE_Z + 5 - FORMATION_MEASUREMENTS.runningBackDepth,
    });
    expect(gameplay.ball.position).toMatchObject({
      x: 0,
      y: BALL_CARRY_ATTACHMENT.y,
      z: LINE_OF_SCRIMMAGE_Z + 5,
    });
    expect(gameplay.lastPlayResult).toBeNull();
  });

  it('records negative yards when the carrier is tackled behind the starting spot', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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

  it('keeps exact tackle progress while resetting formation at the resolved snap spot', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const defender = getPrimaryDefender(gameplay.players);
    const exactTackleSpot = { x: PLAYABLE_FIELD_BOUNDS.minX + 2, z: LINE_OF_SCRIMMAGE_Z + 5 };
    const expectedSnapSpot = { x: SNAP_LANE_X.leftHash, z: exactTackleSpot.z };

    startPlay(gameplay);
    gameplay.player.position.x = exactTackleSpot.x;
    gameplay.player.position.z = exactTackleSpot.z;
    defender.position.x = gameplay.player.position.x;
    defender.position.z = gameplay.player.position.z;

    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: exactTackleSpot,
      type: 'tackle',
    });
    expect(gameplay.lastPlayResult?.yardsGained).toBeCloseTo(5);
    expect(gameplay.nextSnapSpot).toEqual(expectedSnapSpot);
    expect(gameplay.drive.lineOfScrimmage).toEqual(expectedSnapSpot);
    expect(gameplay.drive.snapLane).toBe('leftHash');

    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.tackleResetDelaySeconds);

    expect(gameplay.currentBallSpot).toEqual(expectedSnapSpot);
    expect(gameplay.formationOrigin).toEqual(expectedSnapSpot);
    expect(gameplay.player.position).toEqual({
      x: expectedSnapSpot.x,
      z: expectedSnapSpot.z - FORMATION_MEASUREMENTS.runningBackDepth,
    });
  });

  it('ends live play out of bounds and resolves the next snap to the nearest hash', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const exactDeadBallSpot = {
      x: PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.halfWidth,
      z: LINE_OF_SCRIMMAGE_Z + 6,
    };
    const expectedSnapSpot = { x: SNAP_LANE_X.rightHash, z: exactDeadBallSpot.z };

    startPlay(gameplay);
    gameplay.player.position.x = PLAYABLE_FIELD_BOUNDS.maxX;
    gameplay.player.position.z = exactDeadBallSpot.z;

    expect(hasCrossedSideline(gameplay.player)).toBe(true);
    updateGameplayModel(gameplay, 0);

    expect(gameplay.playState).toBe('dead');
    expect(gameplay.lastPlayResult).toMatchObject({
      endingBallSpot: exactDeadBallSpot,
      reason: 'outOfBounds',
      scoringTeam: null,
      startingBallSpot: INITIAL_BALL_SPOT,
      type: 'outOfBounds',
    });
    expect(gameplay.lastPlayResult?.yardsGained).toBeCloseTo(6);
    expect(gameplay.drive.currentDown).toBe(2);
    expect(gameplay.drive.yardsToFirstDown).toBeCloseTo(4);
    expect(gameplay.nextSnapSpot).toEqual(expectedSnapSpot);
    expect(gameplay.nextBallSpot).toEqual(expectedSnapSpot);
    expect(gameplay.drive.snapLane).toBe('rightHash');
    expect(gameplay.playResetTimerSeconds).toBe(GAMEPLAY_CONFIG.outOfBoundsResetDelaySeconds);

    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.outOfBoundsResetDelaySeconds);

    expect(gameplay.currentBallSpot).toEqual(expectedSnapSpot);
    expect(gameplay.formationOrigin).toEqual(expectedSnapSpot);
    expect(gameplay.player.position).toEqual({
      x: expectedSnapSpot.x,
      z: expectedSnapSpot.z - FORMATION_MEASUREMENTS.runningBackDepth,
    });
  });

  it('keeps receivers inside bounds after a sideline dead-ball reset', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    selectPlay(gameplay, 'slant-flat');
    startPlay(gameplay);
    gameplay.player.position.x = PLAYABLE_FIELD_BOUNDS.maxX;
    gameplay.player.position.z = LINE_OF_SCRIMMAGE_Z + 2;

    updateGameplayModel(gameplay, 0);
    updateGameplayModel(gameplay, GAMEPLAY_CONFIG.outOfBoundsResetDelaySeconds);

    expect(gameplay.playState).toBe('preSnap');
    expect(gameplay.currentBallSpot.x).toBeCloseTo(SNAP_LANE_X.rightHash);
    expect(gameplay.formationOrigin.x).toBeCloseTo(SNAP_LANE_X.rightHash);

    for (const receiver of gameplay.players.filter((player) => player.role === 'receiver')) {
      expect(receiver.position.x).toBeLessThanOrEqual(
        PLAYABLE_FIELD_BOUNDS.maxX - receiver.collisionRadius,
      );
      expect(receiver.position.x).toBeGreaterThanOrEqual(
        PLAYABLE_FIELD_BOUNDS.minX + receiver.collisionRadius,
      );
    }
  });

  it('auto-resets after the configured touchdown delay without clearing score', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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
      player: {
        position: { x: 0, z: LINE_OF_SCRIMMAGE_Z - FORMATION_MEASUREMENTS.runningBackDepth },
        velocity: { x: 0, z: 0 },
      },
      playState: 'preSnap',
      score: GAMEPLAY_CONFIG.touchdownPoints,
    });
  });

  it('keeps the defender stationary during preSnap', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });

    updateGameplayModel(gameplay, 1);

    expect(getPrimaryDefender(gameplay.players).currentState).toBe('idle');
    expect(getPrimaryDefender(gameplay.players).velocity).toEqual({ x: 0, z: 0 });
    expect(gameplay.players.every((player) => player.velocity.x === 0 && player.velocity.z === 0)).toBe(true);
    expect(gameplay.playState).toBe('preSnap');
  });

  it('steers the defender toward the carrier without instantly matching direction changes', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const defender = getPrimaryDefender(gameplay.players);
    startPlay(gameplay);
    gameplay.player.position.x = INITIAL_BALL_SPOT.x;
    gameplay.player.position.z = INITIAL_BALL_SPOT.z;
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
  const defender = players.find((player) => player.id === 'defense-rusher-left');

  if (!defender) {
    throw new Error('Missing primary rusher');
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

function selectReceiver(gameplay: ReturnType<typeof createGameplayModel>, receiverId: string): void {
  for (let index = 0; index < 8 && gameplay.selectedReceiverId !== receiverId; index += 1) {
    cycleSelectedReceiver(gameplay);
  }

  if (gameplay.selectedReceiverId !== receiverId) {
    throw new Error(`Unable to select ${receiverId}`);
  }
}

function runSlantFlatPassUntilResolved(
  fps: number,
  throwDelaySeconds: number,
): {
  ballState: string;
  controlledPlayerId: string;
  passAudit: ReturnType<typeof snapshotGameplayModel>['passAudit'];
} {
  const gameplay = createGameplayModel({ playbookId: '5v5' });
  const stepSeconds = 1 / fps;

  selectPlay(gameplay, 'slant-flat');
  startPlay(gameplay);

  for (let elapsed = 0; elapsed < throwDelaySeconds - 0.000001; elapsed += stepSeconds) {
    updateGameplayModel(gameplay, stepSeconds);
  }

  expect(attemptPass(gameplay)).toBe(true);

  for (let step = 0; step < fps * 2; step += 1) {
    if (gameplay.ball.state.kind !== 'inFlight') {
      break;
    }

    updateGameplayModel(gameplay, stepSeconds);
  }

  return {
    ballState: gameplay.ball.state.kind,
    controlledPlayerId: gameplay.player.id,
    passAudit: snapshotGameplayModel(gameplay).passAudit,
  };
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
