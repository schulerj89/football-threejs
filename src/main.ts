import * as THREE from 'three';
import './style.css';
import {
  createBallVisual,
  getBallVisualSnapshot,
  resolveBallVisualStyle,
  syncBallVisual,
  type BallVisualSnapshot,
} from './ballVisual';
import {
  createAudioDebugOverlay,
  syncAudioDebugOverlay,
  type RuntimeAudioDebugSnapshot,
} from './audio/AudioDebugOverlay';
import { AudioMixer } from './audio/AudioMixer';
import {
  BroadcastCommentaryDirector,
} from './audio/BroadcastCommentaryDirector';
import {
  GameAudioDirector,
} from './audio/GameAudioDirector';
import {
  applyAudioQuerySettings,
  loadAudioSettings,
  resolveAudioFeatureFlags,
} from './audio/AudioSettings';
import {
  createAppearanceAuditOverlay,
  createAppearanceAuditSnapshot,
  syncAppearanceAuditOverlay,
  type AppearanceAuditSnapshot,
} from './appearanceAuditOverlay';
import {
  GameplayCameraController,
  resolveCinematicsSetting,
  resolveGameplayCameraMode,
  resolvePresentationShotPreview,
  type GameplayCameraDebugSnapshot,
} from './camera/GameplayCameraController';
import { DebugOverlay, type RenderMetricsSnapshot } from './debugOverlay';
import {
  CrowdPreviewController,
  createCrowdPreviewOverlay,
  resolveCrowdBenchmarkDurationSeconds,
  resolveCrowdPreviewCameraView,
  resolveCrowdPreviewCount,
  resolveCrowdPreviewEnabled,
  syncCrowdPreviewOverlay,
  type CrowdPreviewCameraView,
  type CrowdPreviewSnapshot,
} from './crowdPreview';
import {
  CrowdPresentationController,
  applyCrowdPresentationQuerySettings,
  createCrowdPresentationOverlay,
  loadCrowdPresentationSettings,
  syncCrowdPresentationOverlay,
  type CrowdPresentationSnapshot,
} from './presentation/CrowdPresentationController';
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
  type PassAuditSnapshot,
} from './playState';
import { createPassAuditOverlay, syncPassAuditOverlay } from './passAuditOverlay';
import { resolvePlaybookId } from './playbook';
import {
  PlayerPoseController,
  createPlayerPoseDebugOverlay,
  syncPlayerPoseDebugOverlay,
  type PlayerPoseSnapshot,
} from './presentation/PlayerPoseController';
import {
  RouteArtRenderer,
  createRouteAuditOverlay,
  syncRouteAuditOverlay,
  type RouteArtRendererSnapshot,
} from './presentation/RouteArtRenderer';
import {
  PRESENTATION_AUDIT_CONFIG,
  createCameraFramingSnapshot,
  createPresentationAuditGameplaySnapshot,
  createPresentationAuditOverlay,
  createPresentationAuditSnapshot,
  resolvePresentationAuditState,
  syncPresentationAuditOverlay,
  type CameraFramingSnapshot,
  type PresentationAuditSnapshot,
  type PresentationAuditState,
} from './presentationAudit';
import {
  createPresentationHardeningAuditOverlay,
  createPresentationHardeningAuditSnapshot,
  syncPresentationHardeningAuditOverlay,
  type PresentationHardeningAuditSnapshot,
} from './presentation/PresentationHardeningAudit';
import {
  PresentationHoldDirector,
  type PresentationHoldSnapshot,
} from './presentation/PresentationHoldDirector';
import { snapshotPlayerModel, type PlayerSnapshot } from './playerModel';
import { updatePlayerSimulation } from './playerSimulation';
import {
  createPlaceholderPlayerVisual,
  getPlayerBodyVisualSnapshot,
  resolvePlayerBodyVisualStyle,
  syncPlayerVisual,
  type PlayerBodyVisualSnapshot,
} from './playerVisual';
import {
  createBroadcastCaptions,
  syncBroadcastCaptions,
} from './ui/BroadcastCaptions';

