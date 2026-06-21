import type { SnapLane } from './ballSpotting';
import { SNAP_LANE_X } from './ballSpotting';
import type { GameplayCameraMode } from './camera/GameplayCameraController';
import type { CinematicsSetting } from './camera/PresentationCameraDirector';
import type { RenderMetricsSnapshot } from './debugOverlay';
import {
  ELEVEN_ON_ELEVEN_BACKFIELD_IDS,
  ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS,
  ELEVEN_ON_ELEVEN_INTERIOR_LINE_IDS,
  ELEVEN_ON_ELEVEN_OFFENSIVE_LINE_IDS,
  getElevenOnElevenPlayerMetadata,
} from './elevenOnElevenFormation';
import { INITIAL_BALL_SPOT, PLAYABLE_FIELD_BOUNDS } from './field';
import type { FootballSpot } from './fieldScale';
import { oppositeSide, resolveFormation, type PreferredFormationSide } from './formationLayout';
import type { GamePresentationRuntimeSnapshot } from './presentation/GamePresentationRuntime';
import type { PresentationHoldSnapshot } from './presentation/PresentationHoldDirector';
import {
  createElevenOnElevenPlayForPreferredSide,
  getAvailablePlays,
  getEligibleReceiverIds,
  getProtectionAssignmentDefenderId,
  type PlayDefinition,
  type PlayId,
} from './playbook';
import type { GameplaySnapshot } from './playState';
import {
  createReceiverRouteAuditSnapshot,
  resolveEligibleReceiverRoutes,
  type ReceiverRouteAuditSnapshot,
} from './receiverRoutes';

export type ElevenAuditAudioMode = 'disabled' | 'enabled';
export type ElevenAuditCrowdMode = 'disabled' | 'low';
export type ElevenAuditFormationSide = 'mirrored' | 'normal';
export type ElevenAuditUpdateRateHz = 30 | 60 | 120;

export interface ElevenOnElevenAuditScenario {
  audio: ElevenAuditAudioMode;
  cameraMode: GameplayCameraMode;
  cinematics: CinematicsSetting;
  crowd: ElevenAuditCrowdMode;
  formationSide: ElevenAuditFormationSide;
  playId: PlayId;
  snapLane: SnapLane;
  updateRateHz: ElevenAuditUpdateRateHz;
}

export interface ElevenAuditAssignmentSnapshot {
  blockerId: string;
  defenderId: string | null;
}

export interface ElevenAuditCameraContainmentSnapshot {
  framedPlayerIds: string[];
  unframedPlayerIds: string[];
}

export interface ElevenAuditFormationLegalitySnapshot {
  backfieldCount: number;
  defenseCount: number;
  eligiblePlayerIds: string[];
  formationIssueCount: number;
  formationIssues: string[];
  lineCount: number;
  offenseCount: number;
}

export interface ElevenAuditResourceCounts {
  activeAudioNodes: number;
  activeCameraShot: string | null;
  activePresentationHold: boolean;
  crowdReaction: string | null;
  drawCalls: number;
  geometries: number;
  helmetInstanceCount: number;
  materialCount: number;
  playerModelCount: number;
  playerVisualCount: number;
  presentationHistoryCount: number;
  textures: number;
  triangles: number;
}

export interface ElevenAuditSnapshot {
  activePlay: string;
  activePresentationEvent: string | null;
  assignments: {
    coverage: ElevenAuditAssignmentSnapshot[];
    protection: ElevenAuditAssignmentSnapshot[];
  };
  cameraContainment: ElevenAuditCameraContainmentSnapshot;
  enabled: boolean;
  formationLegality: ElevenAuditFormationLegalitySnapshot;
  outOfBoundsWarnings: string[];
  playerOverlapWarnings: string[];
  resourceCounts: ElevenAuditResourceCounts;
  rosterCount: number;
  routeErrors: ReceiverRouteAuditSnapshot[];
  snapLane: SnapLane;
  staleReferences: string[];
}

