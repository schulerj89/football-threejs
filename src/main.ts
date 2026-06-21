import * as THREE from 'three';
import './style.css';
import { createBallVisual, syncBallVisual } from './ballVisual';
import { DebugOverlay } from './debugOverlay';
import {
  PLAYABLE_FIELD_BOUNDS,
  WORLD_SCALE,
  createFootballField,
  syncFootballFieldDriveLines,
} from './field';
import { createGameplayHud, syncGameplayHud } from './gameplayHud';
import { KeyboardMovementInput, KeyboardPlayControls } from './input';
import {
  createGameplayModel,
  resetPlay,
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
      getGameplaySnapshot: () => GameplaySnapshot;
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
const playerModel = gameplayModel.player;
const playerVisuals = new Map<string, THREE.Group>();
for (const gamePlayer of gameplayModel.players) {
  const playerVisual = createPlaceholderPlayerVisual(gamePlayer);
  syncPlayerVisual(playerVisual, gamePlayer);
  playerVisuals.set(gamePlayer.id, playerVisual);
  scene.add(playerVisual);
}

const ballVisual = createBallVisual();
syncBallVisual(ballVisual, gameplayModel.ball);
scene.add(ballVisual);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
positionGameplayCamera(camera);

const searchParams = new URLSearchParams(window.location.search);
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
const debugOverlay = new DebugOverlay({ renderer, player: playerModel });
const gameplayHud = createGameplayHud();
let previousFrameTime = performance.now();
let hasRenderedFirstFrame = false;

if (import.meta.env.DEV || searchParams.has('debug')) {
  window.__footballDebug = {
    getGameplaySnapshot: () => snapshotGameplayModel(gameplayModel),
    getPlayerSnapshot: () => snapshotPlayerModel(playerModel),
  };
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

  if (gameplayModel.playState === 'live') {
    updatePlayerSimulation(playerModel, keyboardInput.getMovement(), delta, PLAYABLE_FIELD_BOUNDS, {
      clampSidelines: false,
    });
  } else {
    playerModel.velocity.x = 0;
    playerModel.velocity.z = 0;
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
    }
  }
  syncBallVisual(ballVisual, gameplayModel.ball);
  syncGameplayHud(gameplayHud, snapshotGameplayModel(gameplayModel));
  renderer.render(scene, camera);
  debugOverlay.update(delta, renderer, playerModel);

  if (!hasRenderedFirstFrame) {
    hasRenderedFirstFrame = true;
    document.body.dataset.sceneReady = 'true';
  }
}

function updatePlayControls(): void {
  const requests = playControls.consumeRequests();

  if (requests.resetPlay) {
    resetPlay(gameplayModel);
    return;
  }

  if (requests.selectedPlayId) {
    selectPlay(gameplayModel, requests.selectedPlayId);
  }

  if (requests.startPlay) {
    startPlay(gameplayModel);
  }
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  positionGameplayCamera(camera);
}

function positionGameplayCamera(activeCamera: THREE.OrthographicCamera): void {
  const aspect = window.innerWidth / window.innerHeight;
  const viewHeight = aspect < 0.75 ? 155 : 96;
  const viewWidth = viewHeight * aspect;
  const target = new THREE.Vector3(0, 0, 0);

  activeCamera.left = -viewWidth / 2;
  activeCamera.right = viewWidth / 2;
  activeCamera.top = viewHeight / 2;
  activeCamera.bottom = -viewHeight / 2;
  activeCamera.position.set(18, 74, -110);
  activeCamera.lookAt(target);
  activeCamera.updateProjectionMatrix();
}

console.info(
  `World scale: ${WORLD_SCALE.units}. Field ${WORLD_SCALE.fieldLength} x ${WORLD_SCALE.fieldWidth.toFixed(
    2,
  )} yards. ${WORLD_SCALE.axes}.`,
);
