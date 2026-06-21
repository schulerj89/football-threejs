import {
  resolveGameExperienceSettings,
  saveGameExperienceSettings,
  type GameExperienceSettings,
  type ResolvedGameExperienceSettings,
} from '../config/GameExperienceSettings';
import { resolveCrowdPreviewEnabled } from '../crowdPreview';
import { resolvePlayerBodyVisualStyle } from '../playerVisual';
import { ApplicationDiagnostics } from './ApplicationDiagnostics';
import { ApplicationLifecycle } from './ApplicationLifecycle';
import { DevelopmentToolsRuntime } from './DevelopmentToolsRuntime';
import { GameLoop } from './GameLoop';
import { GameplayRuntime } from './GameplayRuntime';
import { PlayerVisualRegistry } from './PlayerVisualRegistry';
import { PresentationRuntime } from './PresentationRuntime';
import { SceneRuntime } from './SceneRuntime';
import { FramePerformanceProfiler } from '../performance/FramePerformanceProfiler';
import { PerformanceScenarioRunner } from '../performance/PerformanceScenarioRunner';
import { AdaptiveQualityController } from '../performance/AdaptiveQualityController';
import { RuntimePerformanceMonitor } from '../performance/RuntimePerformanceMonitor';
import {
  collectRendererMetrics,
  collectSceneStructureMetrics,
  createResourceChangeSnapshot,
  hasResourceChanged,
  type ResourceChangeSnapshot,
} from '../performance/RendererMetricsCollector';
import type { QualityDebugSnapshot } from '../ui/PerformanceSettingsPanel';

export interface FootballApplicationOptions {
  mount: HTMLDivElement;
  searchParams?: URLSearchParams;
}

export class FootballApplication {
  private readonly searchParams: URLSearchParams;
  private readonly sceneRuntime: SceneRuntime;
  private readonly gameplay: GameplayRuntime;
  private readonly playerVisuals: PlayerVisualRegistry;
  private readonly presentation: PresentationRuntime;
  private readonly diagnostics: ApplicationDiagnostics;
  private readonly lifecycle: ApplicationLifecycle;
  private readonly developmentTools: DevelopmentToolsRuntime;
  private readonly performanceProfiler: FramePerformanceProfiler;
  private readonly performanceScenarioRunner: PerformanceScenarioRunner | null;
  private readonly qualityController: AdaptiveQualityController;
  private readonly runtimePerformanceMonitor = new RuntimePerformanceMonitor();
  private readonly loop: GameLoop;
  private readonly removeSceneResizeHandler: () => void;
  private gameExperience: ResolvedGameExperienceSettings;
  private hasRenderedFirstFrame = false;
  private previousPerformanceResourceSnapshot: ResourceChangeSnapshot | null = null;

