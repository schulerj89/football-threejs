import * as THREE from 'three';
import {
  createAppearanceAuditSnapshot,
} from '../appearanceAuditOverlay';
import {
  PLAYABLE_FIELD_BOUNDS,
} from '../field';
import {
  getHelmetAssetSnapshot,
} from '../helmetVisual';
import { KeyboardMovementInput, KeyboardPlayControls } from '../input';
import {
  createFormationPreviewModel,
  resolveFormationPreviewMode,
  setFormationPreviewSnapLane,
  snapshotFormationPreviewAsGameplay,
  snapshotFormationPreviewModel,
  toggleFormationPreviewPreferredSide,
  type FormationPreviewModel,
} from '../formationPreview';
import {
  resolveGameExperienceSettings,
  saveGameExperienceSettings,
  type GameExperienceSettings,
  type ResolvedGameExperienceSettings,
} from '../config/GameExperienceSettings';
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
  type GameplayModel,
  type GameplaySnapshot,
} from '../playState';
import {
  PRESENTATION_AUDIT_CONFIG,
  createCameraFramingSnapshot,
  createPresentationAuditGameplaySnapshot,
  createPresentationAuditSnapshot,
  resolvePresentationAuditState,
  type CameraFramingSnapshot,
  type PresentationAuditSnapshot,
  type PresentationAuditState,
} from '../presentationAudit';
import {
  createPresentationHardeningAuditSnapshot,
  type PresentationHardeningAuditSnapshot,
} from '../presentation/PresentationHardeningAudit';
import { snapshotPlayerModel } from '../playerModel';
import { updatePlayerSimulation } from '../playerSimulation';
import { getPlayerBodyVisualSnapshot, resolvePlayerBodyVisualStyle } from '../playerVisual';
import {
  createElevenAuditSnapshot,
  type ElevenAuditSnapshot,
} from '../elevenOnElevenAudit';
import {
  createSevenAuditSnapshot,
  type SevenAuditSnapshot,
} from '../sevenOnSevenAudit';
import { resolveCrowdPreviewEnabled } from '../crowdPreview';
import type { RenderMetricsSnapshot } from '../debugOverlay';
import { ApplicationLifecycle } from './ApplicationLifecycle';
import {
  DevelopmentToolsRuntime,
  type FootballDebugApi,
  type ElevenAuditResetCycleResult,
  type SevenAuditResetCycleResult,
} from './DevelopmentToolsRuntime';
import { GameLoop } from './GameLoop';
import { PlayerVisualRegistry } from './PlayerVisualRegistry';
import { PresentationRuntime } from './PresentationRuntime';
import { SceneRuntime } from './SceneRuntime';

export interface FootballApplicationOptions {
  mount: HTMLDivElement;
  searchParams?: URLSearchParams;
}

export class FootballApplication {
  private readonly searchParams: URLSearchParams;
  private readonly sceneRuntime: SceneRuntime;
  private readonly playerVisuals: PlayerVisualRegistry;
  private readonly presentation: PresentationRuntime;
  private readonly lifecycle: ApplicationLifecycle;
  private readonly developmentTools: DevelopmentToolsRuntime;
  private readonly keyboardInput = new KeyboardMovementInput(window);
  private readonly loop: GameLoop;
  private readonly removeSceneResizeHandler: () => void;
  private gameplayModel: GameplayModel;
  private readonly formationPreviewModel: FormationPreviewModel | null;
  private gameExperience: ResolvedGameExperienceSettings;
  private playControls: KeyboardPlayControls;
  private presentationAuditState: PresentationAuditState;
  private hasRenderedFirstFrame = false;
  private latestRenderMetrics: RenderMetricsSnapshot | null = null;