declare global {
  interface Window {
    __footballDebug?: {
      forceQuarterbackPastLineForTest: () => boolean;
      getAudioSnapshot: () => RuntimeAudioDebugSnapshot;
      getAppearanceAuditSnapshot: () => AppearanceAuditSnapshot;
      getBallVisualSnapshot: () => BallVisualSnapshot;
      getCameraSnapshot: () => GameplayCameraDebugSnapshot;
      getCameraFramingSnapshot: () => CameraFramingSnapshot;
      getCrowdPresentationSnapshot: () => CrowdPresentationSnapshot | null;
      getCrowdPreviewSnapshot: () => CrowdPreviewSnapshot | null;
      getFormationPreviewSnapshot: () => FormationPreviewSnapshot | null;
      getGameplaySnapshot: () => GameplaySnapshot;
      getHelmetAssetSnapshot: () => HelmetAssetSnapshot;
      getPassAuditSnapshot: () => PassAuditSnapshot | null;
      getPresentationHardeningAuditSnapshot: () => PresentationHardeningAuditSnapshot | null;
      getPresentationHoldSnapshot: () => PresentationHoldSnapshot;
      getPresentationAuditSnapshot: () => PresentationAuditSnapshot | null;
      getPlayerBodyVisualSnapshots: () => PlayerBodyVisualSnapshot[];
      getPlayerPoseSnapshots: () => PlayerPoseSnapshot[];
      getPlayerSnapshot: () => PlayerSnapshot;
      getRenderMetrics: () => RenderMetricsSnapshot;
      getRouteArtSnapshot: () => RouteArtRendererSnapshot;
      playAudioTestOneShot: () => Promise<boolean>;
      setCrowdPreviewCameraView: (view: CrowdPreviewCameraView) => void;
      setAnnouncerEnabled: (enabled: boolean) => void;
      setAnnouncerVolume: (volume: number) => void;
      setAudioPageActiveForTest: (active: boolean) => void;
      setAudioMuted: (muted: boolean) => void;
      setCaptionsEnabled: (enabled: boolean) => void;
      startAudioTestLoop: () => Promise<boolean>;
      stopAudioTestLoop: () => boolean;
    };
  }
}

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app mount point');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101920);

const searchParams = new URLSearchParams(window.location.search);
const crowdPreviewEnabled = resolveCrowdPreviewEnabled(searchParams);
const crowdBenchmarkEnabled = crowdPreviewEnabled && searchParams.get('crowdBenchmark') === '1';
const crowdBenchmarkDurationSeconds = resolveCrowdBenchmarkDurationSeconds(
  searchParams.get('crowdBenchmarkDuration'),
);
const crowdPreviewCount = resolveCrowdPreviewCount(searchParams);
const crowdPreviewCameraView = resolveCrowdPreviewCameraView(searchParams.get('crowdCamera'));
const cameraDebugEnabled = searchParams.has('cameraDebug');
const cinematicsSetting = resolveCinematicsSetting(searchParams.get('cinematics'));
const shotPreview = resolvePresentationShotPreview(searchParams.get('shotPreview'));
const playerVisualOptions = {
  bodyStyle: resolvePlayerBodyVisualStyle(searchParams.get('playerBody')),
  debugRoleColors: searchParams.has('debugRoleColors'),
};
const ballVisualStyle = resolveBallVisualStyle(searchParams.get('ballVisual'));
const playerMotionEnabled = searchParams.get('playerMotion') !== '0';
const formationPreviewMode = resolveFormationPreviewMode(searchParams.get('formationPreview'));
const playbookId = resolvePlaybookId(searchParams.get('playbook') ?? searchParams.get('roster'));
const presentationAuditEnabled = searchParams.has('presentationAudit');
const routeAuditEnabled = searchParams.has('routeAudit');
const routeArtEnabled = searchParams.get('routeArt') !== '0';
const passAuditEnabled = searchParams.has('passAudit');
const appearanceAuditEnabled = searchParams.has('appearanceAudit');
const audioFeatureFlags = resolveAudioFeatureFlags(searchParams);
const commentaryDebugEnabled = searchParams.has('commentaryDebug');
const crowdPresentationSettings = applyCrowdPresentationQuerySettings(
  loadCrowdPresentationSettings(),
  searchParams,
);
const crowdPresentationDebugEnabled =
  searchParams.has('crowdDebug') ||
  (presentationAuditEnabled && !crowdPreviewEnabled);