  constructor({ mount, searchParams = new URLSearchParams(window.location.search) }: FootballApplicationOptions) {
    this.searchParams = searchParams;
    this.gameExperience = resolveGameExperienceSettings({ searchParams });
    this.performanceProfiler = FramePerformanceProfiler.createFromSearchParams(searchParams);
    this.qualityController = new AdaptiveQualityController(this.gameExperience.settings.qualityMode);
    this.gameplay = new GameplayRuntime({
      consumeSelectedPlayId: () => this.presentation.consumeSelectedPlayId(),
      playbookId: this.gameExperience.settings.playbookId,
      searchParams,
      shouldHoldDeadPlayReset: () => this.presentation.shouldHoldDeadPlayReset(),
      skipPresentation: () => this.presentation.skipPresentation(),
    });
    this.sceneRuntime = new SceneRuntime({ mount, searchParams });
    this.presentation = new PresentationRuntime({
      formationPreviewActive: !!this.gameplay.formationPreviewModel,
      gameExperience: this.gameExperience,
      initialPlays: this.gameplay.availablePlays,
      routeAuditEnabled: searchParams.has('routeAudit'),
      scene: this.sceneRuntime.scene,
      searchParams,
      warn: (message) => {
        if (import.meta.env.DEV) {
          console.warn(message);
        }
      },
    });
    this.applyCurrentQualityProfile();
    this.removeSceneResizeHandler = this.sceneRuntime.onResize((width, height) => {
      this.presentation.resize(width, height);
    });
    this.playerVisuals = new PlayerVisualRegistry(this.sceneRuntime.scene, {
      bodyStyle: resolvePlayerBodyVisualStyle(searchParams.get('playerBody')),
      debugRoleColors: searchParams.has('debugRoleColors'),
    });
    this.playerVisuals.reconcile(this.getActivePlayers());
    this.presentation.syncBall(
      this.gameplay.formationPreviewModel?.ball ?? this.gameplay.gameplayModel.ball,
    );
    this.performanceScenarioRunner = this.performanceProfiler.enabled
      ? new PerformanceScenarioRunner(() => this.gameplay.gameplayModel)
      : null;
    this.diagnostics = new ApplicationDiagnostics({
      gameplay: this.gameplay,
      getGameExperience: () => this.gameExperience,
      isCrowdPresentationDebugEnabled: () => this.isCrowdPresentationDebugEnabled(),
      playerVisuals: this.playerVisuals,
      performanceProfiler: this.performanceProfiler,
      performanceScenarioRunner: this.performanceScenarioRunner,
      getQualityDebugSnapshot: () => this.createQualityDebugSnapshot(),
      presentation: this.presentation,
      sceneRuntime: this.sceneRuntime,
      searchParams,
    });
    this.lifecycle = new ApplicationLifecycle({
      crowdPreviewEnabled: !!this.presentation.crowdPreviewController,
      formationPreviewActive: !!this.gameplay.formationPreviewModel,
      initialSettings: this.gameExperience.settings,
      searchParams,
      createTitleLoadingState: () => this.diagnostics.createTitleLoadingState(),
      onPauseSettingsChange: (settings) => this.handlePauseSettingsChange(settings),
      onReturnToTitle: () => this.lifecycle.returnToTitleScreen(),
      onStart: () => this.startGameFromTitle(),
      onTitleSettingsChange: (settings) => this.applyExperienceSettings(settings, { persist: true }),
      syncChrome: (phase) => this.presentation.syncApplicationChrome(phase),
    });
    this.developmentTools = new DevelopmentToolsRuntime({
      activePlayer: () => this.gameplay.getActivePrimaryPlayer(),
      appearanceAuditEnabled: searchParams.has('appearanceAudit'),
      audioDebugEnabled: this.gameExperience.audioFeatureFlags.audioDebug,
      cameraDebugEnabled: searchParams.has('cameraDebug'),
      commentaryDebugEnabled: searchParams.has('commentaryDebug'),
      crowdPresentationDebugEnabled: this.isCrowdPresentationDebugEnabled() &&
        !!this.presentation.crowdPresentation,
      crowdPreviewEnabled: !!this.presentation.crowdPreviewController,
      debugToolsEnabled: this.gameExperience.settings.debugToolsEnabled,
      debugApi: this.diagnostics.createDebugApi(),
      elevenAuditEnabled: searchParams.has('elevenAudit'),
      formationPreviewActive: !!this.gameplay.formationPreviewModel,
      onCrowdPreviewControls: (event) => this.handleCrowdPreviewControls(event),
      onDevelopmentCameraToggle: (event) => this.handleDevelopmentCameraToggle(event),
      onFormationPreviewLaneControls: (event) =>
        this.gameplay.handleFormationPreviewLaneControls(
          event,
          () => this.presentation.resetCameraPresentation(),
        ),
      onPauseSettingsShortcut: (event) =>
        this.lifecycle.handlePauseSettingsShortcut(
          event,
          this.gameplay.gameplayModel.playState,
        ),
      onPresentationAuditControls: (event) =>
        this.gameplay.handlePresentationAuditControls(
          event,
          () => this.presentation.resetCameraPresentation(),
        ),
      passAuditEnabled: searchParams.has('passAudit'),
      performanceDebugEnabled: searchParams.has('qualityDebug') ||
        searchParams.has('performanceDebug'),
      presentationAuditEnabled: searchParams.has('presentationAudit'),
      renderer: this.sceneRuntime.renderer,
      routeAuditEnabled: searchParams.has('routeAudit'),
      searchParams,
      sevenAuditEnabled: searchParams.has('sevenAudit'),
    });
    document.addEventListener('visibilitychange', this.syncAudioPageActivity);
    window.addEventListener('blur', this.syncAudioPageActivity);
    window.addEventListener('focus', this.syncAudioPageActivity);
    this.loop = new GameLoop({
      onFrame: (deltaSeconds) => this.renderFrame(deltaSeconds),
    });
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.pause();
  }

  dispose(): void {
    this.loop.dispose();
    document.removeEventListener('visibilitychange', this.syncAudioPageActivity);
    window.removeEventListener('blur', this.syncAudioPageActivity);
    window.removeEventListener('focus', this.syncAudioPageActivity);
    this.removeSceneResizeHandler();
    this.developmentTools.dispose();
    this.lifecycle.dispose();
    this.gameplay.dispose();
    this.playerVisuals.dispose();
    this.presentation.dispose();
    this.sceneRuntime.dispose();
  }

