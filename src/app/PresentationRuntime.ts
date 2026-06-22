import * as THREE from 'three';
import {
  createBallVisual,
  getBallVisualSnapshot,
  resolveBallVisualStyle,
  syncBallVisual,
  type BallVisualSnapshot,
} from '../ballVisual';
import { AudioMixer } from '../audio/AudioMixer';
import {
  TitleMusicController,
  type TitleMusicControllerSnapshot,
} from '../audio/TitleMusicController';
import {
  BroadcastCommentaryDirector,
} from '../audio/BroadcastCommentaryDirector';
import {
  GameAudioDirector,
} from '../audio/GameAudioDirector';
import {
  GameplayCameraController,
  resolvePresentationShotPreview,
  type GameplayCameraDebugSnapshot,
} from '../camera/GameplayCameraController';
import {
  createGameExperienceDebugSnapshot,
  toGameplayCameraMode,
  type GameExperienceDebugSnapshot,
  type ResolvedGameExperienceSettings,
} from '../config/GameExperienceSettings';
import {
  CrowdPreviewController,
  resolveCrowdBenchmarkDurationSeconds,
  resolveCrowdPreviewCameraView,
  resolveCrowdPreviewCount,
  resolveCrowdPreviewEnabled,
  type CrowdPreviewCameraView,
  type CrowdPreviewSnapshot,
} from '../crowdPreview';
import {
  CrowdPresentationController,
  type CrowdPresentationSettings,
  type CrowdPresentationSnapshot,
} from '../presentation/CrowdPresentationController';
import { createGameplayHud, syncGameplayHud } from '../gameplayHud';
import {
  createPlayCallUi,
  syncPlayCallUi,
  type PlayCallUi,
} from '../playCallUi';
import type { GameplaySnapshot } from '../playState';
import {
  PlayerPoseController,
  type PlayerPoseSnapshot,
} from '../presentation/PlayerPoseController';
import {
  RouteArtRenderer,
  type RouteArtRendererSnapshot,
} from '../presentation/RouteArtRenderer';
import {
  PresentationHoldDirector,
  type PresentationHoldSnapshot,
} from '../presentation/PresentationHoldDirector';
import {
  GamePresentationRuntime,
  type GamePresentationRuntimeSnapshot,
} from '../presentation/GamePresentationRuntime';
import {
  createBroadcastCaptions,
  syncBroadcastCaptions,
} from '../ui/BroadcastCaptions';
import type { PlayDefinition } from '../playbook';
import type { BallModel } from '../ballModel';
import type { RuntimeAudioDebugSnapshot } from '../audio/AudioDebugOverlay';
import type { FramePerformanceProfiler } from '../performance/FramePerformanceProfiler';
import {
  getQualityProfile,
  type QualityProfileSnapshot,
} from '../performance/QualityProfile';
import {
  StadiumController,
  type StadiumControllerSnapshot,
} from '../stadium/StadiumController';
import {
  OfficialsPresentationController,
  type OfficialsPresentationSnapshot,
} from '../officials/OfficialsPresentationController';
import {
  resolveTeamPresentationTheme,
  type TeamPresentationTheme,
} from '../teams/TeamThemeApplier';
import {
  createGameplayRosterBinding,
  type GameplayRosterBinding,
} from '../roster/GameplayRosterBinding';
import {
  ControlledPlayerLabelRenderer,
  type ControlledPlayerLabelSnapshot,
} from '../presentation/ControlledPlayerLabel';
import {
  SidelineTeamController,
  type SidelineTeamControllerSnapshot,
} from '../presentation/teams/SidelineTeamController';

export interface PresentationRuntimeOptions {
  formationPreviewActive: boolean;
  gameExperience: ResolvedGameExperienceSettings;
  initialPlays: PlayDefinition[];
  routeAuditEnabled: boolean;
  scene: THREE.Scene;
  searchParams: URLSearchParams;
  renderer: THREE.WebGLRenderer;
  warn?: (message: string) => void;
}

export interface PresentationFrameOptions {
  active: boolean;
  ball: BallModel;
  commentaryActive: boolean;
  crowdCutawaysEnabled: boolean;
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  playerVisuals: Map<string, THREE.Group>;
  selectedPlay: PlayDefinition;
  profiler?: FramePerformanceProfiler;
}

