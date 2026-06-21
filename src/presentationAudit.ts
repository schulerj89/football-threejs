import * as THREE from 'three';
import type { GameplayCameraDebugSnapshot } from './camera/GameplayCameraController';
import type { RenderMetricsSnapshot } from './debugOverlay';
import type { FormationPreviewSnapshot } from './formationPreview';
import type { GameplaySnapshot } from './playState';
import type { PlayerSnapshot } from './playerModel';
import { resolvePlayerAppearance } from './playerAppearance';
import {
  PLAYER_HEAD_ANCHOR_NAME,
  getPlayerBodyVisualSnapshot,
  type PlayerBodyVisualSnapshot,
} from './playerVisual';
import type { PlayerPoseSnapshot } from './presentation/PlayerPoseController';

export type PresentationAuditState = 'locomotionPreview' | 'preSnap';

export interface PresentationAuditConfig {
  fieldLevelY: number;
  framingMarginNdc: number;
  groundTolerance: number;
  helmetShoulderGapMinimum: number;
  limbSymmetryTolerance: number;
  rootTolerance: number;
  significantBelowFieldTolerance: number;
}

export interface NdcBoundsSnapshot {
  max: { x: number; y: number; z: number };
  min: { x: number; y: number; z: number };
}

export interface PresentationAuditPlayerSnapshot {
  body: PlayerBodyVisualSnapshot;
  collisionRadiusStable: boolean;
  feetOnOrAboveField: boolean;
  gameplayFacingRadians: number;
  gameplayPosition: { x: number; z: number };
  helmetAttached: boolean;
  helmetParentName: string | null;
  helmetShoulderGapStable: boolean;
  leftFootMinY: number | null;
  ndcBounds: NdcBoundsSnapshot;
  playerId: string;
  rightFootMinY: number | null;
  rootMatchesGameplay: boolean;
  rootPosition: { x: number; y: number; z: number };
  restingLimbSymmetryError: number;
  significantGeometryBelowField: boolean;
  visualFacingRadians: number;
  withinFramingMargin: boolean;
}

export interface PresentationAuditSnapshot {
  allFeetGrounded: boolean;
  allHelmetsAttached: boolean;
  allPlayersInsideFramingMargin: boolean;
  cameraMode: GameplayCameraDebugSnapshot['mode'];
  cameraState: GameplayCameraDebugSnapshot['state'];
  enabled: true;
  formationIssueCount: number;
  framingMarginNdc: number;
  issues: string[];
  playerMotionEnabled: boolean;
  players: PresentationAuditPlayerSnapshot[];
  presentationPhase: GameplayCameraDebugSnapshot['presentationPhase'] | null;
  renderMetrics: RenderMetricsSnapshot | null;
  snapLane: string;
  stableHelmetGaps: boolean;
  state: PresentationAuditState;
}

export interface CameraFramingPlayerSnapshot {
  ndcBounds: NdcBoundsSnapshot;
  playerId: string;
  withinMargin: boolean;
}

export interface CameraFramingSnapshot {
  framedPlayerIds: string[];
  marginNdc: number;
  players: CameraFramingPlayerSnapshot[];
  unframedPlayerIds: string[];
}

export const PRESENTATION_AUDIT_CONFIG: PresentationAuditConfig = {
  fieldLevelY: 0,
  framingMarginNdc: 0.035,
  groundTolerance: 0.001,
  helmetShoulderGapMinimum: 0.012,
  limbSymmetryTolerance: 0.001,
  rootTolerance: 0.0001,
  significantBelowFieldTolerance: 0.01,
} as const;

export function resolvePresentationAuditState(value: string | null): PresentationAuditState {
  return value === 'locomotion' || value === 'locomotionPreview'
    ? 'locomotionPreview'
    : 'preSnap';
}

export function createPresentationAuditGameplaySnapshot(
  snapshot: GameplaySnapshot,
  state: PresentationAuditState,
): GameplaySnapshot {
  if (state === 'preSnap') {
    return snapshot;
  }

  const players = snapshot.players.map(createLocomotionPreviewPlayer);
  const carrier = players.find((player) => player.id === 'offense-qb') ?? players[0] ?? snapshot.player;
  const player = players.find((candidate) => candidate.id === snapshot.player.id) ?? carrier;

  return {
    ...snapshot,
    activePlayStartSpot: snapshot.currentBallSpot,
    ball: {
      ...snapshot.ball,
      possession: { kind: 'player', playerId: carrier.id },
      state: { kind: 'possessed', playerId: carrier.id },
    },
    player,
    players,
    playState: 'live',
  };
}

