import * as THREE from 'three';
import './style.css';
import { createBallVisual, syncBallVisual } from './ballVisual';
import {
  GameplayCameraController,
  resolveGameplayCameraMode,
  type GameplayCameraDebugSnapshot,
} from './camera/GameplayCameraController';
import { DebugOverlay, type RenderMetricsSnapshot } from './debugOverlay';
import {
  PLAYABLE_FIELD_BOUNDS,
  WORLD_SCALE,
  createFootballField,
  syncFootballFieldDriveLines,
} from './field';
import {
  createFormationAuditOverlay,
  syncFormationAuditOverlay,
} from './formationAuditOverlay';
import { createGameplayHud, syncGameplayHud } from './gameplayHud';
import {
  attachHelmetsToPlayerVisuals,
  getHelmetAssetSnapshot,
  syncHelmetTeamMaterials,
  type HelmetAssetSnapshot,
} from './helmetVisual';
import { KeyboardMovementInput, KeyboardPlayControls } from './input';
import { createPlayCallUi, syncPlayCallUi } from './playCallUi';
import {
  createFormationPreviewModel,
  resolveFormationPreviewMode,
  setFormationPreviewSnapLane,
  snapshotFormationPreviewAsGameplay,
  snapshotFormationPreviewModel,
  type FormationPreviewSnapshot,
} from './formationPreview';
import {
  attemptPass,
  createGameplayModel,
  cycleSelectedReceiver,
  resetPlay,
  restartScoreAttack,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
  updateGameplayModel,
  type GameplaySnapshot,
} from './playState';
import {
  PlayerPoseController,
  createPlayerPoseDebugOverlay,
  syncPlayerPoseDebugOverlay,
  type PlayerPoseSnapshot,
} from './presentation/PlayerPoseController';
import { snapshotPlayerModel, type PlayerSnapshot } from './playerModel';
import { updatePlayerSimulation } from './playerSimulation';
import {
  createPlaceholderPlayerVisual,
  getPlayerBodyVisualSnapshot,
  resolvePlayerBodyVisualStyle,
  syncPlayerVisual,
  type PlayerBodyVisualSnapshot,
} from './playerVisual';

declare global {
  interface Window {
    __footballDebug?: {
      getCameraSnapshot: () => GameplayCameraDebugSnapshot;
      getCameraFramingSnapshot: () => CameraFramingSnapshot;
      getFormationPreviewSnapshot: () => FormationPreviewSnapshot | null;
      getGameplaySnapshot: () => GameplaySnapshot;
      getHelmetAssetSnapshot: () => HelmetAssetSnapshot;
      getPlayerBodyVisualSnapshots: () => PlayerBodyVisualSnapshot[];
      getPlayerPoseSnapshots: () => PlayerPoseSnapshot[];
      getPlayerSnapshot: () => PlayerSnapshot;
      getRenderMetrics: () => RenderMetricsSnapshot;
    };
  }
}

interface CameraFramingSnapshot {
  framedPlayerIds: string[];
  unframedPlayerIds: string[];
}

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app mount point');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101920);

const searchParams = new URLSearchParams(window.location.search);
const playerVisualOptions = {
  bodyStyle: resolvePlayerBodyVisualStyle(searchParams.get('playerBody')),
  debugRoleColors: searchParams.has('debugRoleColors'),
};
const playerMotionEnabled = searchParams.get('playerMotion') !== '0';
const formationPreviewMode = resolveFormationPreviewMode(searchParams.get('formationPreview'));
const field = createFootballField({
  fieldAudit: searchParams.has('fieldAudit'),
});
scene.add(field.group);

const gameplayModel = createGameplayModel();
const formationPreviewModel = formationPreviewMode
  ? createFormationPreviewModel(formationPreviewMode)
  : null;
const playerVisuals = new Map<string, THREE.Group>();
for (const gamePlayer of getActivePlayers()) {
  const playerVisual = createPlaceholderPlayerVisual(gamePlayer, playerVisualOptions);
  syncPlayerVisual(playerVisual, gamePlayer, playerVisualOptions);
  playerVisuals.set(gamePlayer.id, playerVisual);
  scene.add(playerVisual);
}
attachHelmetsToPlayerVisuals(playerVisuals, getActivePlayers());

const ballVisual = createBallVisual();
syncBallVisual(ballVisual, gameplayModel.ball);
scene.add(ballVisual);