export class PresentationRuntime {
  readonly audioMixer: AudioMixer;
  readonly ballVisual: THREE.Group;
  readonly broadcastCaptions: HTMLElement;
  readonly broadcastCommentaryDirector: BroadcastCommentaryDirector;
  readonly crowdPreviewCameraView: CrowdPreviewCameraView;
  readonly crowdPreviewController: CrowdPreviewController | null;
  readonly gameAudioDirector: GameAudioDirector;
  readonly gameplayHud = createGameplayHud();
  readonly playerPoseController: PlayerPoseController;
  readonly routeArtRenderer: RouteArtRenderer;
  readonly stadiumController: StadiumController;
  readonly sidelineTeamController: SidelineTeamController;
  readonly titleMusicController: TitleMusicController;
  readonly officialsController: OfficialsPresentationController;
  readonly controlledPlayerLabels: ControlledPlayerLabelRenderer;

  private readonly scene: THREE.Scene;
  private cameraController: GameplayCameraController;
  private crowdPresentationController: CrowdPresentationController | null;
  private crowdPresentationSettings: CrowdPresentationSettings;
  private gameExperience: ResolvedGameExperienceSettings;
  private qualityProfile: QualityProfileSnapshot;
  private readonly gamePresentationRuntime: GamePresentationRuntime;
  private readonly holdCinematicPreSnapEstablish: boolean;
  private playCallUi: PlayCallUi | null;
  private presentationHoldDirector: PresentationHoldDirector;
  private readonly searchParams: URLSearchParams;
  private readonly shotPreview: ReturnType<typeof resolvePresentationShotPreview>;
  private teamTheme: TeamPresentationTheme;
  private rosterBinding: GameplayRosterBinding;
  private crowdBenchmarkSuppressed = false;