  constructor({ mount, searchParams = new URLSearchParams(window.location.search) }: FootballApplicationOptions) {
    this.searchParams = searchParams;
    this.gameExperience = resolveGameExperienceSettings({ searchParams });
    this.presentationAuditState = resolvePresentationAuditState(
      searchParams.get('presentationState'),
    );
    this.gameplayModel = createGameplayModel({
      playbookId: this.gameExperience.settings.playbookId,
    });
    const formationPreviewMode = resolveFormationPreviewMode(searchParams.get('formationPreview'));
    this.formationPreviewModel = formationPreviewMode
      ? createFormationPreviewModel(formationPreviewMode)
      : null;

    this.sceneRuntime = new SceneRuntime({ mount, searchParams });
    this.presentation = new PresentationRuntime({
      formationPreviewActive: !!this.formationPreviewModel,
      gameExperience: this.gameExperience,
      initialPlays: this.gameplayModel.availablePlays,
      routeAuditEnabled: searchParams.has('routeAudit'),
      scene: this.sceneRuntime.scene,
      searchParams,
      warn: (message) => {
        if (import.meta.env.DEV) {
          console.warn(message);
        }
      },
    });
    this.removeSceneResizeHandler = this.sceneRuntime.onResize((width, height) => {
      this.presentation.resize(width, height);
    });
    this.playerVisuals = new PlayerVisualRegistry(this.sceneRuntime.scene, {
      bodyStyle: resolvePlayerBodyVisualStyle(searchParams.get('playerBody')),
      debugRoleColors: searchParams.has('debugRoleColors'),
    });
    this.playerVisuals.reconcile(this.getActivePlayers());
    this.presentation.syncBall(this.formationPreviewModel?.ball ?? this.gameplayModel.ball);
    this.playControls = new KeyboardPlayControls(
      window,
      this.gameplayModel.availablePlays.map((play) => play.id),
    );
    this.lifecycle = new ApplicationLifecycle({
      crowdPreviewEnabled: !!this.presentation.crowdPreviewController,
      formationPreviewActive: !!this.formationPreviewModel,
      initialSettings: this.gameExperience.settings,
      searchParams,
      createTitleLoadingState: () => this.createTitleLoadingState(),
      onPauseSettingsChange: (settings) => this.handlePauseSettingsChange(settings),
      onReturnToTitle: () => this.lifecycle.returnToTitleScreen(),
      onStart: () => this.startGameFromTitle(),
      onTitleSettingsChange: (settings) => this.applyExperienceSettings(settings, { persist: true }),
      syncChrome: (phase) => this.presentation.syncApplicationChrome(phase),
    });
    this.developmentTools = new DevelopmentToolsRuntime({
      activePlayer: () => this.getActivePrimaryPlayer(),
      appearanceAuditEnabled: searchParams.has('appearanceAudit'),
      audioDebugEnabled: this.gameExperience.audioFeatureFlags.audioDebug,
      cameraDebugEnabled: searchParams.has('cameraDebug'),
      commentaryDebugEnabled: searchParams.has('commentaryDebug'),
      crowdPresentationDebugEnabled: this.isCrowdPresentationDebugEnabled() &&
        !!this.presentation.crowdPresentation,
      crowdPreviewEnabled: !!this.presentation.crowdPreviewController,
      debugApi: this.createDebugApi(),
      elevenAuditEnabled: searchParams.has('elevenAudit'),
      formationPreviewActive: !!this.formationPreviewModel,
      onCrowdPreviewControls: (event) => this.handleCrowdPreviewControls(event),
      onDevelopmentCameraToggle: (event) => this.handleDevelopmentCameraToggle(event),
      onFormationPreviewLaneControls: (event) => this.handleFormationPreviewLaneControls(event),
      onPauseSettingsShortcut: (event) => this.lifecycle.handlePauseSettingsShortcut(event, this.gameplayModel.playState),
      onPresentationAuditControls: (event) => this.handlePresentationAuditControls(event),
      passAuditEnabled: searchParams.has('passAudit'),
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
    this.playControls.dispose();
    this.playerVisuals.dispose();
    this.presentation.dispose();
    this.sceneRuntime.dispose();
  }

  private renderFrame(delta: number): void {
    if (this.presentation.crowdPreviewController) {
      this.presentation.renderCrowdPreviewFrame(delta, this.sceneRuntime.renderer);
      this.latestRenderMetrics = this.createRenderMetricsSnapshot(delta);
      const snapshot = this.presentation.getCrowdPreviewSnapshot();
      if (snapshot) {
        this.developmentTools.syncCrowdPreviewOverlay(snapshot);
      }
      this.markFirstFrameReady();
      return;
    }

    this.updateGameplay(delta);
    const gameplaySnapshot = this.getActivePresentationSnapshot();
    const gameplayPresentationActive =
      this.lifecycle.phase === 'gameplay' && !this.lifecycle.isPauseSettingsVisible();
    this.sceneRuntime.syncDriveLines(
      gameplaySnapshot.drive.lineOfScrimmage,
      gameplaySnapshot.drive.firstDownMarker,
    );
    this.playerVisuals.sync(this.getActivePlayers());
    this.presentation.updateGameplayFrame({
      active: gameplayPresentationActive,
      ball: this.formationPreviewModel?.ball ?? this.gameplayModel.ball,
      commentaryActive: !this.formationPreviewModel,
      crowdCutawaysEnabled: !!this.presentation.crowdPresentation &&
        this.gameExperience.crowdPresentationSettings.crowdVisualsEnabled &&
        this.gameExperience.crowdPresentationSettings.crowdReactionsEnabled,
      deltaSeconds: delta,
      gameplaySnapshot,
      playerVisuals: this.playerVisuals.visuals,
      selectedPlay: this.gameplayModel.selectedPlay,
    });
    this.presentation.syncPlayCallUi(
      gameplaySnapshot,
      this.lifecycle.phase === 'gameplay' && !this.lifecycle.isPauseSettingsVisible(),
    );
    this.sceneRuntime.render(this.presentation.camera);
    this.presentation.recordCrowdPresentationFrame(delta, this.sceneRuntime.renderer);
    if (this.developmentTools.shouldCollectPresentationDiagnostics()) {
      this.latestRenderMetrics = this.createRenderMetricsSnapshot(delta);
    }
    this.developmentTools.syncGameplayOverlays({
      activePrimaryPlayer: this.getActivePrimaryPlayer(),
      cameraSnapshot: this.presentation.cameraDebugSnapshot,
      crowdPresentationSnapshot: this.presentation.getCrowdPresentationSnapshot(),
      crowdPreviewSnapshot: this.presentation.getCrowdPreviewSnapshot(),
      deltaSeconds: delta,
      elevenAuditSnapshot: this.getElevenAuditSnapshot(),
      emptyPresentationAuditSnapshot: this.createEmptyPresentationAuditSnapshot(),
      formationPreviewModel: this.formationPreviewModel,
      formationPreviewSnapshot: this.formationPreviewModel
        ? snapshotFormationPreviewModel(this.formationPreviewModel)
        : null,
      gameplayModel: this.gameplayModel,
      gameplaySnapshot,
      playerBodyVisual: this.playerVisuals.get(this.getActivePrimaryPlayer().id),
      playerPoseSnapshots: this.presentation.getPlayerPoseSnapshots(),
      playerVisuals: this.playerVisuals.visuals,
      presentationAuditSnapshot: this.getPresentationAuditSnapshot(),
      presentationHardeningAuditSnapshot: this.getPresentationHardeningAuditSnapshot(),
      renderMetrics: this.latestRenderMetrics,
      routeArtSnapshot: this.presentation.getRouteArtSnapshot(),
      runtimeAudioSnapshot: this.presentation.getRuntimeAudioSnapshot(),
      sevenAuditSnapshot: this.getSevenAuditSnapshot(),
    });
    this.lifecycle.syncTitleLoadingState();
    this.lifecycle.syncChrome();
    this.markFirstFrameReady();
  }

  private updateGameplay(delta: number): void {
    if (this.formationPreviewModel) {
      for (const player of this.formationPreviewModel.players) {
        player.velocity.x = 0;
        player.velocity.z = 0;
        player.currentState = 'idle';
      }
      return;
    }

    if (this.lifecycle.phase !== 'gameplay' || this.lifecycle.isPauseSettingsVisible()) {
      this.playControls.consumeRequests();
      this.gameplayModel.player.velocity.x = 0;
      this.gameplayModel.player.velocity.z = 0;
      return;
    }

    this.updatePlayControls();
    if (
      this.gameplayModel.playState === 'live' &&
      this.gameplayModel.player.currentState === 'userControlled'
    ) {
      updatePlayerSimulation(
        this.gameplayModel.player,
        this.keyboardInput.getMovement(),
        delta,
        PLAYABLE_FIELD_BOUNDS,
        { clampSidelines: false },
      );
    } else {
      this.gameplayModel.player.velocity.x = 0;
      this.gameplayModel.player.velocity.z = 0;
    }
    updateGameplayModel(this.gameplayModel, delta, {
      suppressDeadPlayReset: this.presentation.shouldHoldDeadPlayReset(),
    });
  }

  private updatePlayControls(): void {
    const requests = this.playControls.consumeRequests();
    if (requests.startPlay || requests.resetPlay || requests.restartChallenge) {
      this.presentation.skipPresentation();
    }
    if (requests.restartChallenge) {
      restartScoreAttack(this.gameplayModel);
      return;
    }
    if (requests.resetPlay) {
      resetPlay(this.gameplayModel);
      return;
    }

    const selectedPlayId = requests.selectedPlayId ?? this.presentation.consumeSelectedPlayId();
    if (selectedPlayId) {
      selectPlay(this.gameplayModel, selectedPlayId);
    }
    if (requests.cycleReceiver) {
      cycleSelectedReceiver(this.gameplayModel);
    }
    if (requests.pass) {
      attemptPass(this.gameplayModel);
    }
    if (requests.startPlay) {
      startPlay(this.gameplayModel);
    }
  }

  private startGameFromTitle(): void {
    const selectedSettings = this.lifecycle.getTitleSettings(this.gameExperience.settings);
    this.applyExperienceSettings(selectedSettings, { persist: true });
    this.rebuildGameplayForPlaybook(this.gameExperience.settings.playbookId, true);
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
    if (previousPlaybookId !== this.gameExperience.settings.playbookId) {
      this.rebuildGameplayForPlaybook(this.gameExperience.settings.playbookId);
    }
    this.lifecycle.setSettings(this.gameExperience.settings);
    this.lifecycle.syncTitleLoadingState();
    this.lifecycle.syncChrome();
  }

  private rebuildGameplayForPlaybook(
    nextPlaybookId: GameExperienceSettings['playbookId'],
    force = false,
  ): void {
    if (!force && this.gameplayModel.playbookId === nextPlaybookId) {
      return;
    }

    this.gameplayModel = createGameplayModel({ playbookId: nextPlaybookId });
    this.playControls.dispose();
    this.playControls = new KeyboardPlayControls(
      window,
      this.gameplayModel.availablePlays.map((play) => play.id),
    );
    this.presentation.setPlays(this.gameplayModel.availablePlays);
    this.playerVisuals.reconcile(this.getActivePlayers());
    this.presentation.syncBall(this.gameplayModel.ball);
    this.presentation.resetCameraPresentation();
  }

  private getActivePlayers() {
    if (this.presentation.crowdPreviewController) {
      return [];
    }
    return this.formationPreviewModel?.players ?? this.gameplayModel.players;
  }

  private getActivePrimaryPlayer() {
    return this.formationPreviewModel
      ? this.formationPreviewModel.players.find((player) => player.id === 'offense-qb') ??
          this.formationPreviewModel.players[0]
      : this.gameplayModel.player;
  }

  private getActiveGameplaySnapshot(): GameplaySnapshot {
    const snapshot = this.formationPreviewModel
      ? snapshotFormationPreviewAsGameplay(this.formationPreviewModel)
      : snapshotGameplayModel(this.gameplayModel);
    if (this.presentation.crowdPreviewController) {
      return { ...snapshot, players: [] };
    }
    return snapshot;
  }

  private getActivePresentationSnapshot(): GameplaySnapshot {
    const snapshot = this.getActiveGameplaySnapshot();
    if (!this.searchParams.has('presentationAudit') || !this.formationPreviewModel) {
      return snapshot;
    }
    return createPresentationAuditGameplaySnapshot(snapshot, this.presentationAuditState);
  }

  private createRenderMetricsSnapshot(deltaSeconds: number): RenderMetricsSnapshot {
    return this.sceneRuntime.createRenderMetricsSnapshot(
      deltaSeconds,
      this.playerVisuals.values(),
      this.getActivePlayers().length,
    );
  }

  private getCameraFramingSnapshot(): CameraFramingSnapshot {
    return createCameraFramingSnapshot(
      this.presentation.camera as THREE.PerspectiveCamera,
      this.playerVisuals.visuals,
      this.searchParams.has('presentationAudit') ? PRESENTATION_AUDIT_CONFIG.framingMarginNdc : 0,
    );
  }

  private getPresentationAuditSnapshot(): PresentationAuditSnapshot | null {
    if (!this.searchParams.has('presentationAudit')) {
      return null;
    }

    return createPresentationAuditSnapshot({
      camera: this.presentation.camera as THREE.PerspectiveCamera,
      cameraDebug: this.presentation.cameraDebugSnapshot,
      formation: this.formationPreviewModel ? snapshotFormationPreviewModel(this.formationPreviewModel) : null,
      gameplay: this.getActivePresentationSnapshot(),
      playerMotionEnabled: this.gameExperience.settings.playerMotionEnabled,
      playerVisuals: this.playerVisuals.visuals,
      poseSnapshots: this.presentation.getPlayerPoseSnapshots(),
      renderMetrics: this.latestRenderMetrics,
      state: this.presentationAuditState,
    });
  }

  private getPresentationHardeningAuditSnapshot(): PresentationHardeningAuditSnapshot | null {
    if (!this.searchParams.has('presentationAudit') && !this.isCrowdPresentationDebugEnabled()) {
      return null;
    }

    const gameplaySnapshot = this.getActivePresentationSnapshot();
    return createPresentationHardeningAuditSnapshot({
      audio: this.presentation.getRuntimeAudioSnapshot(),
      camera: this.presentation.cameraDebugSnapshot,
      cinematics: this.gameExperience.settings.cinematics,
      crowd: this.presentation.getCrowdPresentationSnapshot(),
      crowdSettings: this.gameExperience.crowdPresentationSettings,
      currentResultType: gameplaySnapshot.lastPlayResult?.type ?? null,
      hold: this.presentation.holdSnapshot,
      renderMetrics: this.latestRenderMetrics,
    });
  }

  private getElevenAuditSnapshot(): ElevenAuditSnapshot | null {
    if (!this.searchParams.has('elevenAudit')) {
      return null;
    }
    const renderMetrics = this.latestRenderMetrics ?? this.createRenderMetricsSnapshot(0);
    const crowdSnapshot = this.presentation.getCrowdPresentationSnapshot();
    return createElevenAuditSnapshot({
      activeAudioNodes: this.presentation.getRuntimeAudioSnapshot().activeAudioNodeCount,
      cameraContainment: this.getCameraFramingSnapshot(),
      crowdReaction: crowdSnapshot?.reactionState ?? null,
      gameplay: this.getActivePresentationSnapshot(),
      helmetInstanceCount: getHelmetAssetSnapshot().attachedPlayerIds.length,
      materialCount: renderMetrics.sceneMaterialCount,
      play: this.gameplayModel.selectedPlay,
      playerVisualCount: this.playerVisuals.size,
      presentation: this.presentation.getGamePresentationRuntimeSnapshot(),
      presentationHold: this.presentation.holdSnapshot,
      renderMetrics,
    });
  }

  private getSevenAuditSnapshot(): SevenAuditSnapshot | null {
    if (!this.searchParams.has('sevenAudit')) {
      return null;
    }
    const renderMetrics = this.latestRenderMetrics ?? this.createRenderMetricsSnapshot(0);
    return createSevenAuditSnapshot({
      activeAudioNodes: this.presentation.getRuntimeAudioSnapshot().activeAudioNodeCount,
      gameplay: this.getActivePresentationSnapshot(),
      materialCount: renderMetrics.sceneMaterialCount,
      play: this.gameplayModel.selectedPlay,
      playerVisualCount: this.playerVisuals.size,
      presentation: this.presentation.getGamePresentationRuntimeSnapshot(),
      renderMetrics,
    });
  }

  private runElevenAuditResetCycles(cycles: number): ElevenAuditResetCycleResult | null {
    if (this.presentation.crowdPreviewController || this.formationPreviewModel || this.gameplayModel.playbookId !== '11v11') {
      return null;
    }
    const cycleCount = Math.max(0, Math.min(500, Math.floor(cycles)));
    const before = this.createElevenAuditResetCycleResourceSnapshot();
    for (let cycle = 0; cycle < cycleCount; cycle += 1) {
      if (this.gameplayModel.playState !== 'preSnap') {
        resetPlay(this.gameplayModel);
      }
      startPlay(this.gameplayModel);
      resetPlay(this.gameplayModel);
      this.playerVisuals.reconcile(this.getActivePlayers());
      this.presentation.syncBall(this.gameplayModel.ball);
      this.presentation.runRouteArtUpdate(snapshotGameplayModel(this.gameplayModel), this.gameplayModel.selectedPlay);
      this.presentation.skipPresentationHold();
      this.presentation.skipPresentation();
    }
    return { after: this.createElevenAuditResetCycleResourceSnapshot(), before, cycles: cycleCount };
  }

  private runSevenAuditResetCycles(cycles: number): SevenAuditResetCycleResult | null {
    if (this.presentation.crowdPreviewController || this.formationPreviewModel) {
      return null;
    }
    const cycleCount = Math.max(0, Math.min(500, Math.floor(cycles)));
    const before = this.createSevenAuditResetCycleResourceSnapshot();
    for (let cycle = 0; cycle < cycleCount; cycle += 1) {
      if (this.gameplayModel.playState !== 'preSnap') {
        resetPlay(this.gameplayModel);
      }
      startPlay(this.gameplayModel);
      resetPlay(this.gameplayModel);
      this.playerVisuals.reconcile(this.getActivePlayers());
      this.presentation.syncBall(this.gameplayModel.ball);
      this.presentation.runRouteArtUpdate(snapshotGameplayModel(this.gameplayModel), this.gameplayModel.selectedPlay);
      this.presentation.skipPresentation();
    }
    return { after: this.createSevenAuditResetCycleResourceSnapshot(), before, cycles: cycleCount };
  }

  private createElevenAuditResetCycleResourceSnapshot() {
    const metrics = this.createRenderMetricsSnapshot(0);
    const audio = this.presentation.getRuntimeAudioSnapshot();
    const hold = this.presentation.holdSnapshot;
    const crowd = this.presentation.getCrowdPresentationSnapshot();
    return {
      activeAudioNodes: audio.activeAudioNodeCount,
      activeCameraShot: this.presentation.cameraDebugSnapshot.activeShotName ?? null,
      activePlayerRootCount: this.getActivePlayers().length,
      activePresentationHold: hold.active,
      crowdReaction: crowd?.reactionState ?? null,
      geometryCount: metrics.geometries,
      helmetInstanceCount: getHelmetAssetSnapshot().attachedPlayerIds.length,
      materialCount: metrics.sceneMaterialCount,
      presentationHistoryCount: this.presentation.getGamePresentationRuntimeSnapshot().history.length,
      visualRootCount: this.playerVisuals.size,
    };
  }

  private createSevenAuditResetCycleResourceSnapshot() {
    const metrics = this.createRenderMetricsSnapshot(0);
    const audio = this.presentation.getRuntimeAudioSnapshot();
    return {
      activeAudioNodes: audio.activeAudioNodeCount,
      activePlayerRootCount: this.getActivePlayers().length,
      geometryCount: metrics.geometries,
      materialCount: metrics.sceneMaterialCount,
      presentationHistoryCount: this.presentation.getGamePresentationRuntimeSnapshot().history.length,
      visualRootCount: this.playerVisuals.size,
    };
  }

  private createEmptyPresentationAuditSnapshot(): PresentationAuditSnapshot {
    return {
      allFeetGrounded: true,
      allHelmetsAttached: true,
      allPlayersInsideFramingMargin: true,
      cameraMode: this.presentation.cameraDebugSnapshot.mode,
      cameraState: this.presentation.cameraDebugSnapshot.state,
      enabled: true,
      formationIssueCount: 0,
      framingMarginNdc: PRESENTATION_AUDIT_CONFIG.framingMarginNdc,
      issues: [],
      playerMotionEnabled: this.gameExperience.settings.playerMotionEnabled,
      players: [],
      presentationPhase: this.presentation.cameraDebugSnapshot.presentationPhase ?? null,
      renderMetrics: null,
      snapLane: this.formationPreviewModel?.snapPlacement.lane ?? this.gameplayModel.drive.snapLane,
      stableHelmetGaps: true,
      state: this.presentationAuditState,
    };
  }

  private createTitleLoadingState() {
    const helmetSnapshot = getHelmetAssetSnapshot();
    const audioSnapshot = this.presentation.getRuntimeAudioSnapshot();
    const crowdSnapshot = this.presentation.getCrowdPresentationSnapshot();
    const audioStatus = this.gameExperience.settings.audioEnabled
      ? audioSnapshot.userGestureUnlocked
        ? `Ready (${audioSnapshot.contextState})`
        : 'Ready after Start'
      : 'Disabled';
    const crowdStatus = this.gameExperience.settings.crowdVisualsEnabled
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

  private createDebugApi(): FootballDebugApi {
    return {
      forceQuarterbackPastLineForTest: () => {
        if (
          this.gameplayModel.playState !== 'live' ||
          this.gameplayModel.player.role !== 'quarterback'
        ) {
          return false;
        }
        this.gameplayModel.player.position.z = this.gameplayModel.drive.lineOfScrimmage.z + 0.25;
        this.gameplayModel.player.velocity.x = 0;
        this.gameplayModel.player.velocity.z = 0;
        return true;
      },
      getAudioSnapshot: () => this.presentation.getRuntimeAudioSnapshot(),
      getAppearanceAuditSnapshot: () => createAppearanceAuditSnapshot(this.playerVisuals.visuals),
      getBallVisualSnapshot: () => this.presentation.getBallVisualSnapshot(),
      getCameraSnapshot: () => this.presentation.cameraDebugSnapshot,
      getCameraFramingSnapshot: () => this.getCameraFramingSnapshot(),
      getCrowdPresentationSnapshot: () => this.presentation.getCrowdPresentationSnapshot(),
      getCrowdPreviewSnapshot: () => this.presentation.getCrowdPreviewSnapshot(),
      getFormationPreviewSnapshot: () =>
        this.formationPreviewModel ? snapshotFormationPreviewModel(this.formationPreviewModel) : null,
      getGameExperienceSnapshot: () => this.presentation.getGameExperienceSnapshot(),
      getGameplaySnapshot: () => this.getActivePresentationSnapshot(),
      getGamePresentationRuntimeSnapshot: () => this.presentation.getGamePresentationRuntimeSnapshot(),
      getHelmetAssetSnapshot,
      getPassAuditSnapshot: () => this.getActivePresentationSnapshot().passAudit,
      getElevenAuditSnapshot: () => this.getElevenAuditSnapshot(),
      getPresentationHardeningAuditSnapshot: () => this.getPresentationHardeningAuditSnapshot(),
      getPresentationHoldSnapshot: () => this.presentation.holdSnapshot,
      getPresentationAuditSnapshot: () => this.getPresentationAuditSnapshot(),
      getSevenAuditSnapshot: () => this.getSevenAuditSnapshot(),
      getPlayerBodyVisualSnapshots: () => this.playerVisuals.getBodySnapshots(),
      getPlayerPoseSnapshots: () => this.presentation.getPlayerPoseSnapshots(),
      getPlayerSnapshot: () => snapshotPlayerModel(this.getActivePrimaryPlayer()),
      getRenderMetrics: () => this.latestRenderMetrics ?? this.createRenderMetricsSnapshot(0),
      getRouteArtSnapshot: () => this.presentation.getRouteArtSnapshot(),
      playAudioTestOneShot: () => this.presentation.gameAudioDirector.playTestOneShot(),
      runElevenAuditResetCycles: (cycles = 100) => this.runElevenAuditResetCycles(cycles),
      runSevenAuditResetCycles: (cycles = 100) => this.runSevenAuditResetCycles(cycles),
      setCrowdPreviewCameraView: (view) => {
        this.presentation.crowdPreviewController?.setCameraView(view);
      },
      setAnnouncerEnabled: (enabled) => {
        this.presentation.broadcastCommentaryDirector.setAnnouncerEnabled(enabled);
      },
      setAnnouncerVolume: (volume) => {
        this.presentation.broadcastCommentaryDirector.setAnnouncerVolume(volume);
      },
      setAudioPageActiveForTest: (active) => {
        this.presentation.setPageActive(active);
      },
      setAudioMuted: (muted) => {
        this.presentation.gameAudioDirector.setMuted(muted);
      },
      setCaptionsEnabled: (enabled) => {
        this.presentation.broadcastCommentaryDirector.setCaptionsEnabled(enabled);
      },
      startAudioTestLoop: () => this.presentation.gameAudioDirector.startTestLoop(),
      stopAudioTestLoop: () => this.presentation.gameAudioDirector.stopTestLoop(),
    };
  }

  private handleFormationPreviewLaneControls(event: KeyboardEvent): void {
    if (!this.formationPreviewModel || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === '1') {
      setFormationPreviewSnapLane(this.formationPreviewModel, 'leftHash');
      this.presentation.resetCameraPresentation();
      event.preventDefault();
      return;
    }
    if (event.key === '2') {
      setFormationPreviewSnapLane(this.formationPreviewModel, 'middle');
      this.presentation.resetCameraPresentation();
      event.preventDefault();
      return;
    }
    if (event.key === '3') {
      setFormationPreviewSnapLane(this.formationPreviewModel, 'rightHash');
      this.presentation.resetCameraPresentation();
      event.preventDefault();
      return;
    }
    if (event.key === '4' && this.formationPreviewModel.mode === '11v11') {
      toggleFormationPreviewPreferredSide(this.formationPreviewModel);
      this.presentation.resetCameraPresentation();
      event.preventDefault();
    }
  }

  private handlePresentationAuditControls(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key.toLowerCase() === 'l') {
      this.presentationAuditState = 'locomotionPreview';
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === 'p') {
      this.presentationAuditState = 'preSnap';
      this.presentation.resetCameraPresentation();
      event.preventDefault();
    }
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
    this.presentation.toggleCameraMode(this.getActiveGameplaySnapshot());
    event.preventDefault();
  }

  private readonly syncAudioPageActivity = (): void => {
    this.presentation.setPageActive(!document.hidden && document.hasFocus());
  };

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
