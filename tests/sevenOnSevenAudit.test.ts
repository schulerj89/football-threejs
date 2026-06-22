import { describe, expect, it } from 'vitest';
import { SNAP_LANE_X, resolveSnapPlacement, type SnapLane } from '../src/ballSpotting';
import { applyPlayResultToDrive } from '../src/driveModel';
import { INITIAL_BALL_SPOT, OPPOSING_GOAL_LINE_Z, PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { resolveFormation } from '../src/formationLayout';
import {
  getAvailablePlays,
  getEligibleReceiverIds,
  getPlay,
  getProtectionAssignmentDefenderId,
} from '../src/playbook';
import {
  attemptPass,
  createGameplayModel,
  resetPlay,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
  updateGameplayModel,
  type GameplayModel,
  type PlayResult,
} from '../src/playState';
import { PLAYER_MOVEMENT_CONFIG } from '../src/playerModel';
import { resolveEligibleReceiverRoutes } from '../src/receiverRoutes';
import {
  createSevenAuditSnapshot,
  createSevenOnSevenScenarioMatrix,
  getSevenAuditSnapSpot,
  isPlayerInsidePlayableBounds,
} from '../src/sevenOnSevenAudit';

const SNAP_LANES: readonly SnapLane[] = ['leftHash', 'middle', 'rightHash'];
const UPDATE_RATES = [30, 60, 120] as const;

function createSevenGameplay(): GameplayModel {
  return createGameplayModel({ playbookId: '7v7' });
}

describe('seven-on-seven hardening matrix', () => {
  it('covers every requested gameplay, camera, presentation, crowd, and update-rate dimension', () => {
    const matrix = createSevenOnSevenScenarioMatrix();

    expect(matrix).toHaveLength(4 * 3 * 3 * 2 * 2 * 3);
    expect(new Set(matrix.map((scenario) => scenario.playId))).toEqual(
      new Set(['inside-zone-7', 'outside-zone-7', 'quick-pass-7', 'twin-slants-flat']),
    );
    expect(new Set(matrix.map((scenario) => scenario.snapLane))).toEqual(new Set(SNAP_LANES));
    expect(new Set(matrix.map((scenario) => scenario.cameraMode))).toEqual(
      new Set(['tacticalOrthographic', 'offensePerspective', 'cinematicBroadcast']),
    );
    expect(new Set(matrix.map((scenario) => scenario.cinematics))).toEqual(new Set(['off', 'brief']));
    expect(new Set(matrix.map((scenario) => scenario.crowd))).toEqual(new Set(['disabled', 'low']));
    expect(new Set(matrix.map((scenario) => scenario.updateRateHz))).toEqual(new Set(UPDATE_RATES));
  });

  it('resolves all four 7v7 plays with fourteen valid players at every snap lane', () => {
    for (const play of getAvailablePlays('7v7')) {
      for (const snapLane of SNAP_LANES) {
        const snapSpot = getSevenAuditSnapSpot(snapLane);
        const formation = resolveFormation(play, {
          lane: snapLane,
          spot: snapSpot,
        });

        expect(formation.issues).toEqual([]);
        expect(formation.slots).toHaveLength(14);
        expect(formation.slots.filter((slot) => slot.team === 'offense')).toHaveLength(7);
        expect(formation.slots.filter((slot) => slot.team === 'defense')).toHaveLength(7);
        expect(new Set(formation.slots.map((slot) => slot.id)).size).toBe(14);
      }
    }
  });

  it('keeps pre-snap state stable across repeated updates', () => {
    for (const play of getAvailablePlays('7v7')) {
      const gameplay = createSevenGameplay();
      selectPlay(gameplay, play.id);
      const before = snapshotGameplayModel(gameplay);

      for (let frame = 0; frame < 300; frame += 1) {
        updateGameplayModel(gameplay, 1 / 60);
      }

      const after = snapshotGameplayModel(gameplay);
      expect(after.players.map((player) => [player.id, player.position, player.facingRadians])).toEqual(
        before.players.map((player) => [player.id, player.position, player.facingRadians]),
      );
      expect(after.snapLane).toBe(before.snapLane);
      expect(after.blocking.engagements).toEqual([]);
      expect(after.receiverRouteStates.every((state) => state.distanceAlongRoute === 0)).toBe(true);
      expect(after.receiverRouteStates.every((state) => state.segmentIndex === 0)).toBe(true);
    }
  });

  it('validates run-play possession, deterministic blocking, unblocked pursuit, and field-side mirroring', () => {
    for (const playId of ['inside-zone-7', 'outside-zone-7'] as const) {
      const play = getPlay(playId);
      const gameplay = createSevenGameplay();
      selectPlay(gameplay, playId);

      expect(startPlay(gameplay)).toBe(true);
      expect(gameplay.player.id).toBe('offense-rb');
      expect(gameplay.ball.possession).toEqual({ kind: 'player', playerId: 'offense-rb' });
      expect(play.initialMovementDirection).toEqual({ x: 0, z: 1 });

      const assignmentEntries = Object.entries(play.protectionAssignments ?? {});
      expect(new Set(assignmentEntries.map(([blockerId]) => blockerId)).size).toBe(assignmentEntries.length);
      expect(new Set(assignmentEntries.map(([, defenderId]) => defenderId)).size).toBe(assignmentEntries.length);
      expect(assignmentEntries.some(([, defenderId]) => defenderId === 'defense-linebacker')).toBe(false);
      expect(assignmentEntries.some(([, defenderId]) => defenderId === 'defense-safety')).toBe(false);

      updateGameplayModel(gameplay, 1 / 60);
      expect(gameplay.players.find((player) => player.id === 'defense-linebacker')?.currentState).toBe('pursuing');
      expect(gameplay.players.find((player) => player.id === 'defense-safety')?.currentState).toBe('pursuing');

      for (let frame = 0; frame < 120 && gameplay.playState === 'live'; frame += 1) {
        updateGameplayModel(gameplay, 1 / 60);
        const blockers = gameplay.blocking.engagements.map((engagement) => engagement.blockerId);
        const defenders = gameplay.blocking.engagements.map((engagement) => engagement.defenderId);
        expect(new Set(blockers).size).toBe(blockers.length);
        expect(new Set(defenders).size).toBe(defenders.length);
      }
    }

    const outside = getPlay('outside-zone-7');
    const leftFormation = resolveFormation(outside, {
      lane: 'leftHash',
      spot: getSevenAuditSnapSpot('leftHash'),
    });
    const rightFormation = resolveFormation(outside, {
      lane: 'rightHash',
      spot: getSevenAuditSnapSpot('rightHash'),
    });
    const leftRb = leftFormation.slots.find((slot) => slot.id === 'offense-rb')!;
    const rightRb = rightFormation.slots.find((slot) => slot.id === 'offense-rb')!;
    expect(leftFormation.fieldSide).toBe('right');
    expect(rightFormation.fieldSide).toBe('left');
    expect(leftRb.lateralDistanceFromSnap).toBeCloseTo(-rightRb.lateralDistanceFromSnap);
  });

  it('validates passing assignments, ordered routes, and route start timing', () => {
    for (const playId of ['quick-pass-7', 'twin-slants-flat'] as const) {
      const play = getPlay(playId);
      const gameplay = createSevenGameplay();
      selectPlay(gameplay, playId);
      const beforeSnap = snapshotGameplayModel(gameplay);
      const eligibleReceivers = getEligibleReceiverIds(play);

      expect(eligibleReceivers).toEqual(['offense-wr-left', 'offense-wr-right', 'offense-rb']);
      expect(gameplay.player.id).toBe('offense-qb');
      expect(gameplay.ball.possession.kind).toBe('none');
      expect(beforeSnap.receiverRouteStates.every((state) => state.distanceAlongRoute === 0)).toBe(true);

      const routes = resolveEligibleReceiverRoutes(play, {
        lane: gameplay.drive.snapLane,
        spot: gameplay.drive.lineOfScrimmage,
      });
      expect(routes).toHaveLength(3);
      for (const route of routes) {
        const receiver = beforeSnap.players.find((player) => player.id === route.receiverId)!;
        expect(route.points[0]).toEqual(receiver.position);
        expect(route.segmentLengths.length).toBe(route.points.length - 1);
        expect(route.segmentLengths.every((length) => length > 0)).toBe(true);
      }

      const protectionDefenders = Object.keys(play.protectionAssignments ?? {})
        .map((blockerId) => getProtectionAssignmentDefenderId(play, blockerId));
      expect(protectionDefenders).toEqual([
        'defense-line-middle',
        'defense-line-left',
        'defense-line-right',
      ]);
      expect(new Set(protectionDefenders).size).toBe(3);

      expect(Object.keys(play.pass?.coverageAssignments ?? {})).toEqual([
        'defense-corner-left',
        'defense-corner-right',
        'defense-linebacker',
      ]);
      expect(Object.values(play.pass?.coverageAssignments ?? {})).toEqual(eligibleReceivers);

      startPlay(gameplay);
      expect(gameplay.ball.possession).toEqual({ kind: 'player', playerId: 'offense-qb' });
      updateGameplayModel(gameplay, 1 / 60);
      expect(Object.values(gameplay.receiverRouteStates).some((state) => state.distanceAlongRoute > 0)).toBe(true);
    }
  });

  it('keeps route-following and pass outcomes consistent across common update rates', () => {
    const outcomes = UPDATE_RATES.map((updateRate) => runPassingScenario(updateRate, 'quick-pass-7'));

    expect(new Set(outcomes.map((outcome) => outcome.resultType)).size).toBe(1);
    expect(new Set(outcomes.map((outcome) => outcome.possessionPlayerId ?? 'none')).size).toBe(1);
  });

  it('detects clean reset state after repeated seven-on-seven snap/reset cycles', () => {
    const gameplay = createSevenGameplay();
    selectPlay(gameplay, 'twin-slants-flat');

    for (let cycle = 0; cycle < 100; cycle += 1) {
      expect(startPlay(gameplay)).toBe(true);
      updateGameplayModel(gameplay, 1 / 60);
      resetPlay(gameplay);
      const snapshot = snapshotGameplayModel(gameplay);
      const audit = createAudit(snapshot, gameplay.selectedPlay);

      expect(snapshot.players).toHaveLength(14);
      expect(snapshot.blocking.engagements).toEqual([]);
      expect(snapshot.receiverRouteStates.every((state) => state.distanceAlongRoute === 0)).toBe(true);
      expect(snapshot.receiverRouteStates.every((state) => state.segmentIndex === 0)).toBe(true);
      expect(audit.staleEngagements).toEqual([]);
      expect(audit.playerOverlapWarnings).toEqual([]);
      expect(audit.resourceCounts.playerVisualCount).toBe(14);
    }
  });

  it('validates all seven-on-seven result paths advance once and reset cleanly', () => {
    expect(forceTackleResult()).toMatchObject({ type: 'tackle' });
    expect(forceSackResult()).toMatchObject({ type: 'sack' });
    expect(forceIncompleteResult()).toMatchObject({ type: 'incomplete' });
    expect(forceOutOfBoundsResult()).toMatchObject({ type: 'outOfBounds' });
    expect(forceFirstDownResult()).toMatchObject({ type: 'tackle' });
    expect(forceTouchdownResult()).toMatchObject({ type: 'touchdown' });
    expect(forceTurnoverResult()).toMatchObject({ type: 'tackle' });
  });
});

function runPassingScenario(updateRateHz: 30 | 60 | 120, playId: 'quick-pass-7' | 'twin-slants-flat') {
  const gameplay = createSevenGameplay();
  selectPlay(gameplay, playId);
  startPlay(gameplay);

  for (let frame = 0; frame < Math.round(updateRateHz * 0.35); frame += 1) {
    updateGameplayModel(gameplay, 1 / updateRateHz);
  }

  attemptPass(gameplay);

  for (let frame = 0; frame < updateRateHz * 3 && gameplay.playState === 'live'; frame += 1) {
    updateGameplayModel(gameplay, 1 / updateRateHz);
  }

  return {
    possessionPlayerId:
      gameplay.ball.possession.kind === 'player' ? gameplay.ball.possession.playerId : null,
    resultType: gameplay.lastPlayResult?.type ?? gameplay.ball.state.kind,
  };
}

function forceTackleResult(): PlayResult {
  const gameplay = createSevenGameplay();
  startPlay(gameplay);
  const defender = gameplay.players.find((player) => player.team === 'defense')!;
  defender.position.x = gameplay.player.position.x;
  defender.position.z = gameplay.player.position.z;
  updateGameplayModel(gameplay, 0);
  return assertSingleResultAndReset(gameplay);
}

function forceSackResult(): PlayResult {
  const gameplay = createSevenGameplay();
  selectPlay(gameplay, 'quick-pass-7');
  startPlay(gameplay);
  const rusher = gameplay.players.find((player) => player.id === 'defense-line-middle')!;
  rusher.position.x = gameplay.player.position.x;
  rusher.position.z = gameplay.player.position.z;
  updateGameplayModel(gameplay, 0);
  return assertSingleResultAndReset(gameplay);
}

function forceIncompleteResult(): PlayResult {
  const gameplay = createSevenGameplay();
  selectPlay(gameplay, 'quick-pass-7');
  startPlay(gameplay);
  attemptPass(gameplay);
  if (gameplay.ball.state.kind === 'inFlight') {
    gameplay.ball.state.target.x = PLAYABLE_FIELD_BOUNDS.maxX + 5;
    gameplay.ball.state.durationSeconds = 0.45;
  }
  updateGameplayModel(gameplay, 0.45);
  return assertSingleResultAndReset(gameplay);
}

function forceOutOfBoundsResult(): PlayResult {
  const gameplay = createSevenGameplay();
  startPlay(gameplay);
  gameplay.player.position.x = PLAYABLE_FIELD_BOUNDS.maxX + gameplay.player.collisionRadius + 0.1;
  updateGameplayModel(gameplay, 0);
  return assertSingleResultAndReset(gameplay);
}

function forceFirstDownResult(): PlayResult {
  const gameplay = createSevenGameplay();
  startPlay(gameplay);
  gameplay.player.position.z = gameplay.drive.firstDownMarker.z + 0.5;
  const defender = gameplay.players.find((player) => player.team === 'defense')!;
  defender.position.x = gameplay.player.position.x;
  defender.position.z = gameplay.player.position.z;
  updateGameplayModel(gameplay, 0);
  const result = assertSingleResultAndReset(gameplay);
  expect(gameplay.drive.currentDown).toBe(1);
  expect(gameplay.drive.lineOfScrimmage.z).toBeGreaterThan(INITIAL_BALL_SPOT.z);
  return result;
}

function forceTouchdownResult(): PlayResult {
  const gameplay = createSevenGameplay();
  startPlay(gameplay);
  gameplay.player.position.z = OPPOSING_GOAL_LINE_Z - PLAYER_MOVEMENT_CONFIG.collisionRadius * 0.5;
  updateGameplayModel(gameplay, 0);
  return assertSingleResultAndReset(gameplay);
}

function forceTurnoverResult(): PlayResult {
  const gameplay = createSevenGameplay();
  const appliedResultIds = new Set<number>();

  for (let down = 1; down <= 4; down += 1) {
    startPlay(gameplay);
    const defender = gameplay.players.find((player) => player.team === 'defense')!;
    defender.position.x = gameplay.player.position.x;
    defender.position.z = gameplay.player.position.z;
    updateGameplayModel(gameplay, 0);
    expect(gameplay.lastPlayResult).not.toBeNull();
    expect(appliedResultIds.has(gameplay.lastPlayResult!.id)).toBe(false);
    appliedResultIds.add(gameplay.lastPlayResult!.id);
    if (down < 4) {
      updateGameplayModel(gameplay, 10);
      expect(gameplay.playState).toBe('preSnap');
    }
  }

  expect(gameplay.drive.state).toBe('over');
  expect(gameplay.drive.lastDriveResult?.type).toBe('turnoverOnDowns');
  return assertSingleResultAndReset(gameplay, { expectDead: true });
}

function assertSingleResultAndReset(
  gameplay: GameplayModel,
  options: { expectDead?: boolean } = {},
): PlayResult {
  const result = gameplay.lastPlayResult;
  expect(result).not.toBeNull();
  expect(gameplay.drive.lastAppliedPlayResultId).toBe(result!.id);
  const driveBeforeRepeat = {
    currentDown: gameplay.drive.currentDown,
    lineOfScrimmage: { ...gameplay.drive.lineOfScrimmage },
    state: gameplay.drive.state,
  };
  applyPlayResultToDrive(gameplay.drive, result!);
  expect(gameplay.drive.currentDown).toBe(driveBeforeRepeat.currentDown);
  expect(gameplay.drive.lineOfScrimmage).toEqual(driveBeforeRepeat.lineOfScrimmage);
  expect(gameplay.drive.state).toBe(driveBeforeRepeat.state);

  if (!options.expectDead) {
    expect(gameplay.playState).toBe('dead');
  }

  updateGameplayModel(gameplay, 10);
  const snapshot = snapshotGameplayModel(gameplay);
  if (snapshot.playState === 'preSnap') {
    expect(snapshot.players).toHaveLength(14);
    expect(snapshot.blocking.engagements).toEqual([]);
    expect(snapshot.receiverRouteStates.every((state) => state.distanceAlongRoute === 0)).toBe(true);
    expect(snapshot.players.every((player) => isPlayerInsidePlayableBounds(player))).toBe(true);
    expect(snapshot.snapLane).toBe(resolveSnapPlacement(snapshot.drive.lineOfScrimmage).lane);
  }

  return result!;
}

function createAudit(snapshot: ReturnType<typeof snapshotGameplayModel>, play = getPlay(snapshot.selectedPlay.id)) {
  return createSevenAuditSnapshot({
    activeAudioNodes: 0,
    gameplay: snapshot,
    materialCount: 0,
    play,
    playerVisualCount: snapshot.players.length,
    presentation: {
      eventPrecedence: {
        ballSnapped: 0,
        challengeEnding: 0,
        firstDown: 30,
        incomplete: 20,
        outOfBounds: 20,
        passCaught: 0,
        playPrepared: 0,
        playReset: 0,
        playStarted: 0,
        sack: 40,
        tackle: 10,
        touchdown: 60,
        turnoverOnDowns: 50,
      },
      history: [],
      recentEvents: [],
    },
    renderMetrics: {
      calls: 0,
      crowdInstanceCount: 0,
      frameTimeMs: 0,
      footballMeshCount: 0,
      geometries: 0,
      officialMeshCount: 0,
      playerBodyMeshCount: snapshot.players.length,
      playerCount: snapshot.players.length,
      sceneMaterialCount: 0,
      sceneMeshCount: 0,
      shadowCastingObjectCount: 0,
      sidelineMeshCount: 0,
      stadiumDrawCallEstimate: 0,
      stadiumMeshCount: 0,
      textures: 0,
      triangles: 0,
      visibleMeshCount: 0,
    },
  });
}