  constructor({
    formationPreviewActive,
    gameExperience,
    initialPlays,
    routeAuditEnabled,
    scene,
    renderer,
    searchParams,
    warn,
  }: PresentationRuntimeOptions) {
    this.scene = scene;
    this.searchParams = searchParams;
    this.gameExperience = gameExperience;
    this.teamTheme = resolveTeamPresentationTheme(gameExperience.settings.teamProfiles);
    this.rosterBinding = createGameplayRosterBinding(
      gameExperience.settings.playbookId,
      gameExperience.settings.teamProfiles,
    );
    this.qualityProfile = getQualityProfile('broadcastHigh');
    this.crowdPresentationSettings = resolveEffectiveCrowdSettings(
      gameExperience.crowdPresentationSettings,
      this.qualityProfile,
    );
    this.holdCinematicPreSnapEstablish = searchParams.has('presentationAudit');
    this.shotPreview = resolvePresentationShotPreview(searchParams.get('shotPreview'));

    this.crowdPreviewCameraView = resolveCrowdPreviewCameraView(searchParams.get('crowdCamera'));
    const crowdPreviewEnabled = resolveCrowdPreviewEnabled(searchParams);
    this.crowdPreviewController = crowdPreviewEnabled
      ? new CrowdPreviewController({
          benchmarkDurationSeconds: resolveCrowdBenchmarkDurationSeconds(
            searchParams.get('crowdBenchmarkDuration'),
          ),
          benchmarkEnabled: searchParams.get('crowdBenchmark') === '1',
          height: window.innerHeight,
          requestedCount: resolveCrowdPreviewCount(searchParams),
          view: this.crowdPreviewCameraView,
          width: window.innerWidth,
        })
      : null;
    if (this.crowdPreviewController) {
      this.scene.add(this.crowdPreviewController.group);
    }

    this.stadiumController = new StadiumController({
      enabled: !this.crowdPreviewController && gameExperience.settings.stadiumEnabled,
      imageMaterialsEnabled: shouldUseStadiumImageMaterials(
        gameExperience,
        this.qualityProfile,
      ),
      renderer,
      upperTierEnabled: shouldUseStadiumUpperTier(gameExperience, this.qualityProfile),
    });
    if (!this.crowdPreviewController) {
      this.scene.add(this.stadiumController.group);
    }

    this.officialsController = new OfficialsPresentationController({
      debugLabelsEnabled: gameExperience.settings.officialsDebugLabels,
      enabled: !this.crowdPreviewController && gameExperience.settings.officialsEnabled,
    });
    if (!this.crowdPreviewController) {
      this.scene.add(this.officialsController.group);
    }

    this.sidelineTeamController = new SidelineTeamController({
      density: gameExperience.settings.sidelineDensity,
      enabled: !this.crowdPreviewController && gameExperience.settings.sidelinePlayersEnabled,
      rosterBinding: this.rosterBinding,
      teamTheme: this.teamTheme,
      tunnelTableauEnabled: gameExperience.settings.tunnelTableauEnabled,
    });
    if (!this.crowdPreviewController) {
      this.scene.add(this.sidelineTeamController.group);
    }

    this.crowdPresentationController =
      !this.crowdPreviewController && this.crowdPresentationSettings.crowdVisualsEnabled
        ? new CrowdPresentationController({
            accentColors: this.teamTheme.crowdAccentColors,
            settings: this.crowdPresentationSettings,
          })
        : null;
    if (this.crowdPresentationController) {
      this.scene.add(this.crowdPresentationController.group);
    }

    this.ballVisual = createBallVisual({
      style: resolveBallVisualStyle(searchParams.get('ballVisual')),
    });
    this.ballVisual.visible = !this.crowdPreviewController;
    this.scene.add(this.ballVisual);

    this.routeArtRenderer = new RouteArtRenderer({
      auditEnabled: routeAuditEnabled,
      enabled: gameExperience.settings.routeArtEnabled,
    });
    this.scene.add(this.routeArtRenderer.group);

    this.controlledPlayerLabels = new ControlledPlayerLabelRenderer({
      binding: this.rosterBinding,
      settings: {
        controlledPlayerLabelEnabled: gameExperience.settings.controlledPlayerLabelEnabled,
        selectedReceiverLabelEnabled: gameExperience.settings.selectedReceiverLabelEnabled,
      },
      teamTheme: this.teamTheme,
    });
    this.scene.add(this.controlledPlayerLabels.group);

    this.cameraController = this.createCameraController();
    this.audioMixer = new AudioMixer({
      flags: gameExperience.audioFeatureFlags,
      settings: gameExperience.audioSettings,
      warn,
    });
    this.titleMusicController = new TitleMusicController(this.audioMixer);
    this.gameAudioDirector = new GameAudioDirector(this.audioMixer);
    this.broadcastCommentaryDirector = new BroadcastCommentaryDirector(this.audioMixer, {
      enabled: true,
    });
    this.presentationHoldDirector = new PresentationHoldDirector(
      gameExperience.settings.cinematics,
    );
    this.gamePresentationRuntime = new GamePresentationRuntime({
      commentaryDirector: this.broadcastCommentaryDirector,
      gameAudioDirector: this.gameAudioDirector,
      getCrowdController: () => this.crowdPresentationController,
      getHoldDirector: () => this.presentationHoldDirector,
    });
    this.gameAudioDirector.installControls(window);
    this.setPageActive(!document.hidden && document.hasFocus());

    this.broadcastCaptions = createBroadcastCaptions();
    this.playCallUi = formationPreviewActive || this.crowdPreviewController
      ? null
      : createPlayCallUi(initialPlays, this.teamTheme);
    this.playerPoseController = new PlayerPoseController(undefined, {
      enabled: gameExperience.settings.playerMotionEnabled,
    });
  }

  get camera(): THREE.Camera {
    return this.crowdPreviewController?.camera ?? this.cameraController.camera;
  }

  get crowdPresentation(): CrowdPresentationController | null {
    return this.crowdPresentationController;
  }

  get cameraDebugSnapshot(): GameplayCameraDebugSnapshot {
    return this.cameraController.getDebugSnapshot();
  }

  get holdSnapshot(): PresentationHoldSnapshot {
    return this.presentationHoldDirector.getSnapshot();
  }

  consumeSelectedPlayId(): string | null {
    return this.playCallUi?.consumeSelectedPlayId() ?? null;
  }