export function createPresentationAuditOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'presentation-audit-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncPresentationAuditOverlay(
  element: HTMLElement,
  snapshot: PresentationAuditSnapshot,
): void {
  const lines = [
    'PRESENTATION AUDIT',
    `STATE ${snapshot.state}`,
    `LANE ${snapshot.snapLane}`,
    `CAM ${snapshot.cameraMode}`,
    `CAM_STATE ${snapshot.cameraState}`,
    `PHASE ${snapshot.presentationPhase ?? 'none'}`,
    `MOTION ${snapshot.playerMotionEnabled ? 'on' : 'off'}`,
    `FRAMED ${snapshot.allPlayersInsideFramingMargin ? 'yes' : 'no'} margin ${snapshot.framingMarginNdc.toFixed(3)}`,
    `GROUND ${snapshot.allFeetGrounded ? 'ok' : 'fail'}`,
    `HELMETS ${snapshot.allHelmetsAttached ? 'ok' : 'fail'}`,
    `GAPS ${snapshot.stableHelmetGaps ? 'ok' : 'fail'}`,
  ];

  if (snapshot.renderMetrics) {
    lines.push(
      `FRAME_MS ${snapshot.renderMetrics.frameTimeMs.toFixed(1)}`,
      `CALLS ${snapshot.renderMetrics.calls}`,
      `TRIS ${snapshot.renderMetrics.triangles}`,
      `PLAYER_MESHES ${snapshot.renderMetrics.playerBodyMeshCount}`,
      `MATERIALS ${snapshot.renderMetrics.sceneMaterialCount}`,
    );
  }

  lines.push(`ISSUES ${snapshot.issues.length === 0 ? 'none' : snapshot.issues.join('; ')}`);
  element.textContent = lines.join('\n');
}

export function createPresentationAuditSnapshot(options: {
  camera: THREE.Camera;
  cameraDebug: GameplayCameraDebugSnapshot;
  config?: PresentationAuditConfig;
  formation: FormationPreviewSnapshot | null;
  gameplay: GameplaySnapshot;
  playerMotionEnabled: boolean;
  playerVisuals: Map<string, THREE.Object3D>;
  poseSnapshots: PlayerPoseSnapshot[];
  renderMetrics: RenderMetricsSnapshot | null;
  state: PresentationAuditState;
}): PresentationAuditSnapshot {
  const config = options.config ?? PRESENTATION_AUDIT_CONFIG;
  const framing = createCameraFramingSnapshot(
    options.camera,
    options.playerVisuals,
    config.framingMarginNdc,
  );
  const posesById = new Map(options.poseSnapshots.map((pose) => [pose.playerId, pose]));
  const players = options.gameplay.players.map((player) => {
    const visual = options.playerVisuals.get(player.id);
    const body = visual
      ? getPlayerBodyVisualSnapshot(visual)
      : createMissingBodySnapshot(player.id);
    const playerFraming = framing.players.find((candidate) => candidate.playerId === player.id);

    return createPresentationAuditPlayerSnapshot({
      body,
      config,
      ndcBounds: playerFraming?.ndcBounds ?? createEmptyNdcBounds(),
      player,
      pose: posesById.get(player.id) ?? null,
      visual,
      withinFramingMargin: playerFraming?.withinMargin ?? false,
    });
  });
  const issues = collectPresentationAuditIssues(players, options.formation, options.state);

  return {
    allFeetGrounded: players.every((player) => player.feetOnOrAboveField),
    allHelmetsAttached: players.every((player) => player.helmetAttached),
    allPlayersInsideFramingMargin: players.every((player) => player.withinFramingMargin),
    cameraMode: options.cameraDebug.mode,
    cameraState: options.cameraDebug.state,
    enabled: true,
    formationIssueCount: options.formation?.issues.length ?? 0,
    framingMarginNdc: config.framingMarginNdc,
    issues,
    playerMotionEnabled: options.playerMotionEnabled,
    players,
    presentationPhase: options.cameraDebug.presentationPhase ?? null,
    renderMetrics: options.renderMetrics,
    snapLane: options.formation?.snapLane ?? options.gameplay.snapLane,
    stableHelmetGaps: players.every((player) => player.helmetShoulderGapStable),
    state: options.state,
  };
}