export interface CreateElevenAuditSnapshotOptions {
  activeAudioNodes: number;
  cameraContainment: ElevenAuditCameraContainmentSnapshot;
  crowdReaction: string | null;
  gameplay: GameplaySnapshot;
  helmetInstanceCount: number;
  materialCount: number;
  play: PlayDefinition;
  playerVisualCount: number;
  presentation: GamePresentationRuntimeSnapshot;
  presentationHold: PresentationHoldSnapshot;
  renderMetrics: RenderMetricsSnapshot;
}

const SNAP_LANES: readonly SnapLane[] = ['leftHash', 'middle', 'rightHash'];
const FORMATION_SIDES: readonly ElevenAuditFormationSide[] = ['normal', 'mirrored'];
const CAMERA_MODES: readonly GameplayCameraMode[] = [
  'tacticalOrthographic',
  'offensePerspective',
  'cinematicBroadcast',
];
const CINEMATICS: readonly CinematicsSetting[] = ['off', 'brief'];
const CROWD_MODES: readonly ElevenAuditCrowdMode[] = ['disabled', 'low'];
const AUDIO_MODES: readonly ElevenAuditAudioMode[] = ['disabled', 'enabled'];
const UPDATE_RATES: readonly ElevenAuditUpdateRateHz[] = [30, 60, 120];
const OVERLAP_TOLERANCE_YARDS = 0.05;