  resetCameraPresentation(): void {
    this.cameraController.resetPresentation();
  }

  skipPresentation(): void {
    this.cameraController.skipPresentationShot();
    this.gamePresentationRuntime.skipPresentation();
  }

  skipPresentationHold(): void {
    this.presentationHoldDirector.skip();
  }

  toggleCameraMode(gameplaySnapshot: GameplaySnapshot): void {
    this.cameraController.toggleMode(gameplaySnapshot);
  }

  shouldHoldDeadPlayReset(): boolean {
    return this.presentationHoldDirector.shouldHoldDeadPlayReset();
  }

  setPageActive(active: boolean): void {
    this.gamePresentationRuntime.setPageActive(active);
  }

  setCrowdBenchmarkSuppressed(suppressed: boolean): void {
    if (this.crowdBenchmarkSuppressed === suppressed) {
      return;
    }

    this.crowdBenchmarkSuppressed = suppressed;
    this.rebuildCrowdPresentationController();
  }

  setPlays(plays: PlayDefinition[]): void {
    this.playCallUi?.setPlays(plays);
  }

  syncBall(ball: BallModel): void {
    syncBallVisual(this.ballVisual, ball);
  }

  resize(width: number, height: number): void {
    if (this.crowdPreviewController) {
      this.crowdPreviewController.resize(width, height);
    } else {
      this.cameraController.resize(width, height);
    }
  }

  renderCrowdPreviewFrame(deltaSeconds: number, renderer: THREE.WebGLRenderer): void {
    if (!this.crowdPreviewController) {
      return;
    }

    this.crowdPreviewController.updateBeforeRender();
    renderer.render(this.scene, this.crowdPreviewController.camera);
    this.crowdPreviewController.recordFrame(deltaSeconds, renderer);
  }

  updateGameplayFrame({
    active,
    ball,
    commentaryActive,
    crowdCutawaysEnabled,
    deltaSeconds,
    gameplaySnapshot,
    playerVisuals,
    profiler,
    selectedPlay,
  }: PresentationFrameOptions): void {
    const presentationEvents = this.gamePresentationRuntime.update(gameplaySnapshot, deltaSeconds, {
      active,
      commentaryActive,
      profiler,
    });

    if (profiler?.enabled) {
      profiler.measure('footballVisualUpdate', () => syncBallVisual(this.ballVisual, ball));
    } else {
      syncBallVisual(this.ballVisual, ball);
    }
    this.routeArtRenderer.update(gameplaySnapshot, selectedPlay);
    if (profiler?.enabled) {
      profiler.measure('proceduralPlayerPosing', () => {
        this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
      });
      profiler.measure('officialsUpdate', () => {
        this.officialsController.update(gameplaySnapshot, deltaSeconds, active);
      });
      profiler.measure('sidelineTeamsUpdate', () => {
        this.sidelineTeamController.update();
      });
      profiler.measure('cameraUpdate', () => {
        this.cameraController.update(gameplaySnapshot, deltaSeconds, {
          crowdCutawaysEnabled,
          presentationEvents,
        });
      });
    } else {
      this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
      this.officialsController.update(gameplaySnapshot, deltaSeconds, active);
      this.sidelineTeamController.update();
      this.cameraController.update(gameplaySnapshot, deltaSeconds, {
        crowdCutawaysEnabled,
        presentationEvents,
      });
    }
    const cameraSnapshot = this.cameraController.getDebugSnapshot();
    this.controlledPlayerLabels.update(
      gameplaySnapshot,
      this.cameraController.camera,
      cameraSnapshot,
      active,
    );
    this.presentationHoldDirector.updateCameraState(cameraSnapshot);
    this.gamePresentationRuntime.recordCameraSnapshot(cameraSnapshot);
    if (profiler?.enabled) {
      profiler.measure('hudDomUpdate', () => {
        syncGameplayHud(this.gameplayHud, gameplaySnapshot, this.teamTheme, this.rosterBinding);
        syncBroadcastCaptions(
          this.broadcastCaptions,
          this.broadcastCommentaryDirector.getSnapshot(),
        );
      });
    } else {
      syncGameplayHud(this.gameplayHud, gameplaySnapshot, this.teamTheme, this.rosterBinding);
      syncBroadcastCaptions(
        this.broadcastCaptions,
        this.broadcastCommentaryDirector.getSnapshot(),
      );
    }
  }

