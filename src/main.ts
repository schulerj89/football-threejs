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
  createAppearanceAuditOverlay,
  createAppearanceAuditSnapshot,
  syncAppearanceAuditOverlay,
  type AppearanceAuditSnapshot,
} from './appearanceAuditOverlay';
import {
  GameplayCameraController,
  resolvePresentationShotPreview,
  type GameplayCameraDebugSnapshot,
} from './camera/GameplayCameraController';
import {
  createGameExperienceDebugSnapshot,
  resolveGameExperienceSettings,
  saveGameExperienceSettings,
  toGameplayCameraMode,
  type GameExperienceDebugSnapshot,
  type GameExperienceSettings,
  type ResolvedGameExperienceSettings,
} from './config/GameExperienceSettings';
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
  createCrowdPresentationOverlay,
  syncCrowdPresentationOverlay,
  type CrowdPresentationSnapshot,
} from './presentation/CrowdPresentationController';
import {
  createElevenAuditOverlay,
  createElevenAuditSnapshot,
  syncElevenAuditOverlay,
  type ElevenAuditSnapshot,
} from './elevenOnElevenAudit';
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
  toggleFormationPreviewPreferredSide,
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
import {
  createSevenAuditOverlay,
  createSevenAuditSnapshot,
  syncSevenAuditOverlay,
  type SevenAuditSnapshot,
} from './sevenOnSevenAudit';
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
import {
  GamePresentationRuntime,
  type GamePresentationRuntimeSnapshot,
} from './presentation/GamePresentationRuntime';
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
import { GameSetupScreen } from './ui/GameSetupScreen';
import { PauseSettingsPanel } from './ui/PauseSettingsPanel';
import { TitleScreen, type TitleLoadingState } from './ui/TitleScreen';

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
      getGameExperienceSnapshot: () => GameExperienceDebugSnapshot;
      getGameplaySnapshot: () => GameplaySnapshot;
      getGamePresentationRuntimeSnapshot: () => GamePresentationRuntimeSnapshot;
      getHelmetAssetSnapshot: () => HelmetAssetSnapshot;
      getPassAuditSnapshot: () => PassAuditSnapshot | null;
      getElevenAuditSnapshot: () => ElevenAuditSnapshot | null;
      getPresentationHardeningAuditSnapshot: () => PresentationHardeningAuditSnapshot | null;
      getPresentationHoldSnapshot: () => PresentationHoldSnapshot;
      getPresentationAuditSnapshot: () => PresentationAuditSnapshot | null;
      getSevenAuditSnapshot: () => SevenAuditSnapshot | null;
      getPlayerBodyVisualSnapshots: () => PlayerBodyVisualSnapshot[];
      getPlayerPoseSnapshots: () => PlayerPoseSnapshot[];
      getPlayerSnapshot: () => PlayerSnapshot;
      getRenderMetrics: () => RenderMetricsSnapshot;
      getRouteArtSnapshot: () => RouteArtRendererSnapshot;
      playAudioTestOneShot: () => Promise<boolean>;
      runElevenAuditResetCycles: (cycles?: number) => ElevenAuditResetCycleResult | null;
      runSevenAuditResetCycles: (cycles?: number) => SevenAuditResetCycleResult | null;
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

interface SevenAuditResetCycleResourceSnapshot {
  activeAudioNodes: number;
  activePlayerRootCount: number;
  geometryCount: number;
  materialCount: number;
  presentationHistoryCount: number;
  visualRootCount: number;
}

interface SevenAuditResetCycleResult {
  after: SevenAuditResetCycleResourceSnapshot;
  before: SevenAuditResetCycleResourceSnapshot;
  cycles: number;
}

interface ElevenAuditResetCycleResourceSnapshot extends SevenAuditResetCycleResourceSnapshot {
  activeCameraShot: string | null;
  activePresentationHold: boolean;
  crowdReaction: string | null;
  helmetInstanceCount: number;
}