export function createCameraFramingSnapshot(
  camera: THREE.Camera,
  playerVisuals: Map<string, THREE.Object3D>,
  marginNdc = 0,
): CameraFramingSnapshot {
  const players: CameraFramingPlayerSnapshot[] = [];
  const framedPlayerIds: string[] = [];
  const unframedPlayerIds: string[] = [];

  camera.updateMatrixWorld(true);
  if (camera instanceof THREE.OrthographicCamera || camera instanceof THREE.PerspectiveCamera) {
    camera.updateProjectionMatrix();
  }

  for (const [playerId, visual] of playerVisuals) {
    visual.updateWorldMatrix(true, true);
    const ndcBounds = projectWorldBoundsToNdc(new THREE.Box3().setFromObject(visual), camera);
    const withinMargin = isNdcBoundsInsideMargin(ndcBounds, marginNdc);

    players.push({ ndcBounds, playerId, withinMargin });
    if (withinMargin) {
      framedPlayerIds.push(playerId);
    } else {
      unframedPlayerIds.push(playerId);
    }
  }

  return {
    framedPlayerIds: framedPlayerIds.sort(),
    marginNdc,
    players: players.sort((a, b) => a.playerId.localeCompare(b.playerId)),
    unframedPlayerIds: unframedPlayerIds.sort(),
  };
}

function createPresentationAuditPlayerSnapshot(options: {
  body: PlayerBodyVisualSnapshot;
  config: PresentationAuditConfig;
  ndcBounds: NdcBoundsSnapshot;
  player: PlayerSnapshot;
  pose: PlayerPoseSnapshot | null;
  visual: THREE.Object3D | undefined;
  withinFramingMargin: boolean;
}): PresentationAuditPlayerSnapshot {
  const visual = options.visual;
  const leftFootBounds = visual ? getObjectWorldBounds(visual, 'leftFoot') : null;
  const rightFootBounds = visual ? getObjectWorldBounds(visual, 'rightFoot') : null;
  const helmet = visual?.getObjectByName('low-poly-helmet') ?? null;
  const rootPosition = visual?.position ?? new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
  const visualFacing = visual?.rotation.y ?? Number.NaN;
  const leftFootMinY = leftFootBounds?.min.y ?? null;
  const rightFootMinY = rightFootBounds?.min.y ?? null;
  const lowestFootY = Math.min(
    leftFootMinY ?? Number.POSITIVE_INFINITY,
    rightFootMinY ?? Number.POSITIVE_INFINITY,
  );
  const restingLimbSymmetryError = visual
    ? calculateRestingLimbSymmetryError(visual, options.pose?.intent ?? 'neutral')
    : Number.POSITIVE_INFINITY;

  return {
    body: options.body,
    collisionRadiusStable: Number.isFinite(options.player.collisionRadius) && options.player.collisionRadius > 0,
    feetOnOrAboveField: lowestFootY >= options.config.fieldLevelY - options.config.groundTolerance,
    gameplayFacingRadians: options.player.facingRadians,
    gameplayPosition: { ...options.player.position },
    helmetAttached: !!helmet && helmet.parent?.name === PLAYER_HEAD_ANCHOR_NAME,
    helmetParentName: helmet?.parent?.name ?? null,
    helmetShoulderGapStable:
      options.body.helmetShoulderVerticalGap !== null &&
      options.body.helmetShoulderVerticalGap >= options.config.helmetShoulderGapMinimum,
    leftFootMinY,
    ndcBounds: options.ndcBounds,
    playerId: options.player.id,
    restingLimbSymmetryError,
    rightFootMinY,
    rootMatchesGameplay:
      Math.abs(rootPosition.x - options.player.position.x) <= options.config.rootTolerance &&
      Math.abs(rootPosition.z - options.player.position.z) <= options.config.rootTolerance &&
      Math.abs(visualFacing - options.player.facingRadians) <= options.config.rootTolerance,
    rootPosition: {
      x: rootPosition.x,
      y: rootPosition.y,
      z: rootPosition.z,
    },
    significantGeometryBelowField:
      options.body.combinedBounds.min.y <
      options.config.fieldLevelY - options.config.significantBelowFieldTolerance,
    visualFacingRadians: visualFacing,
    withinFramingMargin: options.withinFramingMargin,
  };
}

function createLocomotionPreviewPlayer(player: PlayerSnapshot): PlayerSnapshot {
  const direction = player.team === 'offense' ? 1 : -1;
  const lateral = player.id.includes('left') ? -0.65 : player.id.includes('right') ? 0.65 : 0;
  const speed = player.team === 'offense' ? 6.2 : 5.6;

  return {
    ...player,
    currentState: player.team === 'offense' ? 'movingToLane' : 'pursuing',
    velocity: {
      x: lateral,
      z: speed * direction,
    },
  };
}

