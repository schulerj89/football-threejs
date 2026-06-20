import * as THREE from 'three';
import './style.css';
import { DebugOverlay } from './debugOverlay';
import { LINE_OF_SCRIMMAGE_Z, WORLD_SCALE, createFootballField } from './field';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app mount point');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101920);

const field = createFootballField();
scene.add(field.group);

const player = createPlaceholderPlayer();
player.position.set(0, 1.1, LINE_OF_SCRIMMAGE_Z);
scene.add(player);

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

const debugOverlay = new DebugOverlay({ renderer, player });
let previousFrameTime = performance.now();
let hasRenderedFirstFrame = false;

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
  renderer.render(scene, camera);
  debugOverlay.update(delta, renderer, player);

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

function createPlaceholderPlayer(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'placeholder-player';
  group.userData.testId = 'placeholder-player';

  const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x2f66d8 });
  const facingMaterial = new THREE.MeshBasicMaterial({ color: 0xf3f5f8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1.4), bodyMaterial);
  body.name = 'placeholder-player-body';
  group.add(body);

  const facingStripe = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.08), facingMaterial);
  facingStripe.position.set(0, 0.35, 0.74);
  facingStripe.name = 'placeholder-player-facing-stripe';
  group.add(facingStripe);

  const scaleReference = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 1.9), facingMaterial);
  scaleReference.position.set(0, -1.14, 0);
  scaleReference.name = 'placeholder-player-scale-reference';
  group.add(scaleReference);

  return group;
}

console.info(
  `World scale: ${WORLD_SCALE.units}. Field ${WORLD_SCALE.fieldLength} x ${WORLD_SCALE.fieldWidth.toFixed(
    2,
  )} yards. ${WORLD_SCALE.axes}.`,
);