interface ElevenAuditResetCycleResult {
  after: ElevenAuditResetCycleResourceSnapshot;
  before: ElevenAuditResetCycleResourceSnapshot;
  cycles: number;
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
const shotPreview = resolvePresentationShotPreview(searchParams.get('shotPreview'));
let gameExperience: ResolvedGameExperienceSettings = resolveGameExperienceSettings({ searchParams });
let effectiveExperienceSettings = gameExperience.settings;
let cinematicsSetting = effectiveExperienceSettings.cinematics;
const playerVisualOptions = {
  bodyStyle: resolvePlayerBodyVisualStyle(searchParams.get('playerBody')),
  debugRoleColors: searchParams.has('debugRoleColors'),
};
const ballVisualStyle = resolveBallVisualStyle(searchParams.get('ballVisual'));
let playerMotionEnabled = effectiveExperienceSettings.playerMotionEnabled;
const formationPreviewMode = resolveFormationPreviewMode(searchParams.get('formationPreview'));
let playbookId = effectiveExperienceSettings.playbookId;
const presentationAuditEnabled = searchParams.has('presentationAudit');
const routeAuditEnabled = searchParams.has('routeAudit');
let routeArtEnabled = effectiveExperienceSettings.routeArtEnabled;
const passAuditEnabled = searchParams.has('passAudit');
const sevenAuditEnabled = searchParams.has('sevenAudit');
const elevenAuditEnabled = searchParams.has('elevenAudit');
const appearanceAuditEnabled = searchParams.has('appearanceAudit');
let audioFeatureFlags = gameExperience.audioFeatureFlags;
const commentaryDebugEnabled = searchParams.has('commentaryDebug');
let crowdPresentationSettings = gameExperience.crowdPresentationSettings;
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

let gameplayModel = createGameplayModel({ playbookId });
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

let cameraController = new GameplayCameraController({
  cinematics: cinematicsSetting,
  height: window.innerHeight,
  holdCinematicPreSnapEstablish: presentationAuditEnabled,
  initialMode: toGameplayCameraMode(effectiveExperienceSettings.gameplayCamera),
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

let crowdPresentationController = !crowdPreviewController && crowdPresentationSettings.crowdVisualsEnabled
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
let playControls = new KeyboardPlayControls(
  window,
  gameplayModel.availablePlays.map((play) => play.id),
);
const audioMixer = new AudioMixer({
  flags: audioFeatureFlags,
  settings: gameExperience.audioSettings,
  warn: (message) => {
    if (import.meta.env.DEV) {
      console.warn(message);
    }
  },
});
const gameAudioDirector = new GameAudioDirector(audioMixer);
const broadcastCommentaryDirector = new BroadcastCommentaryDirector(audioMixer, {
  enabled: true,
});
let presentationHoldDirector = new PresentationHoldDirector(cinematicsSetting);
const gamePresentationRuntime = new GamePresentationRuntime({
  commentaryDirector: broadcastCommentaryDirector,
  gameAudioDirector,
  getCrowdController: () => crowdPresentationController,
  getHoldDirector: () => presentationHoldDirector,
});
gameAudioDirector.installControls(window);
gamePresentationRuntime.setPageActive(!document.hidden && document.hasFocus());
const debugOverlay = new DebugOverlay({ renderer, player: getActivePrimaryPlayer() });
const gameplayHud = createGameplayHud();
const broadcastCaptions = createBroadcastCaptions();
let playCallUi = formationPreviewModel || crowdPreviewEnabled
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
const sevenAuditOverlay = sevenAuditEnabled ? createSevenAuditOverlay() : null;
const elevenAuditOverlay = elevenAuditEnabled ? createElevenAuditOverlay() : null;
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
type AppPhase = 'gameplay' | 'title';

const normalLaunchShouldShowTitle =
  !crowdPreviewEnabled &&
  !formationPreviewMode &&
  searchParams.toString().length === 0;
let appPhase: AppPhase = normalLaunchShouldShowTitle ? 'title' : 'gameplay';
const titleSetupScreen = !crowdPreviewEnabled && !formationPreviewModel
  ? new GameSetupScreen({
      initialSettings: effectiveExperienceSettings,
      onSettingsChange: handleTitleSettingsChange,
    })
  : null;
const titleScreen = titleSetupScreen
  ? new TitleScreen({
      onStart: startGameFromTitle,
      setupElement: titleSetupScreen.root,
    })
  : null;
const pauseSetupScreen = !crowdPreviewEnabled && !formationPreviewModel
  ? new GameSetupScreen({
      initialSettings: effectiveExperienceSettings,
      onSettingsChange: handlePauseSettingsChange,
      showGameMode: false,
    })
  : null;
const pauseSettingsPanel = pauseSetupScreen
  ? new PauseSettingsPanel({
      onClose: () => setPauseSettingsVisible(false),
      onReturnToTitle: returnToTitleScreen,
      setupElement: pauseSetupScreen.root,
    })
  : null;
let previousFrameTime = performance.now();
let hasRenderedFirstFrame = false;
let latestRenderMetrics: RenderMetricsSnapshot | null = null;

titleScreen?.setVisible(appPhase === 'title');
syncApplicationChrome();

if (
  import.meta.env.DEV ||
  searchParams.has('debug') ||
  cameraDebugEnabled ||
  presentationAuditEnabled ||
  appearanceAuditEnabled ||
  sevenAuditEnabled ||
  elevenAuditEnabled ||
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
    getGameExperienceSnapshot: () => getGameExperienceSnapshot(),
    getGameplaySnapshot: () => getActivePresentationSnapshot(),
    getGamePresentationRuntimeSnapshot: () => gamePresentationRuntime.getSnapshot(),
    getHelmetAssetSnapshot,
    getPassAuditSnapshot: () => getActivePresentationSnapshot().passAudit,
    getElevenAuditSnapshot: () => getElevenAuditSnapshot(),
    getPresentationHardeningAuditSnapshot: () => getPresentationHardeningAuditSnapshot(),
    getPresentationHoldSnapshot: () => presentationHoldDirector.getSnapshot(),
    getPresentationAuditSnapshot: () => getPresentationAuditSnapshot(),
    getSevenAuditSnapshot: () => getSevenAuditSnapshot(),
    getPlayerBodyVisualSnapshots: () =>
      [...playerVisuals.values()].map((playerVisual) => getPlayerBodyVisualSnapshot(playerVisual)),
    getPlayerPoseSnapshots: () => playerPoseController.getPoseSnapshots(),
    getPlayerSnapshot: () => snapshotPlayerModel(getActivePrimaryPlayer()),
    getRenderMetrics: () => latestRenderMetrics ?? createRenderMetricsSnapshot(0),
    getRouteArtSnapshot: () => routeArtRenderer.getSnapshot(),
    playAudioTestOneShot: () => gameAudioDirector.playTestOneShot(),
    runElevenAuditResetCycles: (cycles = 100) => runElevenAuditResetCycles(cycles),
    runSevenAuditResetCycles: (cycles = 100) => runSevenAuditResetCycles(cycles),
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
      gamePresentationRuntime.setPageActive(active);
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

if (!crowdPreviewController && !formationPreviewModel) {
  window.addEventListener('keydown', handlePauseSettingsShortcut);
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
  } else if (appPhase !== 'gameplay' || pauseSettingsPanel?.isVisible()) {
    playControls.consumeRequests();
    gameplayModel.player.velocity.x = 0;
    gameplayModel.player.velocity.z = 0;
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
  const gameplayPresentationActive = appPhase === 'gameplay' && !pauseSettingsPanel?.isVisible();
  const presentationEvents = gamePresentationRuntime.update(gameplaySnapshot, delta, {
    active: gameplayPresentationActive,
    commentaryActive: !formationPreviewModel,
  });
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
  gamePresentationRuntime.recordCameraSnapshot(cameraController.getDebugSnapshot());
  syncGameplayHud(gameplayHud, gameplaySnapshot);
  syncBroadcastCaptions(broadcastCaptions, broadcastCommentaryDirector.getSnapshot());
  if (playCallUi && appPhase === 'gameplay' && !pauseSettingsPanel?.isVisible()) {
    syncPlayCallUi(playCallUi, gameplaySnapshot);
  } else {
    playCallUi?.hide();
  }
  if (poseDebugOverlay) {
    syncPlayerPoseDebugOverlay(poseDebugOverlay, playerPoseController.getPoseSnapshots());
  }
  if (formationAuditOverlay) {
    const formationPreviewSnapshot = formationPreviewModel
      ? snapshotFormationPreviewModel(formationPreviewModel)
      : null;
    syncFormationAuditOverlay(
      formationAuditOverlay,
      gameplayModel,
      formationPreviewModel?.formation,
      formationPreviewSnapshot
        ? {
            labels: formationPreviewSnapshot.labels,
            previewName: `${formationPreviewSnapshot.mode} Formation Preview`,
          }
        : undefined,
    );
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
  if (sevenAuditOverlay) {
    const snapshot = getSevenAuditSnapshot();
    if (snapshot) {
      syncSevenAuditOverlay(sevenAuditOverlay, snapshot);
    }
  }
  if (elevenAuditOverlay) {
    const snapshot = getElevenAuditSnapshot();
    if (snapshot) {
      syncElevenAuditOverlay(elevenAuditOverlay, snapshot);
    }
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
  syncTitleLoadingState();
  syncApplicationChrome();

  if (!hasRenderedFirstFrame) {
    hasRenderedFirstFrame = true;
    document.body.dataset.sceneReady = 'true';
  }
}

function updatePlayControls(): void {
  const requests = playControls.consumeRequests();

  if (requests.startPlay || requests.resetPlay || requests.restartChallenge) {
    cameraController.skipPresentationShot();
    gamePresentationRuntime.skipPresentation();
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

function startGameFromTitle(): void {
  const selectedSettings = titleSetupScreen?.getSettings() ?? effectiveExperienceSettings;
  applyExperienceSettings(selectedSettings, { persist: true });
  rebuildGameplayForPlaybook(effectiveExperienceSettings.playbookId, true);
  appPhase = 'gameplay';
  titleScreen?.setVisible(false);
  setPauseSettingsVisible(false);
  void audioMixer.unlockFromUserGesture();
  cameraController.resetPresentation();
  syncApplicationChrome();
}

function handleTitleSettingsChange(settings: GameExperienceSettings): void {
  applyExperienceSettings(settings, { persist: true });
}

function handlePauseSettingsChange(settings: GameExperienceSettings): void {
  applyExperienceSettings({
    ...settings,
    playbookId,
  }, { persist: true });
}

function applyExperienceSettings(
  settings: GameExperienceSettings,
  options: { persist?: boolean } = {},
): void {
  const previousPlaybookId = playbookId;
  const previousCameraSetting = effectiveExperienceSettings.gameplayCamera;
  const previousCinematicsSetting = cinematicsSetting;
  const previousCrowdSettings = crowdPresentationSettings;

  if (options.persist ?? true) {
    saveGameExperienceSettings(settings);
  }

  gameExperience = resolveGameExperienceSettings({
    audioSettings: audioMixer.getSettings(),
    crowdPresentationSettings,
    searchParams,
  });
  effectiveExperienceSettings = gameExperience.settings;
  cinematicsSetting = effectiveExperienceSettings.cinematics;
  playerMotionEnabled = effectiveExperienceSettings.playerMotionEnabled;
  playbookId = effectiveExperienceSettings.playbookId;
  routeArtEnabled = effectiveExperienceSettings.routeArtEnabled;
  audioFeatureFlags = gameExperience.audioFeatureFlags;
  crowdPresentationSettings = gameExperience.crowdPresentationSettings;

  audioMixer.setFeatureFlags(audioFeatureFlags);
  audioMixer.setSettings(gameExperience.audioSettings);
  broadcastCommentaryDirector.setAnnouncerEnabled(effectiveExperienceSettings.announcerEnabled);
  broadcastCommentaryDirector.setCaptionsEnabled(effectiveExperienceSettings.captionsEnabled);

  if (
    previousCameraSetting !== effectiveExperienceSettings.gameplayCamera ||
    previousCinematicsSetting !== cinematicsSetting
  ) {
    recreateCameraController();
  }
  presentationHoldDirector = new PresentationHoldDirector(cinematicsSetting);

  if (!areCrowdSettingsEqual(previousCrowdSettings, crowdPresentationSettings)) {
    rebuildCrowdPresentationController();
  }

  if (previousPlaybookId !== playbookId) {
    rebuildGameplayForPlaybook(playbookId);
  }

  titleSetupScreen?.setSettings(effectiveExperienceSettings);
  pauseSetupScreen?.setSettings(effectiveExperienceSettings);
  syncTitleLoadingState();
  syncApplicationChrome();
}

function rebuildGameplayForPlaybook(
  nextPlaybookId: GameExperienceSettings['playbookId'],
  force = false,
): void {
  if (!force && gameplayModel.playbookId === nextPlaybookId) {
    return;
  }

  gameplayModel = createGameplayModel({ playbookId: nextPlaybookId });
  playControls.dispose();
  playControls = new KeyboardPlayControls(
    window,
    gameplayModel.availablePlays.map((play) => play.id),
  );
  playCallUi?.setPlays(gameplayModel.availablePlays);
  reconcilePlayerVisuals();
  syncBallVisual(ballVisual, gameplayModel.ball);
  cameraController.resetPresentation();
}

function reconcilePlayerVisuals(): void {
  const activePlayers = getActivePlayers();
  const activeIds = new Set(activePlayers.map((player) => player.id));

  for (const [playerId, playerVisual] of [...playerVisuals.entries()]) {
    if (activeIds.has(playerId)) {
      continue;
    }

    scene.remove(playerVisual);
    playerVisuals.delete(playerId);
  }

  for (const gamePlayer of activePlayers) {
    let playerVisual = playerVisuals.get(gamePlayer.id);
    if (!playerVisual) {
      playerVisual = createPlaceholderPlayerVisual(gamePlayer, playerVisualOptions);
      playerVisuals.set(gamePlayer.id, playerVisual);
      scene.add(playerVisual);
    }
    syncPlayerVisual(playerVisual, gamePlayer, playerVisualOptions);
    syncHelmetTeamMaterials(playerVisual, gamePlayer);
  }

  attachHelmetsToPlayerVisuals(playerVisuals, activePlayers);
}

function recreateCameraController(): void {
  cameraController = new GameplayCameraController({
    cinematics: cinematicsSetting,
    height: window.innerHeight,
    holdCinematicPreSnapEstablish: presentationAuditEnabled,
    initialMode: toGameplayCameraMode(effectiveExperienceSettings.gameplayCamera),
    shotPreview,
    width: window.innerWidth,
  });
}

function rebuildCrowdPresentationController(): void {
  if (crowdPresentationController) {
    scene.remove(crowdPresentationController.group);
    crowdPresentationController.dispose();
    crowdPresentationController = null;
  }

  if (crowdPreviewController || !crowdPresentationSettings.crowdVisualsEnabled) {
    return;
  }

  crowdPresentationController = new CrowdPresentationController({
    settings: crowdPresentationSettings,
  });
  crowdPresentationController.setPageActive(!document.hidden && document.hasFocus());
  scene.add(crowdPresentationController.group);
}

function setPauseSettingsVisible(visible: boolean): void {
  if (!pauseSettingsPanel) {
    return;
  }

  const canOpen = appPhase === 'gameplay' &&
    (gameplayModel.playState === 'preSnap' || gameplayModel.playState === 'dead');
  const nextVisible = visible && canOpen;
  pauseSettingsPanel.setVisible(nextVisible);
  if (nextVisible) {
    pauseSetupScreen?.setSettings(effectiveExperienceSettings);
  }
  syncApplicationChrome();
}

function returnToTitleScreen(): void {
  if (!titleScreen) {
    setPauseSettingsVisible(false);
    return;
  }

  appPhase = 'title';
  setPauseSettingsVisible(false);
  titleSetupScreen?.setSettings(effectiveExperienceSettings);
  titleScreen.setVisible(true);
  syncApplicationChrome();
}

function handlePauseSettingsShortcut(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key !== 'Escape') {
    return;
  }

  if (pauseSettingsPanel?.isVisible()) {
    setPauseSettingsVisible(false);
    event.preventDefault();
    return;
  }

  if (
    appPhase === 'gameplay' &&
    (gameplayModel.playState === 'preSnap' || gameplayModel.playState === 'dead')
  ) {
    setPauseSettingsVisible(true);
    event.preventDefault();
  }
}

function syncApplicationChrome(): void {
  document.body.dataset.appPhase = appPhase;
  gameplayHud.root.hidden = appPhase !== 'gameplay';
  if (appPhase !== 'gameplay') {
    playCallUi?.hide();
    broadcastCaptions.hidden = true;
    broadcastCaptions.textContent = '';
  }
}

function syncTitleLoadingState(): void {
  if (!titleScreen) {
    return;
  }

  titleScreen.syncLoadingState(createTitleLoadingState());
}

function createTitleLoadingState(): TitleLoadingState {
  const helmetSnapshot = getHelmetAssetSnapshot();
  const audioSnapshot = getRuntimeAudioSnapshot();
  const crowdSnapshot = crowdPresentationController?.getSnapshot() ?? null;
  const audioStatus = effectiveExperienceSettings.audioEnabled
    ? audioSnapshot.userGestureUnlocked
      ? `Ready (${audioSnapshot.contextState})`
      : 'Ready after Start'
    : 'Disabled';
  const crowdStatus = effectiveExperienceSettings.crowdVisualsEnabled
    ? crowdSnapshot
      ? `Ready (${crowdSnapshot.actualSpectatorCount})`
      : 'Initializing'
    : 'Disabled';
  const developmentDetails = import.meta.env.DEV
    ? [
        audioSnapshot.missingOptionalAssetIds.length > 0
          ? `Missing optional audio: ${audioSnapshot.missingOptionalAssetIds.length}`
          : '',
      ]
    : [];

  return {
    audio: audioStatus,
    crowd: crowdStatus,
    developmentDetails,
    helmet: helmetSnapshot.status,
  };
}

function areCrowdSettingsEqual(
  a: typeof crowdPresentationSettings,
  b: typeof crowdPresentationSettings,
): boolean {
  return a.crowdDensity === b.crowdDensity &&
    a.crowdReactionsEnabled === b.crowdReactionsEnabled &&
    a.crowdVisualsEnabled === b.crowdVisualsEnabled;
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
    return;
  }

  if (event.key === '4' && formationPreviewModel.mode === '11v11') {
    toggleFormationPreviewPreferredSide(formationPreviewModel);
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
  gamePresentationRuntime.setPageActive(pageActive);
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

function getGameExperienceSnapshot(): GameExperienceDebugSnapshot {
  const audioSnapshot = getRuntimeAudioSnapshot();
  const crowdSnapshot = crowdPresentationController?.getSnapshot() ?? null;

  return createGameExperienceDebugSnapshot(gameExperience, {
    audioEnabled: audioSnapshot.enabled,
    crowdSpectatorCount: crowdSnapshot?.actualSpectatorCount ?? 0,
    crowdVisualsAllocated: !!crowdPresentationController,
    decodedAudioBytes: audioSnapshot.decodedBufferBytes,
    loadedAudioAssetIds: audioSnapshot.loadedAssetIds,
    loadedCompressedAudioBytes: audioSnapshot.loadedCompressedBytes,
    missingOptionalAudioAssetIds: audioSnapshot.missingOptionalAssetIds,
    streamedAudioAssetIds: audioSnapshot.streamedAssetIds,
  });
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
    !!sevenAuditOverlay ||
    !!elevenAuditOverlay ||
    !!appearanceAuditOverlay ||
    !!crowdPresentationOverlay ||
    !!presentationHardeningAuditOverlay;
}

function getElevenAuditSnapshot(): ElevenAuditSnapshot | null {
  if (!elevenAuditEnabled) {
    return null;
  }

  const renderMetrics = latestRenderMetrics ?? createRenderMetricsSnapshot(0);
  const presentationSnapshot = gamePresentationRuntime.getSnapshot();
  const crowdSnapshot = crowdPresentationController?.getSnapshot() ?? null;

  return createElevenAuditSnapshot({
    activeAudioNodes: getRuntimeAudioSnapshot().activeAudioNodeCount,
    cameraContainment: getCameraFramingSnapshot(),
    crowdReaction: crowdSnapshot?.reactionState ?? null,
    gameplay: getActivePresentationSnapshot(),
    helmetInstanceCount: getHelmetAssetSnapshot().attachedPlayerIds.length,
    materialCount: renderMetrics.sceneMaterialCount,
    play: gameplayModel.selectedPlay,
    playerVisualCount: playerVisuals.size,
    presentation: presentationSnapshot,
    presentationHold: presentationHoldDirector.getSnapshot(),
    renderMetrics,
  });
}

function getSevenAuditSnapshot(): SevenAuditSnapshot | null {
  if (!sevenAuditEnabled) {
    return null;
  }

  const renderMetrics = latestRenderMetrics ?? createRenderMetricsSnapshot(0);

  return createSevenAuditSnapshot({
    activeAudioNodes: getRuntimeAudioSnapshot().activeAudioNodeCount,
    gameplay: getActivePresentationSnapshot(),
    materialCount: renderMetrics.sceneMaterialCount,
    play: gameplayModel.selectedPlay,
    playerVisualCount: playerVisuals.size,
    presentation: gamePresentationRuntime.getSnapshot(),
    renderMetrics,
  });
}

function runElevenAuditResetCycles(cycles: number): ElevenAuditResetCycleResult | null {
  if (crowdPreviewController || formationPreviewModel || gameplayModel.playbookId !== '11v11') {
    return null;
  }

  const cycleCount = Math.max(0, Math.min(500, Math.floor(cycles)));
  const before = createElevenAuditResetCycleResourceSnapshot();

  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    if (gameplayModel.playState !== 'preSnap') {
      resetPlay(gameplayModel);
    }

    startPlay(gameplayModel);
    resetPlay(gameplayModel);
    reconcilePlayerVisuals();
    syncBallVisual(ballVisual, gameplayModel.ball);
    routeArtRenderer.update(snapshotGameplayModel(gameplayModel), gameplayModel.selectedPlay);
    presentationHoldDirector.skip();
    gamePresentationRuntime.skipPresentation();
  }

  return {
    after: createElevenAuditResetCycleResourceSnapshot(),
    before,
    cycles: cycleCount,
  };
}

function runSevenAuditResetCycles(cycles: number): SevenAuditResetCycleResult | null {
  if (crowdPreviewController || formationPreviewModel) {
    return null;
  }

  const cycleCount = Math.max(0, Math.min(500, Math.floor(cycles)));
  const before = createSevenAuditResetCycleResourceSnapshot();

  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    if (gameplayModel.playState !== 'preSnap') {
      resetPlay(gameplayModel);
    }

    startPlay(gameplayModel);
    resetPlay(gameplayModel);
    reconcilePlayerVisuals();
    syncBallVisual(ballVisual, gameplayModel.ball);
    routeArtRenderer.update(snapshotGameplayModel(gameplayModel), gameplayModel.selectedPlay);
    gamePresentationRuntime.skipPresentation();
  }

  return {
    after: createSevenAuditResetCycleResourceSnapshot(),
    before,
    cycles: cycleCount,
  };
}

function createElevenAuditResetCycleResourceSnapshot(): ElevenAuditResetCycleResourceSnapshot {
  const metrics = createRenderMetricsSnapshot(0);
  const audio = getRuntimeAudioSnapshot();
  const hold = presentationHoldDirector.getSnapshot();
  const crowd = crowdPresentationController?.getSnapshot() ?? null;

  return {
    activeAudioNodes: audio.activeAudioNodeCount,
    activeCameraShot: cameraController.getDebugSnapshot().activeShotName ?? null,
    activePlayerRootCount: getActivePlayers().length,
    activePresentationHold: hold.active,
    crowdReaction: crowd?.reactionState ?? null,
    geometryCount: metrics.geometries,
    helmetInstanceCount: getHelmetAssetSnapshot().attachedPlayerIds.length,
    materialCount: metrics.sceneMaterialCount,
    presentationHistoryCount: gamePresentationRuntime.getSnapshot().history.length,
    visualRootCount: playerVisuals.size,
  };
}

function createSevenAuditResetCycleResourceSnapshot(): SevenAuditResetCycleResourceSnapshot {
  const metrics = createRenderMetricsSnapshot(0);
  const audio = getRuntimeAudioSnapshot();

  return {
    activeAudioNodes: audio.activeAudioNodeCount,
    activePlayerRootCount: getActivePlayers().length,
    geometryCount: metrics.geometries,
    materialCount: metrics.sceneMaterialCount,
    presentationHistoryCount: gamePresentationRuntime.getSnapshot().history.length,
    visualRootCount: playerVisuals.size,
  };
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