let presentationAuditState: PresentationAuditState = resolvePresentationAuditState(
  searchParams.get('presentationState'),
);
const field = createFootballField({
  fieldAudit: searchParams.has('fieldAudit'),
});
scene.add(field.group);

const gameplayModel = createGameplayModel({ playbookId });
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

const ballVisual = createBallVisual({ style: ballVisualStyle });
syncBallVisual(ballVisual, gameplayModel.ball);
ballVisual.visible = !crowdPreviewEnabled;
scene.add(ballVisual);

const routeArtRenderer = new RouteArtRenderer({
  auditEnabled: routeAuditEnabled,
  enabled: routeArtEnabled,
});
scene.add(routeArtRenderer.group);

const cameraController = new GameplayCameraController({
  cinematics: cinematicsSetting,
  height: window.innerHeight,
  holdCinematicPreSnapEstablish: presentationAuditEnabled,
  initialMode: resolveGameplayCameraMode(searchParams.get('camera')),
  shotPreview,
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

const crowdPreviewController = crowdPreviewEnabled
  ? new CrowdPreviewController({
      benchmarkDurationSeconds: crowdBenchmarkDurationSeconds,
      benchmarkEnabled: crowdBenchmarkEnabled,
      height: window.innerHeight,
      requestedCount: crowdPreviewCount,
      view: crowdPreviewCameraView,
      width: window.innerWidth,
    })
  : null;

if (crowdPreviewController) {
  scene.add(crowdPreviewController.group);
}

const crowdPresentationController = !crowdPreviewController && crowdPresentationSettings.crowdVisualsEnabled
  ? new CrowdPresentationController({ settings: crowdPresentationSettings })
  : null;

if (crowdPresentationController) {
  scene.add(crowdPresentationController.group);
}

const ambientLight = new THREE.HemisphereLight(0xdde7ef, 0x344038, 2.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
directionalLight.position.set(-20, 45, -25);
scene.add(directionalLight);

const keyboardInput = new KeyboardMovementInput(window);
const playControls = new KeyboardPlayControls(
  window,
  gameplayModel.availablePlays.map((play) => play.id),
);
const audioMixer = new AudioMixer({
  flags: audioFeatureFlags,
  settings: applyAudioQuerySettings(loadAudioSettings(), searchParams),
  warn: (message) => {
    if (import.meta.env.DEV) {
      console.warn(message);
    }
  },
});
const gameAudioDirector = new GameAudioDirector(audioMixer);
const broadcastCommentaryDirector = new BroadcastCommentaryDirector(audioMixer, {
  enabled: audioFeatureFlags.announcerEnabled,
});
const presentationHoldDirector = new PresentationHoldDirector(cinematicsSetting);
gameAudioDirector.installControls(window);
gameAudioDirector.setPageActive(!document.hidden);
broadcastCommentaryDirector.setPageActive(!document.hidden);
const debugOverlay = new DebugOverlay({ renderer, player: getActivePrimaryPlayer() });
const gameplayHud = createGameplayHud();
const broadcastCaptions = createBroadcastCaptions();
const playCallUi = formationPreviewModel || crowdPreviewEnabled
  ? null
  : createPlayCallUi(gameplayModel.availablePlays);
const playerPoseController = new PlayerPoseController(undefined, {
  enabled: playerMotionEnabled,
});
const poseDebugOverlay = searchParams.has('poseDebug') ? createPlayerPoseDebugOverlay() : null;
const formationAuditOverlay = searchParams.has('formationAudit')
  ? createFormationAuditOverlay()
  : null;
const presentationAuditOverlay = presentationAuditEnabled
  ? createPresentationAuditOverlay()
  : null;
const routeAuditOverlay = routeAuditEnabled ? createRouteAuditOverlay() : null;
const passAuditOverlay = passAuditEnabled ? createPassAuditOverlay() : null;
const appearanceAuditOverlay = appearanceAuditEnabled ? createAppearanceAuditOverlay() : null;
const audioDebugOverlay = audioFeatureFlags.audioDebug || commentaryDebugEnabled
  ? createAudioDebugOverlay()
  : null;
const crowdPreviewOverlay = crowdPreviewController ? createCrowdPreviewOverlay() : null;
const crowdPresentationOverlay = crowdPresentationDebugEnabled && crowdPresentationController
  ? createCrowdPresentationOverlay()
  : null;
const presentationHardeningAuditOverlay = presentationAuditEnabled && !crowdPreviewController
  ? createPresentationHardeningAuditOverlay()
  : null;
let previousFrameTime = performance.now();
let hasRenderedFirstFrame = false;
let latestRenderMetrics: RenderMetricsSnapshot | null = null;

if (
  import.meta.env.DEV ||
  searchParams.has('debug') ||
  cameraDebugEnabled ||
  presentationAuditEnabled ||
  appearanceAuditEnabled ||
  audioFeatureFlags.audioDebug ||
  commentaryDebugEnabled ||
  crowdPresentationDebugEnabled ||
  crowdPreviewEnabled
) {
  window.__footballDebug = {
    forceQuarterbackPastLineForTest: () => {
      if (
        gameplayModel.playState !== 'live' ||
        gameplayModel.player.role !== 'quarterback'
      ) {
        return false;
      }

      gameplayModel.player.position.z = gameplayModel.drive.lineOfScrimmage.z + 0.25;
      gameplayModel.player.velocity.x = 0;
      gameplayModel.player.velocity.z = 0;
      return true;
    },
    getAudioSnapshot: () => getRuntimeAudioSnapshot(),
    getAppearanceAuditSnapshot: () => createAppearanceAuditSnapshot(playerVisuals),
    getBallVisualSnapshot: () => getBallVisualSnapshot(ballVisual),
    getCameraSnapshot: () => cameraController.getDebugSnapshot(),
    getCameraFramingSnapshot: () => getCameraFramingSnapshot(),
    getCrowdPresentationSnapshot: () => crowdPresentationController?.getSnapshot() ?? null,
    getCrowdPreviewSnapshot: () => crowdPreviewController?.getSnapshot() ?? null,
    getFormationPreviewSnapshot: () =>
      formationPreviewModel ? snapshotFormationPreviewModel(formationPreviewModel) : null,
    getGameplaySnapshot: () => getActivePresentationSnapshot(),
    getHelmetAssetSnapshot,
    getPassAuditSnapshot: () => getActivePresentationSnapshot().passAudit,
    getPresentationHardeningAuditSnapshot: () => getPresentationHardeningAuditSnapshot(),
    getPresentationHoldSnapshot: () => presentationHoldDirector.getSnapshot(),
    getPresentationAuditSnapshot: () => getPresentationAuditSnapshot(),
    getPlayerBodyVisualSnapshots: () =>
      [...playerVisuals.values()].map((playerVisual) => getPlayerBodyVisualSnapshot(playerVisual)),
    getPlayerPoseSnapshots: () => playerPoseController.getPoseSnapshots(),
    getPlayerSnapshot: () => snapshotPlayerModel(getActivePrimaryPlayer()),
    getRenderMetrics: () => latestRenderMetrics ?? createRenderMetricsSnapshot(0),
    getRouteArtSnapshot: () => routeArtRenderer.getSnapshot(),
    playAudioTestOneShot: () => gameAudioDirector.playTestOneShot(),
    setCrowdPreviewCameraView: (view: CrowdPreviewCameraView) => {
      crowdPreviewController?.setCameraView(view);
    },
    setAnnouncerEnabled: (enabled: boolean) => {
      broadcastCommentaryDirector.setAnnouncerEnabled(enabled);
    },
    setAnnouncerVolume: (volume: number) => {
      broadcastCommentaryDirector.setAnnouncerVolume(volume);
    },
    setAudioPageActiveForTest: (active: boolean) => {
      gameAudioDirector.setPageActive(active);
      broadcastCommentaryDirector.setPageActive(active);
    },
    setAudioMuted: (muted: boolean) => {
      gameAudioDirector.setMuted(muted);
    },
    setCaptionsEnabled: (enabled: boolean) => {
      broadcastCommentaryDirector.setCaptionsEnabled(enabled);
    },
    startAudioTestLoop: () => gameAudioDirector.startTestLoop(),
    stopAudioTestLoop: () => gameAudioDirector.stopTestLoop(),
  };
  window.addEventListener('keydown', handleDevelopmentCameraToggle);
}

if (formationPreviewModel) {
  window.addEventListener('keydown', handleFormationPreviewLaneControls);
}

if (presentationAuditEnabled) {
  window.addEventListener('keydown', handlePresentationAuditControls);
}

if (crowdPreviewController) {
  window.addEventListener('keydown', handleCrowdPreviewControls);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('visibilitychange', syncAudioPageActivity);
window.addEventListener('blur', syncAudioPageActivity);
window.addEventListener('focus', syncAudioPageActivity);

renderFrame(0);

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const delta = Math.min((now - previousFrameTime) / 1000, 0.1);
  previousFrameTime = now;

  renderFrame(delta);
});

function renderFrame(delta: number): void {
  if (crowdPreviewController) {
    crowdPreviewController.updateBeforeRender();
    renderer.render(scene, crowdPreviewController.camera);
    crowdPreviewController.recordFrame(delta, renderer);
    latestRenderMetrics = createRenderMetricsSnapshot(delta);

    if (crowdPreviewOverlay) {
      syncCrowdPreviewOverlay(crowdPreviewOverlay, crowdPreviewController.getSnapshot());
    }

    if (!hasRenderedFirstFrame) {
      hasRenderedFirstFrame = true;
      document.body.dataset.sceneReady = 'true';
    }

    return;
  }

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

    updateGameplayModel(gameplayModel, delta, {
      suppressDeadPlayReset: presentationHoldDirector.shouldHoldDeadPlayReset(),
    });
  }

  const gameplaySnapshot = getActivePresentationSnapshot();
  gameAudioDirector.update(gameplaySnapshot, delta);
  const presentationEvents = gameAudioDirector.getSnapshot().recentEvents;
  presentationHoldDirector.update(presentationEvents, delta);
  crowdPresentationController?.update(gameplaySnapshot, presentationEvents, delta);
  if (!formationPreviewModel) {
    broadcastCommentaryDirector.update(gameplaySnapshot, delta);
  }
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
  routeArtRenderer.update(gameplaySnapshot, gameplayModel.selectedPlay);
  playerPoseController.update(gameplaySnapshot, playerVisuals, delta);
  cameraController.update(gameplaySnapshot, delta, {
    crowdCutawaysEnabled: !!crowdPresentationController &&
      crowdPresentationSettings.crowdVisualsEnabled &&
      crowdPresentationSettings.crowdReactionsEnabled,
    presentationEvents,
  });
  syncGameplayHud(gameplayHud, gameplaySnapshot);
  syncBroadcastCaptions(broadcastCaptions, broadcastCommentaryDirector.getSnapshot());
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
  crowdPresentationController?.recordFrame(delta, renderer);
  if (shouldCollectPresentationDiagnostics()) {
    latestRenderMetrics = createRenderMetricsSnapshot(delta);
  }
  if (presentationAuditOverlay) {
    syncPresentationAuditOverlay(
      presentationAuditOverlay,
      getPresentationAuditSnapshot() ?? createEmptyPresentationAuditSnapshot(),
    );
  }
  if (routeAuditOverlay) {
    syncRouteAuditOverlay(routeAuditOverlay, routeArtRenderer.getSnapshot());
  }
  if (passAuditOverlay) {
    syncPassAuditOverlay(passAuditOverlay, gameplaySnapshot.passAudit);
  }
  if (appearanceAuditOverlay) {
    syncAppearanceAuditOverlay(
      appearanceAuditOverlay,
      createAppearanceAuditSnapshot(playerVisuals),
    );
  }
  if (audioDebugOverlay) {
    syncAudioDebugOverlay(audioDebugOverlay, getRuntimeAudioSnapshot());
  }
  if (crowdPresentationOverlay && crowdPresentationController) {
    syncCrowdPresentationOverlay(crowdPresentationOverlay, crowdPresentationController.getSnapshot());
  }
  if (presentationHardeningAuditOverlay) {
    const snapshot = getPresentationHardeningAuditSnapshot();
    if (snapshot) {
      syncPresentationHardeningAuditOverlay(presentationHardeningAuditOverlay, snapshot);
    }
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

  if (requests.startPlay || requests.resetPlay || requests.restartChallenge) {
    cameraController.skipPresentationShot();
    presentationHoldDirector.skip();
    crowdPresentationController?.skipReactionHold();
  }

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
    cameraController.resetPresentation();
    event.preventDefault();
    return;
  }

  if (event.key === '2') {
    setFormationPreviewSnapLane(formationPreviewModel, 'middle');
    cameraController.resetPresentation();
    event.preventDefault();
    return;
  }

  if (event.key === '3') {
    setFormationPreviewSnapLane(formationPreviewModel, 'rightHash');
    cameraController.resetPresentation();
    event.preventDefault();
  }
}

function handlePresentationAuditControls(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.key.toLowerCase() === 'l') {
    presentationAuditState = 'locomotionPreview';
    event.preventDefault();
    return;
  }

  if (event.key.toLowerCase() === 'p') {
    presentationAuditState = 'preSnap';
    cameraController.resetPresentation();
    event.preventDefault();
  }
}