export function createElevenOnElevenScenarioMatrix(): ElevenOnElevenAuditScenario[] {
  const plays = getAvailablePlays('11v11');
  const scenarios: ElevenOnElevenAuditScenario[] = [];

  for (const play of plays) {
    for (const snapLane of SNAP_LANES) {
      for (const formationSide of FORMATION_SIDES) {
        for (const updateRateHz of UPDATE_RATES) {
          for (const cameraMode of CAMERA_MODES) {
            for (const cinematics of CINEMATICS) {
              for (const crowd of CROWD_MODES) {
                for (const audio of AUDIO_MODES) {
                  scenarios.push({
                    audio,
                    cameraMode,
                    cinematics,
                    crowd,
                    formationSide,
                    playId: play.id,
                    snapLane,
                    updateRateHz,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return scenarios;
}

export function getElevenAuditSnapSpot(snapLane: SnapLane): FootballSpot {
  return {
    x: SNAP_LANE_X[snapLane],
    z: INITIAL_BALL_SPOT.z,
  };
}

export function getElevenAuditPlayForFormationSide(
  play: PlayDefinition,
  formationSide: ElevenAuditFormationSide,
): PlayDefinition {
  const preferredSide: PreferredFormationSide = formationSide === 'normal'
    ? play.preferredSide
    : oppositeSide(play.preferredSide);

  return createElevenOnElevenPlayForPreferredSide(play, preferredSide);
}

export function createElevenAuditSnapshot({
  activeAudioNodes,
  cameraContainment,
  crowdReaction,
  gameplay,
  helmetInstanceCount,
  materialCount,
  play,
  playerVisualCount,
  presentation,
  presentationHold,
  renderMetrics,
}: CreateElevenAuditSnapshotOptions): ElevenAuditSnapshot {
  const activeIds = new Set(gameplay.players.map((player) => player.id));

  return {
    activePlay: gameplay.selectedPlay.displayName,
    activePresentationEvent: presentation.recentEvents[0]?.type ??
      presentation.history[0]?.emittedEventTypes[0] ??
      null,
    assignments: {
      coverage: Object.entries(play.pass?.coverageAssignments ?? {})
        .map(([blockerId, defenderId]) => ({ blockerId, defenderId })),
      protection: Object.keys(play.protectionAssignments ?? {})
        .map((blockerId) => ({
          blockerId,
          defenderId: getProtectionAssignmentDefenderId(play, blockerId),
        })),
    },
    cameraContainment,
    enabled: true,
    formationLegality: createFormationLegalitySnapshot(gameplay, play),
    outOfBoundsWarnings: findOutOfBoundsWarnings(gameplay),
    playerOverlapWarnings: findPlayerOverlapWarnings(gameplay),
    resourceCounts: {
      activeAudioNodes,
      activeCameraShot: presentation.history[0]?.cameraShot ?? null,
      activePresentationHold: presentationHold.active,
      crowdReaction,
      drawCalls: renderMetrics.calls,
      geometries: renderMetrics.geometries,
      helmetInstanceCount,
      materialCount,
      playerModelCount: gameplay.players.length,
      playerVisualCount,
      presentationHistoryCount: presentation.history.length,
      textures: renderMetrics.textures,
      triangles: renderMetrics.triangles,
    },
    rosterCount: gameplay.players.length,
    routeErrors: createRouteAuditSnapshots(gameplay, play),
    snapLane: gameplay.snapLane,
    staleReferences: findStaleReferenceWarnings(gameplay, activeIds, play),
  };
}

export function createElevenAuditOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'eleven-audit-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncElevenAuditOverlay(
  element: HTMLDivElement,
  snapshot: ElevenAuditSnapshot,
): void {
  const warningCount =
    snapshot.formationLegality.formationIssueCount +
    snapshot.staleReferences.length +
    snapshot.outOfBoundsWarnings.length +
    snapshot.playerOverlapWarnings.length +
    snapshot.routeErrors.filter((route) => route.exceedsTolerance).length +
    snapshot.cameraContainment.unframedPlayerIds.length;
  const rows = [
    createRow('ELEVEN AUDIT'),
    createRow(`PLAY ${snapshot.activePlay}`),
    createRow(`SNAP ${snapshot.snapLane}`),
    createRow(`ROSTER ${snapshot.rosterCount}`),
    createRow(
      `FORM off ${snapshot.formationLegality.offenseCount} def ${snapshot.formationLegality.defenseCount} ` +
        `line ${snapshot.formationLegality.lineCount} back ${snapshot.formationLegality.backfieldCount}`,
      snapshot.formationLegality.formationIssueCount > 0,
    ),
    createRow(`ELIGIBLE ${snapshot.formationLegality.eligiblePlayerIds.join(',')}`),
    createRow(`EVENT ${snapshot.activePresentationEvent ?? 'none'}`),
    createRow(`WARNINGS ${warningCount === 0 ? 'none' : warningCount}`, warningCount > 0),
    createRow(
      `ASSIGN protect ${snapshot.assignments.protection.length} coverage ${snapshot.assignments.coverage.length}`,
    ),
    ...snapshot.assignments.protection.map((assignment) =>
      createRow(`P ${assignment.blockerId}->${assignment.defenderId ?? 'none'}`),
    ),
    ...snapshot.assignments.coverage.map((assignment) =>
      createRow(`C ${assignment.blockerId}->${assignment.defenderId ?? 'none'}`),
    ),
    ...snapshot.routeErrors.map((route) =>
      createRow(
        `ROUTE ${route.receiverId} seg ${route.segmentIndex} ` +
          `${route.distanceAlongRoute.toFixed(1)}/${route.totalLength.toFixed(1)} ` +
          `err ${route.crossTrackErrorYards.toFixed(2)}`,
        route.exceedsTolerance,
      ),
    ),
    ...snapshot.formationLegality.formationIssues.map((warning) => createRow(`! FORM ${warning}`, true)),
    ...snapshot.staleReferences.map((warning) => createRow(`! REF ${warning}`, true)),
    ...snapshot.outOfBoundsWarnings.map((warning) => createRow(`! BOUNDS ${warning}`, true)),
    ...snapshot.playerOverlapWarnings.map((warning) => createRow(`! OVERLAP ${warning}`, true)),
    ...snapshot.cameraContainment.unframedPlayerIds.map((playerId) => createRow(`! CAMERA ${playerId}`, true)),
    createRow(
      `RES calls ${snapshot.resourceCounts.drawCalls} tris ${snapshot.resourceCounts.triangles} ` +
        `geo ${snapshot.resourceCounts.geometries} mat ${snapshot.resourceCounts.materialCount} ` +
        `players ${snapshot.resourceCounts.playerVisualCount}/${snapshot.resourceCounts.playerModelCount} ` +
        `helmets ${snapshot.resourceCounts.helmetInstanceCount} audioNodes ${snapshot.resourceCounts.activeAudioNodes}`,
    ),
  ];

  element.replaceChildren(...rows);
}

function createFormationLegalitySnapshot(
  gameplay: GameplaySnapshot,
  play: PlayDefinition,
): ElevenAuditFormationLegalitySnapshot {
  const snapPlacement = {
    lane: gameplay.snapLane,
    spot: gameplay.drive.lineOfScrimmage,
  };
  const formation = resolveFormation(play, snapPlacement);
  const issues = [...formation.issues];
  const playerIds = new Set(gameplay.players.map((player) => player.id));
  const lineCount = ELEVEN_ON_ELEVEN_OFFENSIVE_LINE_IDS.filter((playerId) => playerIds.has(playerId)).length;
  const backfieldCount = ELEVEN_ON_ELEVEN_BACKFIELD_IDS.filter((playerId) => playerIds.has(playerId)).length;
  const eligiblePlayerIds = [...ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS].filter((playerId) => {
    const metadata = getElevenOnElevenPlayerMetadata(playerId);
    return playerIds.has(playerId) && metadata?.eligible;
  });

  for (const playerId of ELEVEN_ON_ELEVEN_INTERIOR_LINE_IDS) {
    if (getElevenOnElevenPlayerMetadata(playerId)?.eligible) {
      issues.push({
        message: `${playerId} interior line metadata incorrectly eligible`,
        playerIds: [playerId],
      });
    }
  }
  if (lineCount !== 7) {
    issues.push({
      message: `Expected seven offensive players on the line, found ${lineCount}`,
      playerIds: [...ELEVEN_ON_ELEVEN_OFFENSIVE_LINE_IDS],
    });
  }
  if (backfieldCount !== 4) {
    issues.push({
      message: `Expected four offensive players in the backfield, found ${backfieldCount}`,
      playerIds: [...ELEVEN_ON_ELEVEN_BACKFIELD_IDS],
    });
  }
  if (eligiblePlayerIds.length !== ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS.length) {
    issues.push({
      message: `Expected ${ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS.length} eligible receivers, found ${eligiblePlayerIds.length}`,
      playerIds: [...ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS],
    });
  }

  return {
    backfieldCount,
    defenseCount: gameplay.players.filter((player) => player.team === 'defense').length,
    eligiblePlayerIds,
    formationIssueCount: issues.length,
    formationIssues: issues.map((issue) => issue.message),
    lineCount,
    offenseCount: gameplay.players.filter((player) => player.team === 'offense').length,
  };
}

function createRouteAuditSnapshots(
  gameplay: GameplaySnapshot,
  play: PlayDefinition,
): ReceiverRouteAuditSnapshot[] {
  const snapPlacement = {
    lane: gameplay.snapLane,
    spot: gameplay.drive.lineOfScrimmage,
  };
  const routes = resolveEligibleReceiverRoutes(play, snapPlacement);

  return routes.flatMap((route) => {
    const receiver = gameplay.players.find((player) => player.id === route.receiverId);
    if (!receiver) {
      return [];
    }

    const routeState = gameplay.receiverRouteStates.find(
      (state) => state.receiverId === route.receiverId,
    );
    return [createReceiverRouteAuditSnapshot(route, receiver.position, routeState)];
  });
}

function findStaleReferenceWarnings(
  gameplay: GameplaySnapshot,
  activeIds: ReadonlySet<string>,
  play: PlayDefinition,
): string[] {
  const warnings: string[] = [];
  const blockerIds = new Set<string>();
  const defenderIds = new Set<string>();
  const expectedReceiverIds = new Set(getEligibleReceiverIds(play));

  if (gameplay.playState === 'preSnap' && gameplay.blocking.engagements.length > 0) {
    warnings.push('preSnap has active engagements');
  }

  for (const engagement of gameplay.blocking.engagements) {
    const expectedDefenderId = getProtectionAssignmentDefenderId(play, engagement.blockerId);

    if (!activeIds.has(engagement.blockerId)) {
      warnings.push(`missing blocker ${engagement.blockerId}`);
    }
    if (!activeIds.has(engagement.defenderId)) {
      warnings.push(`missing defender ${engagement.defenderId}`);
    }
    if (blockerIds.has(engagement.blockerId)) {
      warnings.push(`duplicate blocker ${engagement.blockerId}`);
    }
    if (defenderIds.has(engagement.defenderId)) {
      warnings.push(`duplicate defender ${engagement.defenderId}`);
    }
    if (expectedDefenderId && expectedDefenderId !== engagement.defenderId) {
      warnings.push(`unassigned engagement ${engagement.blockerId}->${engagement.defenderId}`);
    }

    blockerIds.add(engagement.blockerId);
    defenderIds.add(engagement.defenderId);
  }

  for (const [blockerId, defenderId] of Object.entries(play.protectionAssignments ?? {})) {
    if (!activeIds.has(blockerId)) {
      warnings.push(`assignment missing blocker ${blockerId}`);
    }
    if (!activeIds.has(defenderId)) {
      warnings.push(`assignment missing defender ${defenderId}`);
    }
  }

  for (const [defenderId, receiverId] of Object.entries(play.pass?.coverageAssignments ?? {})) {
    if (!activeIds.has(defenderId)) {
      warnings.push(`coverage missing defender ${defenderId}`);
    }
    if (!activeIds.has(receiverId)) {
      warnings.push(`coverage missing receiver ${receiverId}`);
    }
  }

  for (const routeState of gameplay.receiverRouteStates) {
    if (!activeIds.has(routeState.receiverId)) {
      warnings.push(`route state references missing ${routeState.receiverId}`);
    }
    if (play.kind === 'pass' && !expectedReceiverIds.has(routeState.receiverId)) {
      warnings.push(`route state references ineligible ${routeState.receiverId}`);
    }
    if (gameplay.playState === 'preSnap' && routeState.distanceAlongRoute !== 0) {
      warnings.push(`preSnap route progressed ${routeState.receiverId}`);
    }
  }

  return warnings;
}

function findOutOfBoundsWarnings(gameplay: GameplaySnapshot): string[] {
  return gameplay.players
    .filter((player) => !isPlayerInsidePlayableBounds(player))
    .map((player) => player.id);
}

function findPlayerOverlapWarnings(gameplay: GameplaySnapshot): string[] {
  const warnings: string[] = [];

  for (let outer = 0; outer < gameplay.players.length; outer += 1) {
    for (let inner = outer + 1; inner < gameplay.players.length; inner += 1) {
      const first = gameplay.players[outer];
      const second = gameplay.players[inner];
      const distance = distanceBetween(first.position, second.position);
      const minimumDistance = first.collisionRadius + second.collisionRadius;

      if (distance < minimumDistance - OVERLAP_TOLERANCE_YARDS) {
        warnings.push(`${first.id}/${second.id} ${distance.toFixed(2)}<${minimumDistance.toFixed(2)}`);
      }
    }
  }

  return warnings;
}

function distanceBetween(first: FootballSpot, second: FootballSpot): number {
  return Math.hypot(second.x - first.x, second.z - first.z);
}

function createRow(text: string, invalid = false): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'eleven-audit-row';
  row.classList.toggle('invalid', invalid);
  row.textContent = text;
  return row;
}

export function isPlayerInsidePlayableBounds(player: { collisionRadius: number; position: FootballSpot }): boolean {
  return (
    player.position.x - player.collisionRadius >= PLAYABLE_FIELD_BOUNDS.minX &&
    player.position.x + player.collisionRadius <= PLAYABLE_FIELD_BOUNDS.maxX &&
    player.position.z - player.collisionRadius >= PLAYABLE_FIELD_BOUNDS.minZ &&
    player.position.z + player.collisionRadius <= PLAYABLE_FIELD_BOUNDS.maxZ
  );
}