function collectPresentationAuditIssues(
  players: PresentationAuditPlayerSnapshot[],
  formation: FormationPreviewSnapshot | null,
  state: PresentationAuditState,
): string[] {
  const issues: string[] = [];

  if (formation && formation.issues.length > 0) {
    issues.push(`formation:${formation.issues.length}`);
  }

  for (const player of players) {
    if (!player.rootMatchesGameplay) {
      issues.push(`${player.playerId}:root`);
    }

    if (!player.feetOnOrAboveField || player.significantGeometryBelowField) {
      issues.push(`${player.playerId}:ground`);
    }

    if (!player.helmetAttached) {
      issues.push(`${player.playerId}:helmet-parent`);
    }

    if (!player.helmetShoulderGapStable) {
      issues.push(`${player.playerId}:helmet-gap`);
    }

    if (state === 'preSnap' && !player.withinFramingMargin) {
      issues.push(`${player.playerId}:framing`);
    }
  }

  return issues;
}

function projectWorldBoundsToNdc(bounds: THREE.Box3, camera: THREE.Camera): NdcBoundsSnapshot {
  if (bounds.isEmpty()) {
    return createEmptyNdcBounds();
  }

  const corners = [
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
    new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
    new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
    new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
  ].map((corner) => corner.project(camera));

  return {
    max: {
      x: Math.max(...corners.map((corner) => corner.x)),
      y: Math.max(...corners.map((corner) => corner.y)),
      z: Math.max(...corners.map((corner) => corner.z)),
    },
    min: {
      x: Math.min(...corners.map((corner) => corner.x)),
      y: Math.min(...corners.map((corner) => corner.y)),
      z: Math.min(...corners.map((corner) => corner.z)),
    },
  };
}

function isNdcBoundsInsideMargin(bounds: NdcBoundsSnapshot, margin: number): boolean {
  const min = -1 + margin;
  const max = 1 - margin;

  return (
    bounds.min.x >= min &&
    bounds.max.x <= max &&
    bounds.min.y >= min &&
    bounds.max.y <= max &&
    bounds.min.z >= -1 &&
    bounds.max.z <= 1
  );
}

function getObjectWorldBounds(root: THREE.Object3D, objectName: string): THREE.Box3 | null {
  const object = root.getObjectByName(objectName);

  if (!object) {
    return null;
  }

  root.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object);
}

function calculateRestingLimbSymmetryError(
  visual: THREE.Object3D,
  intent: PlayerPoseSnapshot['intent'] | 'neutral',
): number {
  const leftArm = visual.getObjectByName('leftArmPivot');
  const rightArm = visual.getObjectByName('rightArmPivot');
  const leftLeg = visual.getObjectByName('leftLegPivot');
  const rightLeg = visual.getObjectByName('rightLegPivot');

  if (!leftArm || !rightArm || !leftLeg || !rightLeg) {
    return Number.POSITIVE_INFINITY;
  }

  const mirroredXRotation =
    intent === 'locomotion'
      ? Math.abs(leftArm.rotation.x + rightArm.rotation.x) +
        Math.abs(leftLeg.rotation.x + rightLeg.rotation.x)
      : Math.abs(leftArm.rotation.x - rightArm.rotation.x) +
        Math.abs(leftLeg.rotation.x - rightLeg.rotation.x);

  return (
    Math.abs(leftArm.position.x + rightArm.position.x) +
    Math.abs(leftLeg.position.x + rightLeg.position.x) +
    mirroredXRotation +
    Math.abs(leftArm.rotation.z + rightArm.rotation.z) +
    Math.abs(leftLeg.rotation.z + rightLeg.rotation.z)
  );
}

function createMissingBodySnapshot(playerId: string): PlayerBodyVisualSnapshot {
  const emptyBounds = {
    center: { x: 0, y: 0, z: 0 },
    max: { x: 0, y: 0, z: 0 },
    min: { x: 0, y: 0, z: 0 },
    size: { x: 0, y: 0, z: 0 },
  };

  return {
    bodyBounds: emptyBounds,
    bodyStyle: 'mannequin',
    bodyTriangleCount: 0,
    combinedBounds: emptyBounds,
    appearance: resolvePlayerAppearance(playerId),
    headBounds: null,
    headHelmetClearance: null,
    helmetBounds: null,
    helmetShoulderVerticalGap: null,
    meshesPerPlayer: 0,
    minimumBodyY: 0,
    neckBounds: null,
    playerId,
    shoulderWidth: 0,
    totalHeight: 0,
    uniqueBodyGeometryCount: 0,
    uniqueBodyMaterialCount: 0,
  };
}

function createEmptyNdcBounds(): NdcBoundsSnapshot {
  return {
    max: { x: 0, y: 0, z: 0 },
    min: { x: 0, y: 0, z: 0 },
  };
}