function handleCrowdPreviewControls(event: KeyboardEvent): void {
  if (!crowdPreviewController || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.key === '1') {
    crowdPreviewController.setCameraView('wide');
    event.preventDefault();
    return;
  }

  if (event.key === '2') {
    crowdPreviewController.setCameraView('sideline');
    event.preventDefault();
    return;
  }

  if (event.key === '3') {
    crowdPreviewController.setCameraView('endZone');
    event.preventDefault();
    return;
  }

  if (event.key === '4') {
    crowdPreviewController.setCameraView('close');
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
  if (crowdPreviewController) {
    crowdPreviewController.resize(width, height);
  } else {
    cameraController.resize(width, height);
  }
}

function syncAudioPageActivity(): void {
  const pageActive = !document.hidden && document.hasFocus();
  gameAudioDirector.setPageActive(pageActive);
  broadcastCommentaryDirector.setPageActive(pageActive);
  crowdPresentationController?.setPageActive(pageActive);
}

function getActivePlayers() {
  if (crowdPreviewEnabled) {
    return [];
  }

  return formationPreviewModel?.players ?? gameplayModel.players;
}

function getActivePrimaryPlayer() {
  return formationPreviewModel
    ? formationPreviewModel.players.find((player) => player.id === 'offense-qb') ?? formationPreviewModel.players[0]
    : gameplayModel.player;
}

function getActiveGameplaySnapshot(): GameplaySnapshot {
  const snapshot = formationPreviewModel
    ? snapshotFormationPreviewAsGameplay(formationPreviewModel)
    : snapshotGameplayModel(gameplayModel);

  if (crowdPreviewEnabled) {
    return {
      ...snapshot,
      players: [],
    };
  }

  return snapshot;
}

function getActivePresentationSnapshot(): GameplaySnapshot {
  const snapshot = getActiveGameplaySnapshot();

  if (!presentationAuditEnabled || !formationPreviewModel) {
    return snapshot;
  }

  return createPresentationAuditGameplaySnapshot(snapshot, presentationAuditState);
}

function getRuntimeAudioSnapshot(): RuntimeAudioDebugSnapshot {
  return {
    ...gameAudioDirector.getSnapshot(),
    commentary: broadcastCommentaryDirector.getSnapshot(),
  };
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
  return createCameraFramingSnapshot(
    cameraController.camera,
    playerVisuals,
    presentationAuditEnabled ? PRESENTATION_AUDIT_CONFIG.framingMarginNdc : 0,
  );
}

function getPresentationAuditSnapshot(): PresentationAuditSnapshot | null {
  if (!presentationAuditEnabled) {
    return null;
  }

  return createPresentationAuditSnapshot({
    camera: cameraController.camera,
    cameraDebug: cameraController.getDebugSnapshot(),
    formation: formationPreviewModel ? snapshotFormationPreviewModel(formationPreviewModel) : null,
    gameplay: getActivePresentationSnapshot(),
    playerMotionEnabled,
    playerVisuals,
    poseSnapshots: playerPoseController.getPoseSnapshots(),
    renderMetrics: latestRenderMetrics,
    state: presentationAuditState,
  });
}

function getPresentationHardeningAuditSnapshot(): PresentationHardeningAuditSnapshot | null {
  if (!presentationAuditEnabled && !crowdPresentationDebugEnabled) {
    return null;
  }

  const gameplaySnapshot = getActivePresentationSnapshot();

  return createPresentationHardeningAuditSnapshot({
    audio: getRuntimeAudioSnapshot(),
    camera: cameraController.getDebugSnapshot(),
    cinematics: cinematicsSetting,
    crowd: crowdPresentationController?.getSnapshot() ?? null,
    crowdSettings: crowdPresentationSettings,
    currentResultType: gameplaySnapshot.lastPlayResult?.type ?? null,
    hold: presentationHoldDirector.getSnapshot(),
    renderMetrics: latestRenderMetrics,
  });
}

function shouldCollectPresentationDiagnostics(): boolean {
  return debugOverlay.isVisible() ||
    !!poseDebugOverlay ||
    !!presentationAuditOverlay ||
    !!routeAuditOverlay ||
    !!passAuditOverlay ||
    !!appearanceAuditOverlay ||
    !!crowdPresentationOverlay ||
    !!presentationHardeningAuditOverlay;
}

function createEmptyPresentationAuditSnapshot(): PresentationAuditSnapshot {
  return {
    allFeetGrounded: true,
    allHelmetsAttached: true,
    allPlayersInsideFramingMargin: true,
    cameraMode: cameraController.getDebugSnapshot().mode,
    cameraState: cameraController.getDebugSnapshot().state,
    enabled: true,
    formationIssueCount: 0,
    framingMarginNdc: PRESENTATION_AUDIT_CONFIG.framingMarginNdc,
    issues: [],
    playerMotionEnabled,
    players: [],
    presentationPhase: cameraController.getDebugSnapshot().presentationPhase ?? null,
    renderMetrics: null,
    snapLane: formationPreviewModel?.snapPlacement.lane ?? gameplayModel.drive.snapLane,
    stableHelmetGaps: true,
    state: presentationAuditState,
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
