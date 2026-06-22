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
import { BrowserMemoryProvider } from '../performance/BrowserMemoryProvider';
import {
  CrowdCapacityBenchmark,
  type CrowdCapacityTargetProfile,
} from '../performance/CrowdCapacityBenchmark';
import {
  SceneResourceProfiler,
} from '../performance/SceneResourceProfiler';
import type {
  CrowdCapacityBenchmarkSnapshot,
  CrowdCapacityReport,
  SceneResourceProfileSnapshot,
} from '../performance/MemoryTypes';
import {
  collectRendererMetrics,
  collectSceneStructureMetrics,
  createResourceChangeSnapshot,
  hasResourceChanged,
  type ResourceChangeSnapshot,
} from '../performance/RendererMetricsCollector';
import type { QualityDebugSnapshot } from '../ui/PerformanceSettingsPanel';
import type { CrowdDensity } from '../presentation/CrowdPresentationController';
import { resolveTeamPresentationTheme } from '../teams/TeamThemeApplier';
import type { GameplayModel, GameplaySnapshot } from '../playState';
import { MatchFlowController } from '../match/MatchFlowController';
import type { MatchSnapshot } from '../match/MatchTypes';
import { MatchScorebug } from '../ui/MatchScorebug';
import { OpponentDriveSummaryPanel } from '../ui/OpponentDriveSummary';
import { QuarterTransitionPanel } from '../ui/QuarterTransition';

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
  private matchController: MatchFlowController;
  private readonly matchScorebug: MatchScorebug;
  private readonly opponentDriveSummary: OpponentDriveSummaryPanel;
  private readonly quarterTransitionPanel: QuarterTransitionPanel;
  private readonly qualityController: AdaptiveQualityController;
  private readonly runtimePerformanceMonitor = new RuntimePerformanceMonitor();
  private readonly sceneResourceProfiler: SceneResourceProfiler;
  private readonly crowdCapacityBenchmark: CrowdCapacityBenchmark;
  private readonly loop: GameLoop;
  private readonly removeSceneResizeHandler: () => void;
  private gameExperience: ResolvedGameExperienceSettings;
  private hasRenderedFirstFrame = false;
  private crowdSuppressedForCapacityBenchmark = false;
  private previousPerformanceResourceSnapshot: ResourceChangeSnapshot | null = null;

  constructor({ mount, searchParams = new URLSearchParams(window.location.search) }: FootballApplicationOptions) {
    this.searchParams = searchParams;
    this.gameExperience = resolveGameExperienceSettings({ searchParams });
    this.matchController = this.createMatchController();
    this.performanceProfiler = FramePerformanceProfiler.createFromSearchParams(searchParams);
    this.qualityController = new AdaptiveQualityController(this.gameExperience.settings.qualityMode);
    this.gameplay = new GameplayRuntime({
      canPunt: (snapshot) => this.canPunt(snapshot),
      canStartPlay: (snapshot) => this.canStartPlay(snapshot),
      consumeSelectedPlayId: () => this.presentation.consumeSelectedPlayId(),
      gameMode: this.gameExperience.settings.gameMode,
      onPunt: (gameplay, snapshot) => this.handlePunt(gameplay, snapshot),
      playbookId: this.gameExperience.settings.playbookId,
      searchParams,
      shouldHoldDeadPlayReset: () => this.presentation.shouldHoldDeadPlayReset(),
      skipPresentation: () => this.presentation.skipPresentation(),
    });
    this.sceneRuntime = new SceneRuntime({ mount, searchParams });
    this.sceneRuntime.applyTeamTheme(
      resolveTeamPresentationTheme(this.gameExperience.settings.teamProfiles),
    );
    this.presentation = new PresentationRuntime({
      formationPreviewActive: !!this.gameplay.formationPreviewModel,
      gameExperience: this.gameExperience,
      initialPlays: this.gameplay.availablePlays,
      routeAuditEnabled: searchParams.has('routeAudit'),
      renderer: this.sceneRuntime.renderer,
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
      teamUniforms: resolveTeamPresentationTheme(this.gameExperience.settings.teamProfiles).uniforms,
    });
    this.playerVisuals.reconcile(this.getActivePlayers());
    this.presentation.syncBall(
      this.gameplay.formationPreviewModel?.ball ?? this.gameplay.gameplayModel.ball,
    );
    this.sceneResourceProfiler = new SceneResourceProfiler(new BrowserMemoryProvider());
    void this.sceneResourceProfiler.refreshBrowserMemory();
    this.crowdCapacityBenchmark = new CrowdCapacityBenchmark({
      candidateCounts: resolveCrowdCapacityCandidates(searchParams),
      createProfile: () => this.createMemoryProfileSnapshot(),
      scene: this.sceneRuntime.scene,
      targetFrameTimeMs: resolveCrowdCapacityTargetFrameTime(searchParams),
      targetProfile: resolveCrowdCapacityTargetProfile(searchParams),
    });
    this.performanceScenarioRunner = this.performanceProfiler.enabled
      ? new PerformanceScenarioRunner(() => this.gameplay.gameplayModel)
      : null;
    this.diagnostics = new ApplicationDiagnostics({
      applyCrowdCapacityRecommendation: () => this.applyCrowdCapacityRecommendation(),
      cancelCrowdCapacityBenchmark: () => this.cancelCrowdCapacityBenchmark(),
      gameplay: this.gameplay,
      getCrowdCapacityBenchmarkSnapshot: () => this.crowdCapacityBenchmark.getSnapshot(),
      getGameExperience: () => this.gameExperience,
      getMatchSnapshot: () => this.getMatchSnapshot(),
      getMemoryProfileSnapshot: () => this.createMemoryProfileSnapshot(),
      isCrowdPresentationDebugEnabled: () => this.isCrowdPresentationDebugEnabled(),
      playerVisuals: this.playerVisuals,
      performanceProfiler: this.performanceProfiler,
      performanceScenarioRunner: this.performanceScenarioRunner,
      runCrowdCapacityBenchmark: () => this.runCrowdCapacityBenchmark(),
      exportCrowdCapacityReport: () => this.crowdCapacityBenchmark.exportReport(),
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
      onReturnToTitle: () => this.returnToTitleScreen(),
      onStart: () => this.startGameFromTitle(),
      onTitleFirstGesture: () => {
        void this.presentation.titleMusicController.startFromUserGesture();
      },
      onTitleSettingsChange: (settings) => this.applyExperienceSettings(settings, { persist: true }),
      syncChrome: (phase) => this.presentation.syncApplicationChrome(phase),
    });
    this.matchScorebug = new MatchScorebug({
      onPunt: () =>
        this.handlePunt(
          this.gameplay.gameplayModel,
          this.gameplay.getActiveGameplaySnapshot(false),
        ),
    });
    this.opponentDriveSummary = new OpponentDriveSummaryPanel({
      onContinue: () => this.continueMatchTransition(),
    });
    this.quarterTransitionPanel = new QuarterTransitionPanel({
      onContinue: () => this.continueMatchTransition(),
      onRematch: () => this.rematch(),
      onReturnToTitle: () => this.returnToTitleScreen(),
    });
    if (this.lifecycle.phase === 'gameplay' && this.isExhibitionMatchActive()) {
      this.matchController.start(this.gameplay.gameplayModel);
    }
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
      pregameDebugEnabled: searchParams.has('pregameDebug'),
      officialsDebugEnabled: this.gameExperience.settings.officialsDebugLabels ||
        searchParams.has('officialsDebug') ||
        searchParams.has('officialsDebugLabels'),
      sidelineTeamsDebugEnabled: searchParams.has('sidelineDebug'),
      renderer: this.sceneRuntime.renderer,
      routeAuditEnabled: searchParams.has('routeAudit'),
      searchParams,
      sevenAuditEnabled: searchParams.has('sevenAudit'),
    });
    document.addEventListener('visibilitychange', this.syncAudioPageActivity);
    window.addEventListener('keydown', this.handlePregameSkipKeyDown);
    window.addEventListener('keydown', this.handleMatchTransitionKeyDown);
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
    window.removeEventListener('keydown', this.handlePregameSkipKeyDown);
    window.removeEventListener('keydown', this.handleMatchTransitionKeyDown);
    window.removeEventListener('blur', this.syncAudioPageActivity);
    window.removeEventListener('focus', this.syncAudioPageActivity);
    this.removeSceneResizeHandler();
    this.crowdCapacityBenchmark.dispose();
    this.developmentTools.dispose();
    this.lifecycle.dispose();
    this.matchScorebug.dispose();
    this.opponentDriveSummary.dispose();
    this.quarterTransitionPanel.dispose();
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

    const pauseSettingsVisible = this.lifecycle.isPauseSettingsVisible();
    const matchActive = this.isExhibitionMatchActive();
    const matchSnapshotBefore = this.getMatchSnapshot();
    const pregameActive =
      this.lifecycle.phase === 'pregamePresentation' &&
      !pauseSettingsVisible &&
      matchActive;
    const gameplayActive =
      this.lifecycle.phase === 'gameplay' &&
      !pauseSettingsVisible &&
      (!matchActive || matchSnapshotBefore?.phase === 'userPossession');
    const presentationDelta = pauseSettingsVisible ? 0 : delta;
    this.gameplay.update(delta, gameplayActive, this.performanceProfiler);
    if (gameplayActive) {
      this.performanceScenarioRunner?.update(delta);
    }
    const gameplaySnapshot = this.gameplay.getActivePresentationSnapshot(false);
    if (matchActive && this.lifecycle.phase === 'gameplay' && !pauseSettingsVisible) {
      this.matchController.update(delta, this.gameplay.gameplayModel, gameplaySnapshot);
    }
    const matchSnapshot = this.getMatchSnapshot();
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
    if (pregameActive) {
      const result = this.presentation.updatePregameFrame({
        ball: this.gameplay.formationPreviewModel?.ball ?? this.gameplay.gameplayModel.ball,
        deltaSeconds: presentationDelta,
        gameplaySnapshot,
        matchSnapshot,
        playerVisuals: this.playerVisuals.visuals,
        profiler: this.performanceProfiler,
      });
      if (result.completed) {
        this.finishPregamePresentation(false);
      }
    } else {
      this.presentation.updateGameplayFrame({
        active: gameplayActive,
        ball: this.gameplay.formationPreviewModel?.ball ?? this.gameplay.gameplayModel.ball,
        commentaryActive: !this.gameplay.formationPreviewModel,
        crowdCutawaysEnabled: !!this.presentation.crowdPresentation &&
          this.gameExperience.crowdPresentationSettings.crowdVisualsEnabled &&
          this.gameExperience.crowdPresentationSettings.crowdReactionsEnabled,
        deltaSeconds: presentationDelta,
        gameplaySnapshot,
        playerVisuals: this.playerVisuals.visuals,
        profiler: this.performanceProfiler,
        selectedPlay: this.gameplay.gameplayModel.selectedPlay,
      });
    }
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
    this.crowdCapacityBenchmark.update(delta);
    this.syncCrowdCapacityBenchmarkSuppression();
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
    this.syncMatchUi(gameplaySnapshot, matchSnapshot);
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
      controlledPlayerLabelSnapshot: this.presentation.getControlledPlayerLabelSnapshot(),
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
      pregamePresentationSnapshot: this.presentation.getPregamePresentationSnapshot(),
      renderMetrics: this.diagnostics.latestRenderMetrics,
      routeArtSnapshot: this.presentation.getRouteArtSnapshot(),
      runtimeAudioSnapshot: this.presentation.getRuntimeAudioSnapshot(),
      qualityDebugSnapshot: this.createQualityDebugSnapshot(),
      memoryDebugSnapshot: this.developmentTools.shouldCollectMemoryDiagnostics()
        ? {
            benchmark: this.crowdCapacityBenchmark.getSnapshot(),
            profile: this.createMemoryProfileSnapshot(),
          }
        : null,
      officialsSnapshot: this.presentation.getOfficialsSnapshot(),
      sidelineTeamsSnapshot: this.presentation.getSidelineTeamSnapshot(),
      sevenAuditSnapshot: this.diagnostics.getSevenAuditSnapshot(),
    });
  }

  private startGameFromTitle(): void {
    const selectedSettings = this.lifecycle.getTitleSettings(this.gameExperience.settings);
    this.applyExperienceSettings(selectedSettings, { persist: true });
    this.gameplay.startFromTitle(
      this.gameExperience.settings.playbookId,
      this.gameExperience.settings.gameMode,
    );
    this.matchController = this.createMatchController();
    if (this.gameExperience.settings.gameMode === 'exhibition') {
      this.matchController.start(this.gameplay.gameplayModel);
    }
    this.syncAfterGameplayRebuild();
    void this.presentation.titleMusicController.startFromUserGesture();
    this.presentation.titleMusicController.handoffToPregame();
    this.presentation.resetCameraPresentation();
    const gameplaySnapshot = this.gameplay.getActivePresentationSnapshot(false);
    const matchSnapshot = this.getMatchSnapshot();
    const pregameStarted = this.isExhibitionMatchActive() &&
      this.presentation.startPregamePresentation(
        gameplaySnapshot,
        matchSnapshot,
      );
    if (pregameStarted) {
      this.lifecycle.startPregamePresentation();
    } else {
      this.presentation.finishPregamePresentation(gameplaySnapshot);
      this.lifecycle.startGameplay();
    }
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
    const previousGameMode = this.gameExperience.settings.gameMode;
    if (options.persist ?? true) {
      saveGameExperienceSettings(settings);
    }
    this.gameExperience = resolveGameExperienceSettings({
      audioSettings: this.presentation.audioMixer.getSettings(),
      crowdPresentationSettings: this.gameExperience.crowdPresentationSettings,
      searchParams: this.searchParams,
    });
    const teamTheme = resolveTeamPresentationTheme(this.gameExperience.settings.teamProfiles);
    this.sceneRuntime.applyTeamTheme(teamTheme);
    this.playerVisuals.setTeamUniforms(teamTheme.uniforms);
    this.presentation.applyExperience(this.gameExperience);
    if (
      previousGameMode !== this.gameExperience.settings.gameMode ||
      previousPlaybookId !== this.gameExperience.settings.playbookId
    ) {
      this.matchController = this.createMatchController();
    }
    this.developmentTools.setDebugToolsEnabled(this.gameExperience.settings.debugToolsEnabled);
    this.qualityController.setMode(
      this.gameExperience.settings.qualityMode,
      this.createQualityTransitionContext(),
    );
    this.applyCurrentQualityProfile();
    if (
      previousPlaybookId !== this.gameExperience.settings.playbookId ||
      previousGameMode !== this.gameExperience.settings.gameMode
    ) {
      this.gameplay.rebuildForPlaybook(
        this.gameExperience.settings.playbookId,
        previousGameMode !== this.gameExperience.settings.gameMode,
        this.gameExperience.settings.gameMode,
      );
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

  private createMatchController(): MatchFlowController {
    const settings = this.gameExperience.settings;
    return new MatchFlowController({
      difficulty: settings.matchDifficulty,
      opponentTeamId: settings.teamProfiles.opponentTeamId,
      quarterDurationSeconds: settings.quarterLengthSeconds,
      userTeamId: settings.teamProfiles.userTeamId,
    });
  }

  private isExhibitionMatchActive(): boolean {
    return this.gameExperience.settings.gameMode === 'exhibition' &&
      !this.presentation.crowdPreviewController &&
      !this.gameplay.formationPreviewModel;
  }

  private getMatchSnapshot(): MatchSnapshot | null {
    return this.isExhibitionMatchActive() ? this.matchController.getSnapshot() : null;
  }

  private canStartPlay(snapshot: GameplaySnapshot): boolean {
    if (!this.isExhibitionMatchActive()) {
      return true;
    }

    return this.matchController.canStartPlay(snapshot);
  }

  private canPunt(snapshot: GameplaySnapshot): boolean {
    return this.isExhibitionMatchActive() && this.matchController.canPunt(snapshot);
  }

  private handlePunt(gameplay: GameplayModel, snapshot: GameplaySnapshot): boolean {
    if (!this.isExhibitionMatchActive()) {
      return false;
    }

    this.presentation.skipPresentation();
    return this.matchController.punt(gameplay, snapshot);
  }

  private continueMatchTransition(): void {
    if (!this.isExhibitionMatchActive()) {
      return;
    }

    this.matchController.continue(this.gameplay.gameplayModel);
    this.syncAfterGameplayRebuild();
  }

  private rematch(): void {
    if (!this.isExhibitionMatchActive()) {
      return;
    }

    this.matchController.rematch(this.gameplay.gameplayModel);
    this.syncAfterGameplayRebuild();
    this.lifecycle.startGameplay();
  }

  private returnToTitleScreen(): void {
    this.matchScorebug.sync(null, null, false);
    this.opponentDriveSummary.sync(null, false);
    this.quarterTransitionPanel.sync(null, false);
    this.lifecycle.returnToTitleScreen();
  }

  private syncMatchUi(
    gameplaySnapshot: GameplaySnapshot,
    matchSnapshot: MatchSnapshot | null,
  ): void {
    const visible = this.lifecycle.phase === 'gameplay' && this.isExhibitionMatchActive();
    this.matchScorebug.sync(matchSnapshot, gameplaySnapshot, visible);
    this.opponentDriveSummary.sync(matchSnapshot, visible);
    this.quarterTransitionPanel.sync(matchSnapshot, visible);
    document.body.dataset.gameMode = this.gameExperience.settings.gameMode;
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

  private readonly handleMatchTransitionKeyDown = (event: KeyboardEvent): void => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.key !== 'Enter' ||
      !this.isExhibitionMatchActive() ||
      this.lifecycle.phase !== 'gameplay'
    ) {
      return;
    }

    const phase = this.matchController.getSnapshot().phase;
    if (phase === 'gameOver') {
      this.rematch();
      event.preventDefault();
      return;
    }

    if (phase === 'opponentDriveSimulation' || phase === 'quarterBreak' || phase === 'halftime') {
      this.continueMatchTransition();
      event.preventDefault();
    }
  };

  private readonly handlePregameSkipKeyDown = (event: KeyboardEvent): void => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      this.lifecycle.phase !== 'pregamePresentation' ||
      (event.key !== 'Enter' && event.key !== ' ')
    ) {
      return;
    }

    event.preventDefault();
    this.finishPregamePresentation(true);
  };

  private finishPregamePresentation(skipped: boolean): void {
    if (this.lifecycle.phase !== 'pregamePresentation') {
      return;
    }

    this.gameplay.discardPendingPlayControls();
    const gameplaySnapshot = this.gameplay.getActivePresentationSnapshot(false);
    this.presentation.finishPregamePresentation(gameplaySnapshot, { skipped });
    this.lifecycle.startGameplay();
  }

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

  private createMemoryProfileSnapshot(): SceneResourceProfileSnapshot {
    return this.sceneResourceProfiler.profile({
      playerVisuals: this.playerVisuals.values(),
      renderer: this.sceneRuntime.renderer,
      scene: this.sceneRuntime.scene,
    });
  }

  private runCrowdCapacityBenchmark(): CrowdCapacityBenchmarkSnapshot {
    this.setCrowdSuppressedForCapacityBenchmark(true);
    void this.sceneResourceProfiler.refreshBrowserMemory();
    return this.crowdCapacityBenchmark.start();
  }

  private cancelCrowdCapacityBenchmark(): CrowdCapacityBenchmarkSnapshot {
    const snapshot = this.crowdCapacityBenchmark.cancel();
    this.setCrowdSuppressedForCapacityBenchmark(false);
    return snapshot;
  }

  private applyCrowdCapacityRecommendation(): CrowdDensity | null {
    return this.crowdCapacityBenchmark.applyRecommendedDensity((crowdDensity) => {
      this.applyExperienceSettings({
        ...this.gameExperience.settings,
        crowdDensity,
      }, { persist: true });
    });
  }

  private syncCrowdCapacityBenchmarkSuppression(): void {
    if (
      this.crowdSuppressedForCapacityBenchmark &&
      this.crowdCapacityBenchmark.getSnapshot().status !== 'running'
    ) {
      this.setCrowdSuppressedForCapacityBenchmark(false);
    }
  }

  private setCrowdSuppressedForCapacityBenchmark(suppressed: boolean): void {
    if (this.crowdSuppressedForCapacityBenchmark === suppressed) {
      return;
    }

    this.crowdSuppressedForCapacityBenchmark = suppressed;
    this.presentation.setCrowdBenchmarkSuppressed(suppressed);
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

function resolveCrowdCapacityCandidates(searchParams: URLSearchParams): number[] | undefined {
  const raw = searchParams.get('crowdCapacityCounts');
  if (!raw) {
    return undefined;
  }

  const counts = raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  return counts.length > 0 ? counts : undefined;
}

function resolveCrowdCapacityTargetProfile(
  searchParams: URLSearchParams,
): CrowdCapacityTargetProfile | undefined {
  const value = searchParams.get('crowdCapacityTarget');
  if (value === '30fps' || value === '60fps' || value === 'custom') {
    return value;
  }
  return undefined;
}

function resolveCrowdCapacityTargetFrameTime(
  searchParams: URLSearchParams,
): number | undefined {
  const raw = searchParams.get('crowdCapacityFrameMs');
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
