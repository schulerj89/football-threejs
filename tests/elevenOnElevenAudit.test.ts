import { describe, expect, it } from 'vitest';
import { resolveSnapPlacement, type SnapLane } from '../src/ballSpotting';
import { applyPlayResultToDrive } from '../src/driveModel';
import {
  ELEVEN_ON_ELEVEN_BACKFIELD_IDS,
  ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS,
  ELEVEN_ON_ELEVEN_OFFENSIVE_LINE_IDS,
  getElevenOnElevenPlayerMetadata,
} from '../src/elevenOnElevenFormation';
import {
  createElevenAuditSnapshot,
  createElevenOnElevenScenarioMatrix,
  getElevenAuditPlayForFormationSide,
  getElevenAuditSnapSpot,
  isPlayerInsidePlayableBounds,
  type ElevenAuditFormationSide,
} from '../src/elevenOnElevenAudit';
import { INITIAL_BALL_SPOT, OPPOSING_GOAL_LINE_Z, PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { resolveFormation } from '../src/formationLayout';
import {
  getAvailablePlays,
  getCoverageAssignmentReceiverId,
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
  type GameplaySnapshot,
  type PlayResult,
} from '../src/playState';
import { updatePlayerSimulation } from '../src/playerSimulation';
import { resolveEligibleReceiverRoutes } from '../src/receiverRoutes';
import type { GamePresentationRuntimeSnapshot } from '../src/presentation/GamePresentationRuntime';
import type { PresentationHoldSnapshot } from '../src/presentation/PresentationHoldDirector';
import type { RenderMetricsSnapshot } from '../src/debugOverlay';

const SNAP_LANES: readonly SnapLane[] = ['leftHash', 'middle', 'rightHash'];
const FORMATION_SIDES: readonly ElevenAuditFormationSide[] = ['normal', 'mirrored'];
const UPDATE_RATES = [30, 60, 120] as const;

describe('eleven-on-eleven hardening matrix', () => {
  it('covers every requested play, formation, presentation, resource, and update-rate dimension', () => {
    const matrix = createElevenOnElevenScenarioMatrix();

    expect(matrix).toHaveLength(4 * 3 * 2 * 3 * 3 * 2 * 2 * 2);
    expect(new Set(matrix.map((scenario) => scenario.playId))).toEqual(
      new Set(['inside-zone-11', 'spread-quick-11', 'outside-zone-11', 'off-tackle-11']),
    );
    expect(new Set(matrix.map((scenario) => scenario.snapLane))).toEqual(new Set(SNAP_LANES));
    expect(new Set(matrix.map((scenario) => scenario.formationSide))).toEqual(new Set(FORMATION_SIDES));
    expect(new Set(matrix.map((scenario) => scenario.updateRateHz))).toEqual(new Set(UPDATE_RATES));
    expect(new Set(matrix.map((scenario) => scenario.cameraMode))).toEqual(
      new Set(['tacticalOrthographic', 'offensePerspective', 'cinematicBroadcast']),
    );
    expect(new Set(matrix.map((scenario) => scenario.cinematics))).toEqual(new Set(['off', 'brief']));
    expect(new Set(matrix.map((scenario) => scenario.crowd))).toEqual(new Set(['disabled', 'low']));
    expect(new Set(matrix.map((scenario) => scenario.audio))).toEqual(new Set(['disabled', 'enabled']));
  });

  it('validates 11v11 formations at every snap lane and mirrored formation side', () => {
    for (const basePlay of getAvailablePlays('11v11')) {
      for (const snapLane of SNAP_LANES) {
        for (const formationSide of FORMATION_SIDES) {
          const play = getElevenAuditPlayForFormationSide(basePlay, formationSide);
          const formation = resolveFormation(play, {
            lane: snapLane,
            spot: getElevenAuditSnapSpot(snapLane),
          });
          const playerIds = new Set(formation.slots.map((slot) => slot.id));

          expect(formation.issues).toEqual([]);
          expect(formation.slots).toHaveLength(22);
          expect(formation.slots.filter((slot) => slot.team === 'offense')).toHaveLength(11);
          expect(formation.slots.filter((slot) => slot.team === 'defense')).toHaveLength(11);
          expect(ELEVEN_ON_ELEVEN_OFFENSIVE_LINE_IDS.filter((id) => playerIds.has(id))).toHaveLength(7);
          expect(ELEVEN_ON_ELEVEN_BACKFIELD_IDS.filter((id) => playerIds.has(id))).toHaveLength(4);
          expect(
            ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS.every((id) => getElevenOnElevenPlayerMetadata(id)?.eligible),
          ).toBe(true);
          expect(formation.slots.every((slot) => isPlayerInsidePlayableBounds({
            collisionRadius: 0.75,
            position: slot.position,
          }))).toBe(true);
        }
      }
    }
  });

  it('keeps default 11v11 pre-snap state stable across repeated updates', () => {
    for (const play of getAvailablePlays('11v11')) {
      const gameplay = createGameplayModel({ playbookId: '11v11' });
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

  it('keeps run-play assignments unique and blocks only assigned defenders', () => {
    for (const play of getAvailablePlays('11v11').filter((candidate) => candidate.kind === 'run')) {
      const gameplay = createGameplayModel({ playbookId: '11v11' });
      selectPlay(gameplay, play.id);

      const assignmentEntries = Object.entries(play.protectionAssignments ?? {});
      expect(new Set(assignmentEntries.map(([blockerId]) => blockerId)).size).toBe(assignmentEntries.length);
      expect(new Set(assignmentEntries.map(([, defenderId]) => defenderId)).size).toBe(assignmentEntries.length);

      startPlay(gameplay);
      updateGameplayModel(gameplay, 1 / 60);

      for (const engagement of gameplay.blocking.engagements) {
        expect(getProtectionAssignmentDefenderId(play, engagement.blockerId)).toBe(engagement.defenderId);
      }

      if (play.id !== 'off-tackle-11') {
        expect(getPlayer(gameplay, 'defense-safety').currentState).toBe('pursuing');
        expect(getPlayer(gameplay, 'defense-safety-strong').currentState).toBe('pursuing');
      }

      resetPlay(gameplay);
      expect(gameplay.blocking.engagements).toEqual([]);
    }
  });

  it('keeps carrier separation deterministic during 11v11 run congestion', () => {
    const first = runInsideZoneCongestionScenario();
    const second = runInsideZoneCongestionScenario();

    expect(first.positions).toEqual(second.positions);
    expect(first.audit.staleReferences).toEqual([]);
    expect(first.overlapFrames).toBeLessThan(90);
    expect(first.carrierZ).toBeGreaterThan(INITIAL_BALL_SPOT.z - 9);
  });

  it('validates Spread Quick pass protection, coverage, routes, and update-rate consistency', () => {
    const play = getPlay('spread-quick-11');
    const protectionDefenders = Object.keys(play.protectionAssignments ?? {})
      .map((blockerId) => getProtectionAssignmentDefenderId(play, blockerId));

    expect(protectionDefenders).toHaveLength(5);
    expect(new Set(protectionDefenders).size).toBe(5);
    expect(getCoverageAssignmentReceiverId(play, 'defense-corner-left')).toBe('offense-wr-left');
    expect(getCoverageAssignmentReceiverId(play, 'defense-corner-right')).toBe('offense-wr-right');
    expect(getCoverageAssignmentReceiverId(play, 'defense-linebacker')).toBe('offense-rb');
    expect(getCoverageAssignmentReceiverId(play, 'defense-linebacker-inside')).toBe('offense-tight-end');
    expect(getCoverageAssignmentReceiverId(play, 'defense-safety-strong')).toBe('offense-slot');

    for (const snapLane of SNAP_LANES) {
      const routes = resolveEligibleReceiverRoutes(play, {
        lane: snapLane,
        spot: getElevenAuditSnapSpot(snapLane),
      });
      expect(routes.map((route) => route.receiverId)).toEqual(getEligibleReceiverIds(play));
      for (const route of routes) {
        expect(route.points).toHaveLength((play.receiverRoutes?.[route.receiverId]?.waypoints.length ?? 0) + 1);
        expect(route.segmentLengths.every((length) => length > 0)).toBe(true);
        expect(route.points.every((point) => point.x >= PLAYABLE_FIELD_BOUNDS.minX && point.x <= PLAYABLE_FIELD_BOUNDS.maxX)).toBe(true);
      }
    }

    const outcomes = UPDATE_RATES.map((updateRate) =>
      runPassingScenario(updateRate, 'offense-slot'),
    );
    expect(new Set(outcomes.map((outcome) => outcome.resultType)).size).toBe(1);
    expect(new Set(outcomes.map((outcome) => outcome.possessionPlayerId ?? 'none')).size).toBe(1);
  });

  it('transfers control exactly once after a completion and sends defenders to pursuit', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    selectPlay(gameplay, 'spread-quick-11');
    selectReceiver(gameplay, 'offense-slot');
    startPlay(gameplay);
    expect(attemptPass(gameplay)).toBe(true);
    updateGameplayModel(gameplay, 0.2);
    const receiver = getPlayer(gameplay, 'offense-slot');
    receiver.position.x = gameplay.ball.position.x;
    receiver.position.z = gameplay.ball.position.z;

    updateGameplayModel(gameplay, 0);
    const firstCarrierId = gameplay.player.id;
    updateGameplayModel(gameplay, 1 / 60);

    expect(firstCarrierId).toBe('offense-slot');
    expect(gameplay.player.id).toBe(firstCarrierId);
    expect(gameplay.ball.possession).toEqual({ kind: 'player', playerId: firstCarrierId });
    expect(gameplay.players.filter((player) => player.currentState === 'userControlled')).toHaveLength(1);
    expect(
      gameplay.players
        .filter((player) => player.team === 'defense')
        .every((player) => player.currentState === 'pursuing' || player.currentState === 'engaged'),
    ).toBe(true);
  });

  it('validates all 11v11 result paths apply once and reset cleanly', () => {
    expect(forceTackleResult()).toMatchObject({ type: 'tackle' });
    expect(forceSackResult()).toMatchObject({ type: 'sack' });
    expect(forceIncompleteResult()).toMatchObject({ type: 'incomplete' });
    expect(forceCompletionResult()).toBe('offense-slot');
    expect(forceOutOfBoundsResult()).toMatchObject({ type: 'outOfBounds' });
    expect(forceFirstDownResult()).toMatchObject({ type: 'tackle' });
    expect(forceTouchdownResult()).toMatchObject({ type: 'touchdown' });
    expect(forceTurnoverResult()).toMatchObject({ type: 'tackle' });
  });

  it('returns 11v11 resources to stable counts over repeated reset cycles and compares roster baselines', () => {
    const eleven = createGameplayModel({ playbookId: '11v11' });
    const seven = createGameplayModel({ playbookId: '7v7' });
    const before = createAudit(snapshotGameplayModel(eleven), eleven.selectedPlay);

    for (let cycle = 0; cycle < 100; cycle += 1) {
      startPlay(eleven);
      resetPlay(eleven);
      const snapshot = snapshotGameplayModel(eleven);
      const audit = createAudit(snapshot, eleven.selectedPlay);
      expect(snapshot.players).toHaveLength(22);
      expect(snapshot.blocking.engagements).toEqual([]);
      expect(audit.resourceCounts.playerModelCount).toBe(22);
      expect(audit.resourceCounts.playerVisualCount).toBe(22);
      expect(audit.resourceCounts.helmetInstanceCount).toBe(22);
      expect(audit.resourceCounts.activePresentationHold).toBe(false);
      expect(audit.staleReferences).toEqual([]);
    }

    const after = createAudit(snapshotGameplayModel(eleven), eleven.selectedPlay);
    const sevenAudit = createAudit(snapshotGameplayModel(seven), seven.selectedPlay, {
      helmetInstanceCount: 14,
      playerVisualCount: 14,
    });

    expect(sevenAudit.resourceCounts.playerModelCount).toBe(14);
    expect(after.resourceCounts.playerModelCount).toBe(22);
    expect(after.resourceCounts.playerVisualCount).toBe(before.resourceCounts.playerVisualCount);
    expect(after.resourceCounts.helmetInstanceCount).toBe(before.resourceCounts.helmetInstanceCount);
    expect(after.resourceCounts.geometries).toBe(before.resourceCounts.geometries);
    expect(after.resourceCounts.materialCount).toBe(before.resourceCounts.materialCount);
    expect(after.resourceCounts.activeAudioNodes).toBe(before.resourceCounts.activeAudioNodes);
  });
});

function runInsideZoneCongestionScenario() {
  const gameplay = createGameplayModel({ playbookId: '11v11' });
  selectPlay(gameplay, 'inside-zone-11');
  startPlay(gameplay);
  let overlapFrames = 0;

  for (let frame = 0; frame < 90 && gameplay.playState === 'live'; frame += 1) {
    updatePlayerSimulation(gameplay.player, { x: 0, z: 1 }, 1 / 60, PLAYABLE_FIELD_BOUNDS, {
      clampSidelines: false,
    });
    updateGameplayModel(gameplay, 1 / 60);
    if (createAudit(snapshotGameplayModel(gameplay), gameplay.selectedPlay).playerOverlapWarnings.length > 0) {
      overlapFrames += 1;
    }
  }

  const snapshot = snapshotGameplayModel(gameplay);
  return {
    audit: createAudit(snapshot, gameplay.selectedPlay),
    carrierZ: gameplay.player.position.z,
    overlapFrames,
    positions: snapshot.players.map((player) => [
      player.id,
      Number(player.position.x.toFixed(4)),
      Number(player.position.z.toFixed(4)),
    ]),
  };
}

function runPassingScenario(updateRateHz: 30 | 60 | 120, receiverId: string) {
  const gameplay = createGameplayModel({ playbookId: '11v11' });
  selectPlay(gameplay, 'spread-quick-11');
  selectReceiver(gameplay, receiverId);
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
  const gameplay = createGameplayModel({ playbookId: '11v11' });
  startPlay(gameplay);
  getPlayer(gameplay, 'defense-safety').position = { ...gameplay.player.position };
  updateGameplayModel(gameplay, 0);
  return assertSingleResultAndReset(gameplay);
}

function forceSackResult(): PlayResult {
  const gameplay = createGameplayModel({ playbookId: '11v11' });
  selectPlay(gameplay, 'spread-quick-11');
  startPlay(gameplay);
  getPlayer(gameplay, 'defense-line-middle').position = { ...gameplay.player.position };
  updateGameplayModel(gameplay, 0);
  return assertSingleResultAndReset(gameplay);
}

function forceIncompleteResult(): PlayResult {
  const gameplay = createGameplayModel({ playbookId: '11v11' });
  selectPlay(gameplay, 'spread-quick-11');
  startPlay(gameplay);
  attemptPass(gameplay);
  if (gameplay.ball.state.kind === 'inFlight') {
    gameplay.ball.state.target.x = PLAYABLE_FIELD_BOUNDS.maxX + 5;
    gameplay.ball.state.durationSeconds = 0.45;
  }
  updateGameplayModel(gameplay, 0.45);
  return assertSingleResultAndReset(gameplay);
}

function forceCompletionResult(): string {
  const gameplay = createGameplayModel({ playbookId: '11v11' });
  selectPlay(gameplay, 'spread-quick-11');
  selectReceiver(gameplay, 'offense-slot');
  startPlay(gameplay);
  attemptPass(gameplay);
  updateGameplayModel(gameplay, 0.2);
  const receiver = getPlayer(gameplay, 'offense-slot');
  receiver.position.x = gameplay.ball.position.x;
  receiver.position.z = gameplay.ball.position.z;
  updateGameplayModel(gameplay, 0);
  return gameplay.player.id;
}

function forceOutOfBoundsResult(): PlayResult {
  const gameplay = createGameplayModel({ playbookId: '11v11' });
  startPlay(gameplay);
  gameplay.player.position.x = PLAYABLE_FIELD_BOUNDS.maxX + gameplay.player.collisionRadius + 0.1;
  updateGameplayModel(gameplay, 0);
  return assertSingleResultAndReset(gameplay);
}

function forceFirstDownResult(): PlayResult {
  const gameplay = createGameplayModel({ playbookId: '11v11' });
  startPlay(gameplay);
  gameplay.player.position.z = gameplay.drive.firstDownMarker.z + 0.5;
  getPlayer(gameplay, 'defense-safety').position = { ...gameplay.player.position };
  updateGameplayModel(gameplay, 0);
  const result = assertSingleResultAndReset(gameplay);
  expect(gameplay.drive.currentDown).toBe(1);
  return result;
}

function forceTouchdownResult(): PlayResult {
  const gameplay = createGameplayModel({ playbookId: '11v11' });
  startPlay(gameplay);
  gameplay.player.position.z = OPPOSING_GOAL_LINE_Z;
  updateGameplayModel(gameplay, 0);
  return assertSingleResultAndReset(gameplay);
}

function forceTurnoverResult(): PlayResult {
  const gameplay = createGameplayModel({ playbookId: '11v11' });
  const appliedResultIds = new Set<number>();

  for (let down = 1; down <= 4; down += 1) {
    startPlay(gameplay);
    getPlayer(gameplay, 'defense-safety').position = { ...gameplay.player.position };
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
    snapLane: gameplay.drive.snapLane,
    state: gameplay.drive.state,
  };
  applyPlayResultToDrive(gameplay.drive, result!);
  expect(gameplay.drive.currentDown).toBe(driveBeforeRepeat.currentDown);
  expect(gameplay.drive.lineOfScrimmage).toEqual(driveBeforeRepeat.lineOfScrimmage);
  expect(gameplay.drive.snapLane).toBe(driveBeforeRepeat.snapLane);
  expect(gameplay.drive.state).toBe(driveBeforeRepeat.state);

  if (!options.expectDead) {
    expect(gameplay.playState).toBe('dead');
  }

  updateGameplayModel(gameplay, 10);
  const snapshot = snapshotGameplayModel(gameplay);
  if (snapshot.playState === 'preSnap') {
    expect(snapshot.players).toHaveLength(22);
    expect(snapshot.blocking.engagements).toEqual([]);
    expect(snapshot.receiverRouteStates.every((state) => state.distanceAlongRoute === 0)).toBe(true);
    expect(snapshot.players.every((player) => isPlayerInsidePlayableBounds(player))).toBe(true);
    expect(snapshot.snapLane).toBe(resolveSnapPlacement(snapshot.drive.lineOfScrimmage).lane);
  }

  return result!;
}

function selectReceiver(gameplay: GameplayModel, receiverId: string): void {
  for (let cycle = 0; cycle < 8 && gameplay.selectedReceiverId !== receiverId; cycle += 1) {
    const changed = gameplay.selectedPlay.kind === 'pass'
      ? gameplay.selectedReceiverId !== receiverId
      : false;
    if (!changed) {
      break;
    }
    const cycled = gameplay.selectedReceiverId === receiverId ? false : true;
    if (cycled) {
      // Importing the public cycle helper here would obscure the selected target
      // in failures; direct assignment keeps this forced-result helper explicit.
      const receiverIds = getEligibleReceiverIds(gameplay.selectedPlay);
      const index = receiverIds.indexOf(gameplay.selectedReceiverId ?? receiverIds[0]);
      gameplay.selectedReceiverId = receiverIds[(index + 1) % receiverIds.length] ?? null;
    }
  }
  expect(gameplay.selectedReceiverId).toBe(receiverId);
}

function getPlayer(gameplay: GameplayModel, playerId: string) {
  const player = gameplay.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Missing player ${playerId}`);
  }

  return player;
}

function createAudit(
  snapshot: GameplaySnapshot,
  play = getPlay(snapshot.selectedPlay.id),
  overrides: Partial<{
    helmetInstanceCount: number;
    playerVisualCount: number;
  }> = {},
) {
  return createElevenAuditSnapshot({
    activeAudioNodes: 0,
    cameraContainment: {
      framedPlayerIds: snapshot.players.map((player) => player.id),
      unframedPlayerIds: [],
    },
    crowdReaction: null,
    gameplay: snapshot,
    helmetInstanceCount: overrides.helmetInstanceCount ?? snapshot.players.length,
    materialCount: 12,
    play,
    playerVisualCount: overrides.playerVisualCount ?? snapshot.players.length,
    presentation: createPresentationSnapshot(),
    presentationHold: createPresentationHoldSnapshot(),
    renderMetrics: createRenderMetrics(snapshot),
  });
}

function createPresentationSnapshot(): GamePresentationRuntimeSnapshot {
  return {
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
  };
}

function createPresentationHoldSnapshot(): PresentationHoldSnapshot {
  return {
    active: false,
    duplicateSuppressionCount: 0,
    history: [],
    reason: null,
    remainingSeconds: 0,
    skippedCount: 0,
    touchdown: null,
  };
}

function createRenderMetrics(snapshot: GameplaySnapshot): RenderMetricsSnapshot {
  return {
    calls: 10,
    crowdInstanceCount: 0,
    frameTimeMs: 16.7,
    footballMeshCount: 0,
    geometries: 20,
    officialMeshCount: 0,
    playerBodyMeshCount: snapshot.players.length,
    playerCount: snapshot.players.length,
    sceneMaterialCount: 12,
    sceneMeshCount: snapshot.players.length,
    shadowCastingObjectCount: 0,
    sidelineMeshCount: 0,
    stadiumDrawCallEstimate: 0,
    stadiumMeshCount: 0,
    textures: 0,
    triangles: 1000,
    visibleMeshCount: snapshot.players.length,
  };
}
