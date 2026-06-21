import * as THREE from 'three';
import './style.css';
import { createBallVisual, syncBallVisual } from './ballVisual';
import {
  GameplayCameraController,
  resolveGameplayCameraMode,
  type GameplayCameraDebugSnapshot,
} from './camera/GameplayCameraController';
import { DebugOverlay } from './debugOverlay';
import {
  PLAYABLE_FIELD_BOUNDS,
  WORLD_SCALE,
  createFootballField,
  syncFootballFieldDriveLines,
} from './field';
import { createGameplayHud, syncGameplayHud } from './gameplayHud';
import {
  attachHelmetsToPlayerVisuals,
  getHelmetAssetSnapshot,
  syncHelmetTeamMaterials,
  type HelmetAssetSnapshot,
} from './helmetVisual';
import { KeyboardMovementInput, KeyboardPlayControls } from './input';
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
import { snapshotPlayerModel, type PlayerSnapshot } from './playerModel';
import { updatePlayerSimulation } from './playerSimulation';
import { createPlaceholderPlayerVisual, syncPlayerVisual } from './playerVisual';

declare global {
  interface Window {
    __footballDebug?: {
      getCameraSnapshot: () => GameplayCameraDebugSnapshot;
      getGameplaySnapshot: () => GameplaySnapshot;
      getHelmetAssetSnapshot: () => HelmetAssetSnapshot;
      getPlayerSnapshot: () => PlayerSnapshot;
    };
  }
}

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app mount point');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101920);

const field = createFootballField();
scene.add(field.group);

const gameplayModel = createGameplayModel();
const playerVisuals = new Map<string, THREE.Group>();
for (const gamePlayer of gameplayModel.players) {
  const playerVisual = createPlaceholderPlayerVisual(gamePlayer);
  syncPlayerVisual(playerVisual, gamePlayer);
  playerVisuals.set(gamePlayer.id, playerVisual);
  scene.add(playerVisual);
}
attachHelmetsToPlayerVisuals(playerVisuals, gameplayModel.players);

const ballVisual = createBallVisual();
syncBallVisual(ballVisual, gameplayModel.ball);
scene.add(ballVisual);

const searchParams = new URLSearchParams(window.location.search);
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
const debugOverlay = new DebugOverlay({ renderer, player: gameplayModel.player });
const gameplayHud = createGameplayHud();
let previousFrameTime = performance.now();
let hasRenderedFirstFrame = false;

if (import.meta.env.DEV || searchParams.has('debug')) {
  window.__footballDebug = {
    getCameraSnapshot: () => cameraController.getDebugSnapshot(),
    getGameplaySnapshot: () => snapshotGameplayModel(gameplayModel),
    getHelmetAssetSnapshot,
    getPlayerSnapshot: () => snapshotPlayerModel(gameplayModel.player),
  };
  window.addEventListener('keydown', handleDevelopmentCameraToggle);
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
  syncFootballFieldDriveLines(
    field,
    gameplayModel.drive.lineOfScrimmage,
    gameplayModel.drive.firstDownMarker,
  );
  for (const gamePlayer of gameplayModel.players) {
    const playerVisual = playerVisuals.get(gamePlayer.id);
    if (playerVisual) {
      syncPlayerVisual(playerVisual, gamePlayer);
      syncHelmetTeamMaterials(playerVisual, gamePlayer);
    }
  }
  syncBallVisual(ballVisual, gameplayModel.ball);
  const gameplaySnapshot = snapshotGameplayModel(gameplayModel);
  cameraController.update(gameplaySnapshot, delta);
  syncGameplayHud(gameplayHud, gameplaySnapshot);
  renderer.render(scene, cameraController.camera);
  debugOverlay.update(delta, renderer, gameplayModel.player, cameraController.getDebugSnapshot());

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

  if (requests.selectedPlayId) {
    selectPlay(gameplayModel, requests.selectedPlayId);
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

function handleDevelopmentCameraToggle(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== 'c') {
    return;
  }

  cameraController.toggleMode(snapshotGameplayModel(gameplayModel));
  event.preventDefault();
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  cameraController.resize(width, height);
}

console.info(
  `World scale: ${WORLD_SCALE.units}. Field ${WORLD_SCALE.fieldLength} x ${WORLD_SCALE.fieldWidth.toFixed(
    2,
  )} yards. ${WORLD_SCALE.axes}.`,
);