  private renderFrame(delta: number): void {
    if (this.performanceProfiler.enabled) {
      this.performanceProfiler.beginFrame(performance.now());
    }

    try {
      this.renderFrameBody(delta);
    } finally {
      this.finishPerformanceFrame();
    }
  }

  private renderFrameBody(delta: number): void {
    if (this.presentation.crowdPreviewController) {
      this.presentation.renderCrowdPreviewFrame(delta, this.sceneRuntime.renderer);
      this.diagnostics.latestRenderMetrics = this.diagnostics.createRenderMetricsSnapshot(delta);
      const snapshot = this.presentation.getCrowdPreviewSnapshot();
      if (snapshot) {
        this.developmentTools.syncCrowdPreviewOverlay(snapshot);
      }
      this.markFirstFrameReady();
      return;
    }

    const gameplayActive =
      this.lifecycle.phase === 'gameplay' && !this.lifecycle.isPauseSettingsVisible();
    this.gameplay.update(delta, gameplayActive, this.performanceProfiler);
    if (gameplayActive) {
      this.performanceScenarioRunner?.update(delta);
    }
    const gameplaySnapshot = this.gameplay.getActivePresentationSnapshot(false);
    this.updateAdaptiveQuality(delta, gameplaySnapshot);
    if (this.performanceProfiler.enabled) {
      this.performanceProfiler.measure('stadiumUpdate', () => {
        this.sceneRuntime.syncDriveLines(
          gameplaySnapshot.drive.lineOfScrimmage,
          gameplaySnapshot.drive.firstDownMarker,
        );
      });
      this.performanceProfiler.measure('playerVisualSync', () => {
        this.playerVisuals.sync(this.getActivePlayers());
      });
    } else {
      this.sceneRuntime.syncDriveLines(
        gameplaySnapshot.drive.lineOfScrimmage,
        gameplaySnapshot.drive.firstDownMarker,
      );
      this.playerVisuals.sync(this.getActivePlayers());
    }
    this.presentation.updateGameplayFrame({
      active: gameplayActive,
      ball: this.gameplay.formationPreviewModel?.ball ?? this.gameplay.gameplayModel.ball,
      commentaryActive: !this.gameplay.formationPreviewModel,
      crowdCutawaysEnabled: !!this.presentation.crowdPresentation &&
        this.gameExperience.crowdPresentationSettings.crowdVisualsEnabled &&
        this.gameExperience.crowdPresentationSettings.crowdReactionsEnabled,
      deltaSeconds: delta,
      gameplaySnapshot,
      playerVisuals: this.playerVisuals.visuals,
      profiler: this.performanceProfiler,
      selectedPlay: this.gameplay.gameplayModel.selectedPlay,
    });
    if (this.performanceProfiler.enabled) {
      this.performanceProfiler.measure('hudDomUpdate', () => {
        this.presentation.syncPlayCallUi(gameplaySnapshot, gameplayActive);
      });
      this.performanceProfiler.measure('rendererRender', () => {
        this.sceneRuntime.render(this.presentation.camera);
      });
    } else {
      this.presentation.syncPlayCallUi(gameplaySnapshot, gameplayActive);
      this.sceneRuntime.render(this.presentation.camera);
    }
    this.presentation.recordCrowdPresentationFrame(delta, this.sceneRuntime.renderer);
    if (this.developmentTools.shouldCollectPresentationDiagnostics()) {
      this.diagnostics.latestRenderMetrics = this.diagnostics.createRenderMetricsSnapshot(delta);
    }
    this.syncDevelopmentOverlays(delta, gameplaySnapshot);
    if (this.performanceProfiler.enabled) {
      this.performanceProfiler.measure('hudDomUpdate', () => {
        this.lifecycle.syncTitleLoadingState();
        this.lifecycle.syncChrome();
      });
    } else {
      this.lifecycle.syncTitleLoadingState();
      this.lifecycle.syncChrome();
    }
    this.markFirstFrameReady();
  }