  syncPlayCallUi(gameplaySnapshot: GameplaySnapshot, visible: boolean): void {
    if (this.playCallUi && visible) {
      syncPlayCallUi(this.playCallUi, gameplaySnapshot);
    } else {
      this.playCallUi?.hide();
    }
  }

  syncApplicationChrome(appPhase: 'gameplay' | 'title'): void {
    document.body.dataset.appPhase = appPhase;
    this.gameplayHud.root.hidden = appPhase !== 'gameplay';
    this.controlledPlayerLabels.setApplicationPhase(appPhase);
    if (appPhase !== 'gameplay') {
      this.playCallUi?.hide();
      this.broadcastCaptions.hidden = true;
      this.broadcastCaptions.textContent = '';
    }
  }

  applyExperience(gameExperience: ResolvedGameExperienceSettings): void {
    const previousCameraSetting = this.gameExperience.settings.gameplayCamera;
    const previousCinematicsSetting = this.gameExperience.settings.cinematics;
    const previousCrowdSettings = this.crowdPresentationSettings;
    const previousTeamKey = this.teamTheme.teamKey;

    this.gameExperience = gameExperience;
    this.teamTheme = resolveTeamPresentationTheme(gameExperience.settings.teamProfiles);
    this.rosterBinding = createGameplayRosterBinding(
      gameExperience.settings.playbookId,
      gameExperience.settings.teamProfiles,
    );
    this.crowdPresentationSettings = resolveEffectiveCrowdSettings(
      gameExperience.crowdPresentationSettings,
      this.qualityProfile,
    );
    this.audioMixer.setFeatureFlags(gameExperience.audioFeatureFlags);
    this.audioMixer.setSettings(gameExperience.audioSettings);
    this.routeArtRenderer.setEnabled(gameExperience.settings.routeArtEnabled);
    this.controlledPlayerLabels.setBinding(this.rosterBinding);
    this.controlledPlayerLabels.setSettings({
      controlledPlayerLabelEnabled: gameExperience.settings.controlledPlayerLabelEnabled,
      selectedReceiverLabelEnabled: gameExperience.settings.selectedReceiverLabelEnabled,
    });
    this.controlledPlayerLabels.setTeamTheme(this.teamTheme);
    this.playerPoseController.setEnabled(gameExperience.settings.playerMotionEnabled);
    this.officialsController.applySettings({
      debugLabelsEnabled: gameExperience.settings.officialsDebugLabels,
      enabled: !this.crowdPreviewController && gameExperience.settings.officialsEnabled,
    });
    this.sidelineTeamController.applySettings({
      density: gameExperience.settings.sidelineDensity,
      enabled: !this.crowdPreviewController && gameExperience.settings.sidelinePlayersEnabled,
      rosterBinding: this.rosterBinding,
      teamTheme: this.teamTheme,
      tunnelTableauEnabled: gameExperience.settings.tunnelTableauEnabled,
    });
    this.applyStadiumSettings();
    this.broadcastCommentaryDirector.setAnnouncerEnabled(
      gameExperience.settings.announcerEnabled,
    );
    this.broadcastCommentaryDirector.setCaptionsEnabled(
      gameExperience.settings.captionsEnabled,
    );
    if (previousTeamKey !== this.teamTheme.teamKey) {
      this.playCallUi?.setTeamTheme(this.teamTheme);
      this.crowdPresentationController?.setAccentColors(this.teamTheme.crowdAccentColors);
    }
    if (
      previousCameraSetting !== gameExperience.settings.gameplayCamera ||
      previousCinematicsSetting !== gameExperience.settings.cinematics
    ) {
      this.cameraController = this.createCameraController();
    }
    this.presentationHoldDirector = new PresentationHoldDirector(
      gameExperience.settings.cinematics,
    );

    if (!areCrowdSettingsEqual(previousCrowdSettings, this.crowdPresentationSettings)) {
      this.rebuildCrowdPresentationController();
    }
  }