const cameraController = new GameplayCameraController({
  height: window.innerHeight,
  initialMode: resolveGameplayCameraMode(searchParams.get('camera')),
  width: window.innerWidth,
});
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: searchParams.has('readback'),
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const ambientLight = new THREE.HemisphereLight(0xdde7ef, 0x344038, 2.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
directionalLight.position.set(-20, 45, -25);
scene.add(directionalLight);

const keyboardInput = new KeyboardMovementInput(window);
const playControls = new KeyboardPlayControls(window);
const debugOverlay = new DebugOverlay({ renderer, player: getActivePrimaryPlayer() });
const gameplayHud = createGameplayHud();
const playCallUi = formationPreviewModel ? null : createPlayCallUi();
const playerPoseController = new PlayerPoseController(undefined, {
  enabled: playerMotionEnabled,
});
const poseDebugOverlay = searchParams.has('poseDebug') ? createPlayerPoseDebugOverlay() : null;
const formationAuditOverlay = searchParams.has('formationAudit')
  ? createFormationAuditOverlay()
  : null;
let previousFrameTime = performance.now();
let hasRenderedFirstFrame = false;
let latestRenderMetrics: RenderMetricsSnapshot | null = null;

if (import.meta.env.DEV || searchParams.has('debug')) {
  window.__footballDebug = {
    getCameraSnapshot: () => cameraController.getDebugSnapshot(),
    getCameraFramingSnapshot: () => getCameraFramingSnapshot(),
    getFormationPreviewSnapshot: () =>
      formationPreviewModel ? snapshotFormationPreviewModel(formationPreviewModel) : null,
    getGameplaySnapshot: () => getActiveGameplaySnapshot(),
    getHelmetAssetSnapshot,
    getPlayerBodyVisualSnapshots: () =>
      [...playerVisuals.values()].map((playerVisual) => getPlayerBodyVisualSnapshot(playerVisual)),
    getPlayerPoseSnapshots: () => playerPoseController.getPoseSnapshots(),
    getPlayerSnapshot: () => snapshotPlayerModel(getActivePrimaryPlayer()),
    getRenderMetrics: () => latestRenderMetrics ?? createRenderMetricsSnapshot(0),
  };
  window.addEventListener('keydown', handleDevelopmentCameraToggle);
}

if (formationPreviewModel) {
  window.addEventListener('keydown', handleFormationPreviewLaneControls);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

renderFrame(0);

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const delta = Math.min((now - previousFrameTime) / 1000, 0.1);
  previousFrameTime = now;

  renderFrame(delta);
});

function renderFrame(delta: number): void {
  if (formationPreviewModel) {
    for (const player of formationPreviewModel.players) {
      player.velocity.x = 0;
      player.velocity.z = 0;
      player.currentState = 'idle';
    }
  } else {
    updatePlayControls();

    if (
      gameplayModel.playState === 'live' &&
      gameplayModel.player.currentState === 'userControlled'
    ) {
      updatePlayerSimulation(gameplayModel.player, keyboardInput.getMovement(), delta, PLAYABLE_FIELD_BOUNDS, {
        clampSidelines: false,
      });
    } else {
      gameplayModel.player.velocity.x = 0;
      gameplayModel.player.velocity.z = 0;
    }

    updateGameplayModel(gameplayModel, delta);
  }

  const gameplaySnapshot = getActiveGameplaySnapshot();
  syncFootballFieldDriveLines(
    field,
    gameplaySnapshot.drive.lineOfScrimmage,
    gameplaySnapshot.drive.firstDownMarker,
  );
  for (const gamePlayer of getActivePlayers()) {
    const playerVisual = playerVisuals.get(gamePlayer.id);
    if (playerVisual) {
      syncPlayerVisual(playerVisual, gamePlayer, playerVisualOptions);
      syncHelmetTeamMaterials(playerVisual, gamePlayer);
    }
  }
  syncBallVisual(ballVisual, formationPreviewModel?.ball ?? gameplayModel.ball);
  playerPoseController.update(gameplaySnapshot, playerVisuals, delta);
  cameraController.update(gameplaySnapshot, delta);
  syncGameplayHud(gameplayHud, gameplaySnapshot);
  if (playCallUi) {
    syncPlayCallUi(playCallUi, gameplaySnapshot);
  }
  if (poseDebugOverlay) {
    syncPlayerPoseDebugOverlay(poseDebugOverlay, playerPoseController.getPoseSnapshots());
  }
  if (formationAuditOverlay) {
    syncFormationAuditOverlay(formationAuditOverlay, gameplayModel, formationPreviewModel?.formation);
  }
  renderer.render(scene, cameraController.camera);
  if (debugOverlay.isVisible() || formationPreviewModel) {
    latestRenderMetrics = createRenderMetricsSnapshot(delta);
  }
  const renderMetrics = debugOverlay.isVisible() ? latestRenderMetrics ?? undefined : undefined;
  debugOverlay.update(
    delta,
    renderer,
    getActivePrimaryPlayer(),
    cameraController.getDebugSnapshot(),
    gameplaySnapshot,
    debugOverlay.isVisible() && playerVisuals.has(getActivePrimaryPlayer().id)
      ? getPlayerBodyVisualSnapshot(playerVisuals.get(getActivePrimaryPlayer().id)!)
      : undefined,
    renderMetrics,
  );

  if (!hasRenderedFirstFrame) {
    hasRenderedFirstFrame = true;
    document.body.dataset.sceneReady = 'true';
  }
}