  private finishPerformanceFrame(): void {
    if (!this.performanceProfiler.enabled || document.visibilityState !== 'visible') {
      return;
    }

    const rendererMetrics = collectRendererMetrics(this.sceneRuntime.renderer);
    const sceneStructure = collectSceneStructureMetrics(
      this.sceneRuntime.scene,
      this.playerVisuals.values(),
    );
    const resourceSnapshot = createResourceChangeSnapshot(
      this.sceneRuntime.renderer,
      sceneStructure,
    );
    const resourceCreatedOrDisposed = hasResourceChanged(
      this.previousPerformanceResourceSnapshot,
      resourceSnapshot,
    );
    this.previousPerformanceResourceSnapshot = resourceSnapshot;
    const gameplaySnapshot = this.gameplay.getActivePresentationSnapshot(
      !!this.presentation.crowdPreviewController,
    );
    const cameraSnapshot = this.presentation.cameraDebugSnapshot;
    const crowdSnapshot = this.presentation.getCrowdPresentationSnapshot();
    const presentationSnapshot = this.presentation.getGamePresentationRuntimeSnapshot();

    this.performanceProfiler.endFrame(
      performance.now(),
      {
        activeScenario: this.performanceScenarioRunner?.getActiveScenarioName() ?? 'normal-gameplay',
        activeShot: cameraSnapshot.activeShotName ?? null,
        cameraState: cameraSnapshot.state,
        crowdCount: crowdSnapshot?.actualSpectatorCount ?? 0,
        crowdReactionBegan:
          presentationSnapshot.recentEvents.some((event) =>
            event.type === 'firstDown' || event.type === 'touchdown'),
        playState: gameplaySnapshot.playState,
        playerCount: gameplaySnapshot.players.length,
        presentationState: cameraSnapshot.presentationPhase ?? cameraSnapshot.state,
        resourceCreatedOrDisposed,
      },
      rendererMetrics,
      sceneStructure,
    );
  }

  private syncDevelopmentOverlays(delta: number, gameplaySnapshot: ReturnType<GameplayRuntime['getActivePresentationSnapshot']>): void {
    const activePrimaryPlayer = this.gameplay.getActivePrimaryPlayer();
    const formationPreviewSnapshot = this.diagnostics.getFormationPreviewSnapshot();
    this.developmentTools.syncGameplayOverlays({
      activePrimaryPlayer,
      cameraSnapshot: this.presentation.cameraDebugSnapshot,
      crowdPresentationSnapshot: this.presentation.getCrowdPresentationSnapshot(),
      crowdPreviewSnapshot: this.presentation.getCrowdPreviewSnapshot(),
      deltaSeconds: delta,
      elevenAuditSnapshot: this.diagnostics.getElevenAuditSnapshot(),
      emptyPresentationAuditSnapshot: this.diagnostics.createEmptyPresentationAuditSnapshot(),
      formationPreviewModel: this.gameplay.formationPreviewModel,
      formationPreviewSnapshot,
      gameplayModel: this.gameplay.gameplayModel,
      gameplaySnapshot,
      playerBodyVisual: this.playerVisuals.get(activePrimaryPlayer.id),
      playerPoseSnapshots: this.presentation.getPlayerPoseSnapshots(),
      playerVisuals: this.playerVisuals.visuals,
      presentationAuditSnapshot: this.diagnostics.getPresentationAuditSnapshot(),
      presentationHardeningAuditSnapshot: this.diagnostics.getPresentationHardeningAuditSnapshot(),
      renderMetrics: this.diagnostics.latestRenderMetrics,
      routeArtSnapshot: this.presentation.getRouteArtSnapshot(),
      runtimeAudioSnapshot: this.presentation.getRuntimeAudioSnapshot(),
      qualityDebugSnapshot: this.createQualityDebugSnapshot(),
      sevenAuditSnapshot: this.diagnostics.getSevenAuditSnapshot(),
    });
  }

  private startGameFromTitle(): void {
    const selectedSettings = this.lifecycle.getTitleSettings(this.gameExperience.settings);
    this.applyExperienceSettings(selectedSettings, { persist: true });
    this.gameplay.startFromTitle(this.gameExperience.settings.playbookId);
    this.syncAfterGameplayRebuild();
    this.lifecycle.startGameplay();
    void this.presentation.audioMixer.unlockFromUserGesture();
    this.presentation.resetCameraPresentation();
  }

  private handlePauseSettingsChange(settings: GameExperienceSettings): void {
    this.applyExperienceSettings({
      ...settings,
      playbookId: this.gameExperience.settings.playbookId,
    }, { persist: true });
  }