  applyQualityProfile(profile: QualityProfileSnapshot): void {
    const previousCrowdSettings = this.crowdPresentationSettings;
    this.qualityProfile = profile;
    this.crowdPresentationSettings = resolveEffectiveCrowdSettings(
      this.gameExperience.crowdPresentationSettings,
      this.qualityProfile,
    );

    if (!areCrowdSettingsEqual(previousCrowdSettings, this.crowdPresentationSettings)) {
      this.rebuildCrowdPresentationController();
    }
    this.applyStadiumSettings();
  }

  getRuntimeAudioSnapshot(): RuntimeAudioDebugSnapshot {
    return {
      ...this.gameAudioDirector.getSnapshot(),
      commentary: this.broadcastCommentaryDirector.getSnapshot(),
      titleMusic: this.titleMusicController.getSnapshot(),
    };
  }

  getTitleMusicSnapshot(): TitleMusicControllerSnapshot {
    return this.titleMusicController.getSnapshot();
  }

  getGameExperienceSnapshot(): GameExperienceDebugSnapshot {
    const audioSnapshot = this.getRuntimeAudioSnapshot();
    const crowdSnapshot = this.crowdPresentationController?.getSnapshot() ?? null;

    return createGameExperienceDebugSnapshot(this.gameExperience, {
      audioEnabled: audioSnapshot.enabled,
      crowdSpectatorCount: crowdSnapshot?.actualSpectatorCount ?? 0,
      crowdVisualsAllocated: !!this.crowdPresentationController,
      decodedAudioBytes: audioSnapshot.decodedBufferBytes,
      loadedAudioAssetIds: audioSnapshot.loadedAssetIds,
      loadedCompressedAudioBytes: audioSnapshot.loadedCompressedBytes,
      missingOptionalAudioAssetIds: audioSnapshot.missingOptionalAssetIds,
      streamedAudioAssetIds: audioSnapshot.streamedAssetIds,
    });
  }

  getBallVisualSnapshot(): BallVisualSnapshot {
    return getBallVisualSnapshot(this.ballVisual);
  }

  getCrowdPreviewSnapshot(): CrowdPreviewSnapshot | null {
    return this.crowdPreviewController?.getSnapshot() ?? null;
  }

  getCrowdPresentationSnapshot(): CrowdPresentationSnapshot | null {
    return this.crowdPresentationController?.getSnapshot() ?? null;
  }

  getStadiumSnapshot(): StadiumControllerSnapshot {
    return this.stadiumController.getSnapshot();
  }

  getOfficialsSnapshot(): OfficialsPresentationSnapshot {
    return this.officialsController.getSnapshot();
  }

  getSidelineTeamSnapshot(): SidelineTeamControllerSnapshot {
    return this.sidelineTeamController.getSnapshot();
  }

  getGamePresentationRuntimeSnapshot(): GamePresentationRuntimeSnapshot {
    return this.gamePresentationRuntime.getSnapshot();
  }

  getPlayerPoseSnapshots(): PlayerPoseSnapshot[] {
    return this.playerPoseController.getPoseSnapshots();
  }

  getRouteArtSnapshot(): RouteArtRendererSnapshot {
    return this.routeArtRenderer.getSnapshot();
  }

  getControlledPlayerLabelSnapshot(): ControlledPlayerLabelSnapshot {
    return this.controlledPlayerLabels.getSnapshot();
  }

  recordCrowdPresentationFrame(deltaSeconds: number, renderer: THREE.WebGLRenderer): void {
    this.crowdPresentationController?.recordFrame(deltaSeconds, renderer);
  }

  runRouteArtUpdate(gameplaySnapshot: GameplaySnapshot, selectedPlay: PlayDefinition): void {
    this.routeArtRenderer.update(gameplaySnapshot, selectedPlay);
  }

