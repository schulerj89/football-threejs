import { SNAP_LANE_X, type SnapLane } from './ballSpotting';
import type { GameplayCameraMode } from './camera/GameplayCameraController';
import type { CinematicsSetting } from './camera/PresentationCameraDirector';
import type { RenderMetricsSnapshot } from './debugOverlay';
import { INITIAL_BALL_SPOT, PLAYABLE_FIELD_BOUNDS } from './field';
import type { FootballSpot } from './fieldScale';
import {
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
import type { GamePresentationRuntimeSnapshot } from './presentation/GamePresentationRuntime';

export type SevenAuditCrowdMode = 'disabled' | 'low';
export type SevenAuditUpdateRateHz = 30 | 60 | 120;

export interface SevenOnSevenAuditScenario {
  cameraMode: GameplayCameraMode;
  cinematics: CinematicsSetting;
  crowd: SevenAuditCrowdMode;
  playId: PlayId;
  snapLane: SnapLane;
  updateRateHz: SevenAuditUpdateRateHz;
}

export interface SevenAuditAssignmentSnapshot {
  blockerId: string;
  defenderId: string | null;
}

export interface SevenAuditResourceCounts {
  activeAudioNodes: number;
  drawCalls: number;
  geometries: number;
  materialCount: number;
  playerVisualCount: number;
  presentationHistoryCount: number;
  textures: number;
  triangles: number;
}

export interface SevenAuditSnapshot {
  activePlay: string;
  activePresentationEvent: string | null;
  assignments: {
    coverage: SevenAuditAssignmentSnapshot[];
    protection: SevenAuditAssignmentSnapshot[];
  };
  enabled: boolean;
  playerOverlapWarnings: string[];
  resourceCounts: SevenAuditResourceCounts;
  rosterCount: number;
  routeErrors: ReceiverRouteAuditSnapshot[];
  snapLane: SnapLane;
  staleEngagements: string[];
}

export interface CreateSevenAuditSnapshotOptions {
  activeAudioNodes: number;
  gameplay: GameplaySnapshot;
  materialCount: number;
  play: PlayDefinition;
  playerVisualCount: number;
  presentation: GamePresentationRuntimeSnapshot;
  renderMetrics: RenderMetricsSnapshot;
}

const SNAP_LANES: readonly SnapLane[] = ['leftHash', 'middle', 'rightHash'];
const CAMERA_MODES: readonly GameplayCameraMode[] = [
  'tacticalOrthographic',
  'offensePerspective',
  'cinematicBroadcast',
];
const CINEMATICS: readonly CinematicsSetting[] = ['off', 'brief'];
const CROWD_MODES: readonly SevenAuditCrowdMode[] = ['disabled', 'low'];
const UPDATE_RATES: readonly SevenAuditUpdateRateHz[] = [30, 60, 120];
const OVERLAP_TOLERANCE_YARDS = 0.05;

export function createSevenOnSevenScenarioMatrix(): SevenOnSevenAuditScenario[] {
  const plays = getAvailablePlays('7v7');
  const scenarios: SevenOnSevenAuditScenario[] = [];

  for (const play of plays) {
    for (const snapLane of SNAP_LANES) {
      for (const cameraMode of CAMERA_MODES) {
        for (const cinematics of CINEMATICS) {
          for (const crowd of CROWD_MODES) {
            for (const updateRateHz of UPDATE_RATES) {
              scenarios.push({
                cameraMode,
                cinematics,
                crowd,
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

  return scenarios;
}

export function getSevenAuditSnapSpot(snapLane: SnapLane): FootballSpot {
  return {
    x: SNAP_LANE_X[snapLane],
    z: INITIAL_BALL_SPOT.z,
  };
}

export function createSevenAuditSnapshot({
  activeAudioNodes,
  gameplay,
  materialCount,
  play,
  playerVisualCount,
  presentation,
  renderMetrics,
}: CreateSevenAuditSnapshotOptions): SevenAuditSnapshot {
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
    enabled: true,
    playerOverlapWarnings: findPlayerOverlapWarnings(gameplay),
    resourceCounts: {
      activeAudioNodes,
      drawCalls: renderMetrics.calls,
      geometries: renderMetrics.geometries,
      materialCount,
      playerVisualCount,
      presentationHistoryCount: presentation.history.length,
      textures: renderMetrics.textures,
      triangles: renderMetrics.triangles,
    },
    rosterCount: gameplay.players.length,
    routeErrors: createRouteAuditSnapshots(gameplay, play),
    snapLane: gameplay.snapLane,
    staleEngagements: findStaleEngagementWarnings(gameplay, activeIds, play),
  };
}

export function createSevenAuditOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'seven-audit-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncSevenAuditOverlay(
  element: HTMLDivElement,
  snapshot: SevenAuditSnapshot,
): void {
  const warningCount =
    snapshot.staleEngagements.length +
    snapshot.playerOverlapWarnings.length +
    snapshot.routeErrors.filter((route) => route.exceedsTolerance).length;
  const rows = [
    createRow('SEVEN AUDIT'),
    createRow(`PLAY ${snapshot.activePlay}`),
    createRow(`SNAP ${snapshot.snapLane}`),
    createRow(`ROSTER ${snapshot.rosterCount}`),
    createRow(`EVENT ${snapshot.activePresentationEvent ?? 'none'}`),
    createRow(`WARNINGS ${warningCount === 0 ? 'none' : warningCount}`, warningCount > 0),
    createRow(`ASSIGN protect ${snapshot.assignments.protection.length} coverage ${snapshot.assignments.coverage.length}`),
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
    ...snapshot.staleEngagements.map((warning) => createRow(`! ENG ${warning}`, true)),
    ...snapshot.playerOverlapWarnings.map((warning) => createRow(`! OVERLAP ${warning}`, true)),
    createRow(
      `RES calls ${snapshot.resourceCounts.drawCalls} tris ${snapshot.resourceCounts.triangles} ` +
        `geo ${snapshot.resourceCounts.geometries} mat ${snapshot.resourceCounts.materialCount} ` +
        `players ${snapshot.resourceCounts.playerVisualCount} audioNodes ${snapshot.resourceCounts.activeAudioNodes}`,
    ),
  ];

  element.replaceChildren(...rows);
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

function findStaleEngagementWarnings(
  gameplay: GameplaySnapshot,
  activeIds: ReadonlySet<string>,
  play: PlayDefinition,
): string[] {
  const warnings: string[] = [];
  const blockerIds = new Set<string>();
  const defenderIds = new Set<string>();
  const playerById = new Map(gameplay.players.map((player) => [player.id, player]));

  if (gameplay.playState === 'preSnap' && gameplay.blocking.engagements.length > 0) {
    warnings.push('preSnap has active engagements');
  }

  for (const engagement of gameplay.blocking.engagements) {
    const blocker = playerById.get(engagement.blockerId);
    const defender = playerById.get(engagement.defenderId);

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
    if (blocker && (blocker.team !== 'offense' || blocker.role !== 'blocker')) {
      warnings.push(`invalid blocker ${engagement.blockerId}`);
    }
    if (defender && defender.team !== 'defense') {
      warnings.push(`invalid defender ${engagement.defenderId}`);
    }

    blockerIds.add(engagement.blockerId);
    defenderIds.add(engagement.defenderId);
  }

  for (const routeState of gameplay.receiverRouteStates) {
    if (!activeIds.has(routeState.receiverId)) {
      warnings.push(`route state references missing ${routeState.receiverId}`);
    }
    if (!getEligibleReceiverIds(play).includes(routeState.receiverId) && play.kind === 'pass') {
      warnings.push(`route state references ineligible ${routeState.receiverId}`);
    }
    if (gameplay.playState === 'preSnap' && routeState.distanceAlongRoute !== 0) {
      warnings.push(`preSnap route progressed ${routeState.receiverId}`);
    }
  }

  return warnings;
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
  row.className = 'seven-audit-row';
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