  private applyExperienceSettings(
    settings: GameExperienceSettings,
    options: { persist?: boolean } = {},
  ): void {
    const previousPlaybookId = this.gameExperience.settings.playbookId;
    if (options.persist ?? true) {
      saveGameExperienceSettings(settings);
    }
    this.gameExperience = resolveGameExperienceSettings({
      audioSettings: this.presentation.audioMixer.getSettings(),
      crowdPresentationSettings: this.gameExperience.crowdPresentationSettings,
      searchParams: this.searchParams,
    });
    this.presentation.applyExperience(this.gameExperience);
    this.developmentTools.setDebugToolsEnabled(this.gameExperience.settings.debugToolsEnabled);
    this.qualityController.setMode(
      this.gameExperience.settings.qualityMode,
      this.createQualityTransitionContext(),
    );
    this.applyCurrentQualityProfile();
    if (previousPlaybookId !== this.gameExperience.settings.playbookId) {
      this.gameplay.rebuildForPlaybook(this.gameExperience.settings.playbookId);
      this.syncAfterGameplayRebuild();
    }
    this.lifecycle.setSettings(this.gameExperience.settings);
    this.lifecycle.syncTitleLoadingState();
    this.lifecycle.syncChrome();
  }

  private syncAfterGameplayRebuild(): void {
    this.presentation.setPlays(this.gameplay.availablePlays);
    this.playerVisuals.reconcile(this.getActivePlayers());
    this.presentation.syncBall(this.gameplay.gameplayModel.ball);
    this.presentation.resetCameraPresentation();
  }

  private getActivePlayers() {
    return this.gameplay.getActivePlayers(!!this.presentation.crowdPreviewController);
  }

  private handleCrowdPreviewControls(event: KeyboardEvent): void {
    if (!this.presentation.crowdPreviewController || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === '1') {
      this.presentation.crowdPreviewController.setCameraView('wide');
      event.preventDefault();
      return;
    }
    if (event.key === '2') {
      this.presentation.crowdPreviewController.setCameraView('sideline');
      event.preventDefault();
      return;
    }
    if (event.key === '3') {
      this.presentation.crowdPreviewController.setCameraView('endZone');
      event.preventDefault();
      return;
    }
    if (event.key === '4') {
      this.presentation.crowdPreviewController.setCameraView('close');
      event.preventDefault();
    }
  }

  private handleDevelopmentCameraToggle(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== 'c') {
      return;
    }
    this.presentation.toggleCameraMode(
      this.gameplay.getActiveGameplaySnapshot(!!this.presentation.crowdPreviewController),
    );
    event.preventDefault();
  }

  private readonly syncAudioPageActivity = (): void => {
    this.presentation.setPageActive(!document.hidden && document.hasFocus());
    if (document.hidden) {
      this.runtimePerformanceMonitor.reset('hidden-tab');
    }
  };

  private updateAdaptiveQuality(
    deltaSeconds: number,
    gameplaySnapshot: ReturnType<GameplayRuntime['getActivePresentationSnapshot']>,
  ): void {
    const monitor = this.runtimePerformanceMonitor.update({
      active: this.lifecycle.phase === 'gameplay' && !this.lifecycle.isPauseSettingsVisible(),
      debugOverheadActive:
        this.performanceProfiler.enabled ||
        this.developmentTools.shouldCollectPresentationDiagnostics(),
      deltaSeconds,
      hidden: document.visibilityState !== 'visible',
    });
    const result = this.qualityController.update({
      context: {
        appPhase: this.lifecycle.phase,
        playState: gameplaySnapshot.playState,
      },
      deltaSeconds,
      monitor,
    });

    if (result.applied) {
      this.applyCurrentQualityProfile();
    }
  }

  private applyCurrentQualityProfile(): void {
    const profile = this.qualityController.getProfile();
    this.sceneRuntime.setMaxPixelRatio(profile.maxPixelRatio);
    this.presentation.applyQualityProfile(profile);
  }

  private createQualityTransitionContext() {
    return {
      appPhase: this.lifecycle.phase,
      playState: this.gameplay.gameplayModel.playState,
    };
  }

  private createQualityDebugSnapshot(): QualityDebugSnapshot {
    const report = this.performanceProfiler.enabled
      ? this.diagnostics.createPerformanceProfileReportForDebug()
      : null;
    return {
      limitingSubsystem: report?.bottlenecks[0]?.phase ?? null,
      monitor: this.runtimePerformanceMonitor.getSnapshot(),
      pixelRatio: this.sceneRuntime.getPixelRatio(),
      quality: this.qualityController.getSnapshot(),
    };
  }

  private isCrowdPresentationDebugEnabled(): boolean {
    return this.searchParams.has('crowdDebug') ||
      (this.searchParams.has('presentationAudit') && !resolveCrowdPreviewEnabled(this.searchParams));
  }

  private markFirstFrameReady(): void {
    if (!this.hasRenderedFirstFrame) {
      this.hasRenderedFirstFrame = true;
      document.body.dataset.sceneReady = 'true';
    }
  }
}