function updatePlayControls(): void {
  const requests = playControls.consumeRequests();

  if (requests.restartChallenge) {
    restartScoreAttack(gameplayModel);
    return;
  }

  if (requests.resetPlay) {
    resetPlay(gameplayModel);
    return;
  }

  const selectedPlayId = requests.selectedPlayId ?? playCallUi?.consumeSelectedPlayId() ?? null;

  if (selectedPlayId) {
    selectPlay(gameplayModel, selectedPlayId);
  }

  if (requests.cycleReceiver) {
    cycleSelectedReceiver(gameplayModel);
  }

  if (requests.pass) {
    attemptPass(gameplayModel);
  }

  if (requests.startPlay) {
    startPlay(gameplayModel);
  }
}

function handleFormationPreviewLaneControls(event: KeyboardEvent): void {
  if (!formationPreviewModel || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.key === '1') {
    setFormationPreviewSnapLane(formationPreviewModel, 'leftHash');
    event.preventDefault();
    return;
  }

  if (event.key === '2') {
    setFormationPreviewSnapLane(formationPreviewModel, 'middle');
    event.preventDefault();
    return;
  }

  if (event.key === '3') {
    setFormationPreviewSnapLane(formationPreviewModel, 'rightHash');
    event.preventDefault();
  }
}

function handleDevelopmentCameraToggle(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== 'c') {
    return;
  }

  cameraController.toggleMode(getActiveGameplaySnapshot());
  event.preventDefault();
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  cameraController.resize(width, height);
}

function getActivePlayers() {
  return formationPreviewModel?.players ?? gameplayModel.players;
}

function getActivePrimaryPlayer() {
  return formationPreviewModel
    ? formationPreviewModel.players.find((player) => player.id === 'offense-qb') ?? formationPreviewModel.players[0]
    : gameplayModel.player;
}

function getActiveGameplaySnapshot(): GameplaySnapshot {
  return formationPreviewModel
    ? snapshotFormationPreviewAsGameplay(formationPreviewModel)
    : snapshotGameplayModel(gameplayModel);
}

function createRenderMetricsSnapshot(deltaSeconds: number): RenderMetricsSnapshot {
  const sceneMaterials = new Set<string>();
  let sceneMeshCount = 0;
  let playerBodyMeshCount = 0;

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    sceneMeshCount += 1;
    for (const material of getMaterials(object.material)) {
      sceneMaterials.add(material.uuid);
    }
  });

  for (const playerVisual of playerVisuals.values()) {
    playerVisual.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        playerBodyMeshCount += 1;
      }
    });
  }

  return {
    calls: renderer.info.render.calls,
    frameTimeMs: Math.max(0, deltaSeconds) * 1000,
    geometries: renderer.info.memory.geometries,
    playerBodyMeshCount,
    playerCount: getActivePlayers().length,
    sceneMaterialCount: sceneMaterials.size,
    sceneMeshCount,
    textures: renderer.info.memory.textures,
    triangles: renderer.info.render.triangles,
  };
}

function getCameraFramingSnapshot(): CameraFramingSnapshot {
  const framedPlayerIds: string[] = [];
  const unframedPlayerIds: string[] = [];
  const camera = cameraController.camera;

  camera.updateMatrixWorld(true);
  if (camera instanceof THREE.OrthographicCamera || camera instanceof THREE.PerspectiveCamera) {
    camera.updateProjectionMatrix();
  }

  for (const player of getActivePlayers()) {
    const point = new THREE.Vector3(player.position.x, 1.1, player.position.z).project(camera);
    const isFramed =
      Math.abs(point.x) <= 1 &&
      Math.abs(point.y) <= 1 &&
      point.z >= -1 &&
      point.z <= 1;

    if (isFramed) {
      framedPlayerIds.push(player.id);
    } else {
      unframedPlayerIds.push(player.id);
    }
  }

  return {
    framedPlayerIds,
    unframedPlayerIds,
  };
}

function getMaterials(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

console.info(
  `World scale: ${WORLD_SCALE.units}. Field ${WORLD_SCALE.fieldLength} x ${WORLD_SCALE.fieldWidth.toFixed(
    2,
  )} yards. ${WORLD_SCALE.axes}.`,
);
