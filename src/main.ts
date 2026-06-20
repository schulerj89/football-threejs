import * as THREE from 'three';
import './style.css';
import { DebugOverlay } from './debugOverlay';
import { PLAYABLE_FIELD_BOUNDS, WORLD_SCALE, createFootballField } from './field';
import { KeyboardMovementInput } from './input';
import { createPlayerModel, snapshotPlayerModel, type PlayerSnapshot } from './playerModel';
import { updatePlayerSimulation } from './playerSimulation';
import { createPlaceholderPlayerVisual, syncPlayerVisual } from './playerVisual';

declare global {
  interface Window {
    __footballDebug?: {
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

const playerModel = createPlayerModel();
const playerVisual = createPlaceholderPlayerVisual();
syncPlayerVisual(playerVisual, playerModel);
scene.add(playerVisual);

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
const debugOverlay = new DebugOverlay({ renderer, player: playerModel });
let previousFrameTime = performance.now();
let hasRenderedFirstFrame = false;

if (import.meta.env.DEV || searchParams.has('debug')) {
  window.__footballDebug = {
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
  updatePlayerSimulation(playerModel, keyboardInput.getMovement(), delta, PLAYABLE_FIELD_BOUNDS);
  syncPlayerVisual(playerVisual, playerModel);
  renderer.render(scene, camera);
  debugOverlay.update(delta, renderer, playerModel);

  if (!hasRenderedFirstFrame) {
    hasRenderedFirstFrame = true;
    document.body.dataset.sceneReady = 'true';
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