  dispose(): void {
    this.scene.remove(this.ballVisual);
    this.scene.remove(this.routeArtRenderer.group);
    this.scene.remove(this.controlledPlayerLabels.group);
    this.routeArtRenderer.dispose();
    this.controlledPlayerLabels.dispose();
    if (this.crowdPreviewController) {
      this.scene.remove(this.crowdPreviewController.group);
      this.crowdPreviewController.dispose();
    }
    if (this.crowdPresentationController) {
      this.scene.remove(this.crowdPresentationController.group);
      this.crowdPresentationController.dispose();
    }
    this.scene.remove(this.stadiumController.group);
    this.stadiumController.dispose();
    this.scene.remove(this.officialsController.group);
    this.officialsController.dispose();
    this.scene.remove(this.sidelineTeamController.group);
    this.sidelineTeamController.dispose();
    this.playCallUi?.dispose();
    this.gameplayHud.root.remove();
    this.broadcastCaptions.remove();
  }

  private createCameraController(): GameplayCameraController {
    return new GameplayCameraController({
      cinematics: this.gameExperience.settings.cinematics,
      height: window.innerHeight,
      holdCinematicPreSnapEstablish: this.holdCinematicPreSnapEstablish,
      initialMode: toGameplayCameraMode(this.gameExperience.settings.gameplayCamera),
      shotPreview: this.shotPreview,
      width: window.innerWidth,
    });
  }

  private rebuildCrowdPresentationController(): void {
    if (this.crowdPresentationController) {
      this.scene.remove(this.crowdPresentationController.group);
      this.crowdPresentationController.dispose();
      this.crowdPresentationController = null;
    }

    if (
      this.crowdBenchmarkSuppressed ||
      this.crowdPreviewController ||
      !this.crowdPresentationSettings.crowdVisualsEnabled
    ) {
      return;
    }

    this.crowdPresentationController = new CrowdPresentationController({
      accentColors: this.teamTheme.crowdAccentColors,
      settings: this.crowdPresentationSettings,
    });
    this.crowdPresentationController.setPageActive(!document.hidden && document.hasFocus());
    this.scene.add(this.crowdPresentationController.group);
  }

  private applyStadiumSettings(): void {
    this.stadiumController.applySettings({
      enabled: !this.crowdPreviewController && this.gameExperience.settings.stadiumEnabled,
      imageMaterialsEnabled: shouldUseStadiumImageMaterials(
        this.gameExperience,
        this.qualityProfile,
      ),
      upperTierEnabled: shouldUseStadiumUpperTier(this.gameExperience, this.qualityProfile),
    });
  }
}

function areCrowdSettingsEqual(
  a: CrowdPresentationSettings,
  b: CrowdPresentationSettings,
): boolean {
  return a.crowdDensity === b.crowdDensity &&
    a.crowdReactionsEnabled === b.crowdReactionsEnabled &&
    a.crowdVisualsEnabled === b.crowdVisualsEnabled;
}

function resolveEffectiveCrowdSettings(
  base: CrowdPresentationSettings,
  quality: QualityProfileSnapshot,
): CrowdPresentationSettings {
  return {
    crowdDensity: minCrowdDensity(base.crowdDensity, quality.crowdDensity),
    crowdReactionsEnabled: base.crowdReactionsEnabled && quality.crowdReactionsEnabled,
    crowdVisualsEnabled: base.crowdVisualsEnabled && quality.crowdVisualsEnabled,
  };
}

function minCrowdDensity(
  a: CrowdPresentationSettings['crowdDensity'],
  b: CrowdPresentationSettings['crowdDensity'],
): CrowdPresentationSettings['crowdDensity'] {
  const order: Record<CrowdPresentationSettings['crowdDensity'], number> = {
    high: 2,
    low: 0,
    medium: 1,
  };

  return order[a] <= order[b] ? a : b;
}

function shouldUseStadiumImageMaterials(
  gameExperience: ResolvedGameExperienceSettings,
  quality: QualityProfileSnapshot,
): boolean {
  return gameExperience.settings.stadiumEnabled &&
    gameExperience.settings.preset !== 'performance' &&
    quality.tier !== 'performance';
}

function shouldUseStadiumUpperTier(
  gameExperience: ResolvedGameExperienceSettings,
  quality: QualityProfileSnapshot,
): boolean {
  return gameExperience.settings.stadiumEnabled &&
    gameExperience.settings.preset !== 'performance' &&
    quality.tier !== 'performance';
}
