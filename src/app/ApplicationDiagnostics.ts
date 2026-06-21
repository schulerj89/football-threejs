import * as THREE from 'three';
import { createAppearanceAuditSnapshot } from '../appearanceAuditOverlay';
import { getHelmetAssetSnapshot } from '../helmetVisual';
import { snapshotFormationPreviewModel } from '../formationPreview';
import type { FormationPreviewSnapshot } from '../formationPreview';
import type { ResolvedGameExperienceSettings } from '../config/GameExperienceSettings';
import {
  resetPlay,
  snapshotGameplayModel,
  startPlay,
} from '../playState';
import {
  PRESENTATION_AUDIT_CONFIG,
  createCameraFramingSnapshot,
  createPresentationAuditSnapshot,
  type CameraFramingSnapshot,
  type PresentationAuditSnapshot,
} from '../presentationAudit';
import {
  createPresentationHardeningAuditSnapshot,
  type PresentationHardeningAuditSnapshot,
} from '../presentation/PresentationHardeningAudit';
import { snapshotPlayerModel } from '../playerModel';
import {
  createElevenAuditSnapshot,
  type ElevenAuditSnapshot,
} from '../elevenOnElevenAudit';
import {
  createSevenAuditSnapshot,
  type SevenAuditSnapshot,
} from '../sevenOnSevenAudit';
import type { RenderMetricsSnapshot } from '../debugOverlay';
import {
  createPerformanceReport,
  type PerformanceReport,
  type PerformanceReportEnvironment,
} from '../performance/PerformanceReport';
import type {
  FramePerformanceProfiler,
} from '../performance/FramePerformanceProfiler';
import {
  collectRendererMetrics,
  collectSceneStructureMetrics,
} from '../performance/RendererMetricsCollector';
import type {
  PerformanceScenarioRunner,
  PerformanceScenarioSnapshot,
} from '../performance/PerformanceScenarioRunner';
import type {
  CrowdCapacityBenchmarkSnapshot,
  CrowdCapacityReport,
  SceneResourceProfileSnapshot,
} from '../performance/MemoryTypes';
import type { QualityDebugSnapshot } from '../ui/PerformanceSettingsPanel';
import type { PerformanceScenarioName } from '../performance/PerformanceBudget';
import type {
  ElevenAuditResetCycleResult,
  FootballDebugApi,
  SevenAuditResetCycleResult,
} from './DevelopmentToolsRuntime';
import type { GameplayRuntime } from './GameplayRuntime';
import type { PlayerVisualRegistry } from './PlayerVisualRegistry';
import type { PresentationRuntime } from './PresentationRuntime';
import type { SceneRuntime } from './SceneRuntime';

export interface ApplicationDiagnosticsOptions {
  getGameExperience: () => ResolvedGameExperienceSettings;
  getCrowdCapacityBenchmarkSnapshot: () => CrowdCapacityBenchmarkSnapshot;
  isCrowdPresentationDebugEnabled: () => boolean;
  getMemoryProfileSnapshot: () => SceneResourceProfileSnapshot;
  runCrowdCapacityBenchmark: () => CrowdCapacityBenchmarkSnapshot;
  cancelCrowdCapacityBenchmark: () => CrowdCapacityBenchmarkSnapshot;
  applyCrowdCapacityRecommendation: () => string | null;
  exportCrowdCapacityReport: () => CrowdCapacityReport | null;
  gameplay: GameplayRuntime;
  getQualityDebugSnapshot: () => QualityDebugSnapshot;
  playerVisuals: PlayerVisualRegistry;
  performanceProfiler: FramePerformanceProfiler;
  performanceScenarioRunner: PerformanceScenarioRunner | null;
  presentation: PresentationRuntime;
  sceneRuntime: SceneRuntime;
  searchParams: URLSearchParams;
}

export class ApplicationDiagnostics {
  latestRenderMetrics: RenderMetricsSnapshot | null = null;

  constructor(private readonly options: ApplicationDiagnosticsOptions) {}

  createRenderMetricsSnapshot(deltaSeconds: number): RenderMetricsSnapshot {
    return this.options.sceneRuntime.createRenderMetricsSnapshot(
      deltaSeconds,
      this.options.playerVisuals.values(),
      this.options.gameplay.getActivePlayers(!!this.options.presentation.crowdPreviewController).length,
    );
  }

  getCameraFramingSnapshot(): CameraFramingSnapshot {
    return createCameraFramingSnapshot(
      this.options.presentation.camera as THREE.PerspectiveCamera,
      this.options.playerVisuals.visuals,
      this.options.searchParams.has('presentationAudit')
        ? PRESENTATION_AUDIT_CONFIG.framingMarginNdc
        : 0,
    );
  }

  getPresentationAuditSnapshot(): PresentationAuditSnapshot | null {
    if (!this.options.searchParams.has('presentationAudit')) {
      return null;
    }

    const gameExperience = this.options.getGameExperience();
    return createPresentationAuditSnapshot({
      camera: this.options.presentation.camera as THREE.PerspectiveCamera,
      cameraDebug: this.options.presentation.cameraDebugSnapshot,
      formation: this.options.gameplay.formationPreviewModel
        ? snapshotFormationPreviewModel(this.options.gameplay.formationPreviewModel)
        : null,
      gameplay: this.options.gameplay.getActivePresentationSnapshot(
        !!this.options.presentation.crowdPreviewController,
      ),
      playerMotionEnabled: gameExperience.settings.playerMotionEnabled,
      playerVisuals: this.options.playerVisuals.visuals,
      poseSnapshots: this.options.presentation.getPlayerPoseSnapshots(),
      renderMetrics: this.latestRenderMetrics,
      state: this.options.gameplay.auditState,
    });
  }

  getPresentationHardeningAuditSnapshot(): PresentationHardeningAuditSnapshot | null {
    if (
      !this.options.searchParams.has('presentationAudit') &&
      !this.options.isCrowdPresentationDebugEnabled()
    ) {
      return null;
    }

    const gameExperience = this.options.getGameExperience();
    const gameplaySnapshot = this.options.gameplay.getActivePresentationSnapshot(
      !!this.options.presentation.crowdPreviewController,
    );
    return createPresentationHardeningAuditSnapshot({
      audio: this.options.presentation.getRuntimeAudioSnapshot(),
      camera: this.options.presentation.cameraDebugSnapshot,
      cinematics: gameExperience.settings.cinematics,
      crowd: this.options.presentation.getCrowdPresentationSnapshot(),
      crowdSettings: gameExperience.crowdPresentationSettings,
      currentResultType: gameplaySnapshot.lastPlayResult?.type ?? null,
      hold: this.options.presentation.holdSnapshot,
      renderMetrics: this.latestRenderMetrics,
    });
  }

  getElevenAuditSnapshot(): ElevenAuditSnapshot | null {
    if (!this.options.searchParams.has('elevenAudit')) {
      return null;
    }
    const renderMetrics = this.latestRenderMetrics ?? this.createRenderMetricsSnapshot(0);
    const crowdSnapshot = this.options.presentation.getCrowdPresentationSnapshot();
    return createElevenAuditSnapshot({
      activeAudioNodes: this.options.presentation.getRuntimeAudioSnapshot().activeAudioNodeCount,
      cameraContainment: this.getCameraFramingSnapshot(),
      crowdReaction: crowdSnapshot?.reactionState ?? null,
      gameplay: this.options.gameplay.getActivePresentationSnapshot(
        !!this.options.presentation.crowdPreviewController,
      ),
      helmetInstanceCount: getHelmetAssetSnapshot().attachedPlayerIds.length,
      materialCount: renderMetrics.sceneMaterialCount,
      play: this.options.gameplay.gameplayModel.selectedPlay,
      playerVisualCount: this.options.playerVisuals.size,
      presentation: this.options.presentation.getGamePresentationRuntimeSnapshot(),
      presentationHold: this.options.presentation.holdSnapshot,
      renderMetrics,
    });
  }

  getSevenAuditSnapshot(): SevenAuditSnapshot | null {
    if (!this.options.searchParams.has('sevenAudit')) {
      return null;
    }
    const renderMetrics = this.latestRenderMetrics ?? this.createRenderMetricsSnapshot(0);
    return createSevenAuditSnapshot({
      activeAudioNodes: this.options.presentation.getRuntimeAudioSnapshot().activeAudioNodeCount,
      gameplay: this.options.gameplay.getActivePresentationSnapshot(
        !!this.options.presentation.crowdPreviewController,
      ),
      materialCount: renderMetrics.sceneMaterialCount,
      play: this.options.gameplay.gameplayModel.selectedPlay,
      playerVisualCount: this.options.playerVisuals.size,
      presentation: this.options.presentation.getGamePresentationRuntimeSnapshot(),
      renderMetrics,
    });
  }

  getFormationPreviewSnapshot(): FormationPreviewSnapshot | null {
    return this.options.gameplay.formationPreviewModel
      ? snapshotFormationPreviewModel(this.options.gameplay.formationPreviewModel)
      : null;
  }

  createEmptyPresentationAuditSnapshot(): PresentationAuditSnapshot {
    const gameExperience = this.options.getGameExperience();
    return {
      allFeetGrounded: true,
      allHelmetsAttached: true,
      allPlayersInsideFramingMargin: true,
      cameraMode: this.options.presentation.cameraDebugSnapshot.mode,
      cameraState: this.options.presentation.cameraDebugSnapshot.state,
      enabled: true,
      formationIssueCount: 0,
      framingMarginNdc: PRESENTATION_AUDIT_CONFIG.framingMarginNdc,
      issues: [],
      playerMotionEnabled: gameExperience.settings.playerMotionEnabled,
      players: [],
      presentationPhase: this.options.presentation.cameraDebugSnapshot.presentationPhase ?? null,
      renderMetrics: null,
      snapLane: this.options.gameplay.formationPreviewModel?.snapPlacement.lane ??
        this.options.gameplay.gameplayModel.drive.snapLane,
      stableHelmetGaps: true,
      state: this.options.gameplay.auditState,
    };
  }

  createTitleLoadingState() {
    const gameExperience = this.options.getGameExperience();
    const helmetSnapshot = getHelmetAssetSnapshot();
    const audioSnapshot = this.options.presentation.getRuntimeAudioSnapshot();
    const crowdSnapshot = this.options.presentation.getCrowdPresentationSnapshot();
    const audioStatus = gameExperience.settings.audioEnabled
      ? audioSnapshot.userGestureUnlocked
        ? `Ready (${audioSnapshot.contextState})`
        : 'Ready after Start'
      : 'Disabled';
    const crowdStatus = gameExperience.settings.crowdVisualsEnabled
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

  createDebugApi(): FootballDebugApi {
    return {
      forceQuarterbackPastLineForTest: () => {
        const gameplayModel = this.options.gameplay.gameplayModel;
        if (gameplayModel.playState !== 'live' || gameplayModel.player.role !== 'quarterback') {
          return false;
        }
        gameplayModel.player.position.z = gameplayModel.drive.lineOfScrimmage.z + 0.25;
        gameplayModel.player.velocity.x = 0;
        gameplayModel.player.velocity.z = 0;
        return true;
      },
      getAudioSnapshot: () => this.options.presentation.getRuntimeAudioSnapshot(),
      getAppearanceAuditSnapshot: () =>
        createAppearanceAuditSnapshot(this.options.playerVisuals.visuals),
      getBallVisualSnapshot: () => this.options.presentation.getBallVisualSnapshot(),
      getCameraSnapshot: () => this.options.presentation.cameraDebugSnapshot,
      getControlledPlayerLabelSnapshot: () =>
        this.options.presentation.getControlledPlayerLabelSnapshot(),
      getCameraFramingSnapshot: () => this.getCameraFramingSnapshot(),
      getCrowdPresentationSnapshot: () => this.options.presentation.getCrowdPresentationSnapshot(),
      getCrowdPreviewSnapshot: () => this.options.presentation.getCrowdPreviewSnapshot(),
      getFormationPreviewSnapshot: () =>
        this.options.gameplay.formationPreviewModel
          ? snapshotFormationPreviewModel(this.options.gameplay.formationPreviewModel)
          : null,
      getGameExperienceSnapshot: () => this.options.presentation.getGameExperienceSnapshot(),
      getGameplaySnapshot: () =>
        this.options.gameplay.getActivePresentationSnapshot(
          !!this.options.presentation.crowdPreviewController,
        ),
      getGamePresentationRuntimeSnapshot: () =>
        this.options.presentation.getGamePresentationRuntimeSnapshot(),
      getHelmetAssetSnapshot,
      getOfficialsSnapshot: () => this.options.presentation.getOfficialsSnapshot(),
      getCrowdCapacityBenchmarkSnapshot: () =>
        this.options.getCrowdCapacityBenchmarkSnapshot(),
      getMemoryProfileSnapshot: () => this.options.getMemoryProfileSnapshot(),
      getPassAuditSnapshot: () =>
        this.options.gameplay.getActivePresentationSnapshot(
          !!this.options.presentation.crowdPreviewController,
        ).passAudit,
      getQualityDebugSnapshot: () => this.options.getQualityDebugSnapshot(),
      clearPerformanceSamples: () => this.options.performanceProfiler.clear(),
      getElevenAuditSnapshot: () => this.getElevenAuditSnapshot(),
      getPerformanceProfileReport: (environment) =>
        this.createPerformanceProfileReport(environment),
      getPerformanceScenarioSnapshot: () => this.getPerformanceScenarioSnapshot(),
      getPresentationHardeningAuditSnapshot: () => this.getPresentationHardeningAuditSnapshot(),
      getPresentationHoldSnapshot: () => this.options.presentation.holdSnapshot,
      getPresentationAuditSnapshot: () => this.getPresentationAuditSnapshot(),
      getSevenAuditSnapshot: () => this.getSevenAuditSnapshot(),
      getStadiumSnapshot: () => this.options.presentation.getStadiumSnapshot(),
      getPlayerBodyVisualSnapshots: () => this.options.playerVisuals.getBodySnapshots(),
      getPlayerPoseSnapshots: () => this.options.presentation.getPlayerPoseSnapshots(),
      getPlayerSnapshot: () =>
        snapshotPlayerModel(this.options.gameplay.getActivePrimaryPlayer()),
      getRenderMetrics: () => this.latestRenderMetrics ?? this.createRenderMetricsSnapshot(0),
      getRouteArtSnapshot: () => this.options.presentation.getRouteArtSnapshot(),
      playAudioTestOneShot: () => this.options.presentation.gameAudioDirector.playTestOneShot(),
      applyCrowdCapacityRecommendation: () =>
        this.options.applyCrowdCapacityRecommendation(),
      cancelCrowdCapacityBenchmark: () => this.options.cancelCrowdCapacityBenchmark(),
      exportCrowdCapacityReport: () => this.options.exportCrowdCapacityReport(),
      runCrowdCapacityBenchmark: () => this.options.runCrowdCapacityBenchmark(),
      runElevenAuditResetCycles: (cycles = 100) => this.runElevenAuditResetCycles(cycles),
      runSevenAuditResetCycles: (cycles = 100) => this.runSevenAuditResetCycles(cycles),
      setPerformanceScenario: (scenario) =>
        this.options.performanceScenarioRunner?.setScenario(scenario) ?? null,
      setCrowdPreviewCameraView: (view) => {
        this.options.presentation.crowdPreviewController?.setCameraView(view);
      },
      setAnnouncerEnabled: (enabled) => {
        this.options.presentation.broadcastCommentaryDirector.setAnnouncerEnabled(enabled);
      },
      setAnnouncerVolume: (volume) => {
        this.options.presentation.broadcastCommentaryDirector.setAnnouncerVolume(volume);
      },
      setAudioPageActiveForTest: (active) => {
        this.options.presentation.setPageActive(active);
      },
      setAudioMuted: (muted) => {
        this.options.presentation.gameAudioDirector.setMuted(muted);
      },
      setCaptionsEnabled: (enabled) => {
        this.options.presentation.broadcastCommentaryDirector.setCaptionsEnabled(enabled);
      },
      startAudioTestLoop: () => this.options.presentation.gameAudioDirector.startTestLoop(),
      stopAudioTestLoop: () => this.options.presentation.gameAudioDirector.stopTestLoop(),
    };
  }

  private createPerformanceProfileReport(
    environment: Partial<PerformanceReportEnvironment> = {},
  ): PerformanceReport {
    const renderer = collectRendererMetrics(this.options.sceneRuntime.renderer);
    const scene = collectSceneStructureMetrics(
      this.options.sceneRuntime.scene,
      this.options.playerVisuals.values(),
    );
    const defaultEnvironment: PerformanceReportEnvironment = {
      deviceScaleFactor: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      hiddenFrameCount: 0,
      rendererDescription: 'unknown',
      softwareRendering: false,
      userAgent: navigator.userAgent,
      viewport: {
        height: window.innerHeight,
        width: window.innerWidth,
      },
    };

    return createPerformanceReport({
      activeScenario:
        this.options.performanceScenarioRunner?.getActiveScenarioName() ?? 'normal-gameplay',
      environment: {
        ...defaultEnvironment,
        ...environment,
        viewport: {
          ...defaultEnvironment.viewport,
          ...environment.viewport,
        },
      },
      renderer,
      scene,
      snapshot: this.options.performanceProfiler.getSnapshot(),
    });
  }

  createPerformanceProfileReportForDebug(): PerformanceReport {
    return this.createPerformanceProfileReport();
  }

  private getPerformanceScenarioSnapshot(): PerformanceScenarioSnapshot | null {
    return this.options.performanceScenarioRunner?.getSnapshot() ?? null;
  }

  private runElevenAuditResetCycles(cycles: number): ElevenAuditResetCycleResult | null {
    const gameplay = this.options.gameplay;
    if (
      this.options.presentation.crowdPreviewController ||
      gameplay.formationPreviewModel ||
      gameplay.gameplayModel.playbookId !== '11v11'
    ) {
      return null;
    }
    const cycleCount = Math.max(0, Math.min(500, Math.floor(cycles)));
    const before = this.createElevenAuditResetCycleResourceSnapshot();
    for (let cycle = 0; cycle < cycleCount; cycle += 1) {
      if (gameplay.gameplayModel.playState !== 'preSnap') {
        resetPlay(gameplay.gameplayModel);
      }
      startPlay(gameplay.gameplayModel);
      resetPlay(gameplay.gameplayModel);
      this.options.playerVisuals.reconcile(this.getActivePlayers());
      this.options.presentation.syncBall(gameplay.gameplayModel.ball);
      this.options.presentation.runRouteArtUpdate(
        snapshotGameplayModel(gameplay.gameplayModel),
        gameplay.gameplayModel.selectedPlay,
      );
      this.options.presentation.skipPresentationHold();
      this.options.presentation.skipPresentation();
    }
    return { after: this.createElevenAuditResetCycleResourceSnapshot(), before, cycles: cycleCount };
  }

  private runSevenAuditResetCycles(cycles: number): SevenAuditResetCycleResult | null {
    const gameplay = this.options.gameplay;
    if (this.options.presentation.crowdPreviewController || gameplay.formationPreviewModel) {
      return null;
    }
    const cycleCount = Math.max(0, Math.min(500, Math.floor(cycles)));
    const before = this.createSevenAuditResetCycleResourceSnapshot();
    for (let cycle = 0; cycle < cycleCount; cycle += 1) {
      if (gameplay.gameplayModel.playState !== 'preSnap') {
        resetPlay(gameplay.gameplayModel);
      }
      startPlay(gameplay.gameplayModel);
      resetPlay(gameplay.gameplayModel);
      this.options.playerVisuals.reconcile(this.getActivePlayers());
      this.options.presentation.syncBall(gameplay.gameplayModel.ball);
      this.options.presentation.runRouteArtUpdate(
        snapshotGameplayModel(gameplay.gameplayModel),
        gameplay.gameplayModel.selectedPlay,
      );
      this.options.presentation.skipPresentation();
    }
    return { after: this.createSevenAuditResetCycleResourceSnapshot(), before, cycles: cycleCount };
  }

  private createElevenAuditResetCycleResourceSnapshot() {
    const metrics = this.createRenderMetricsSnapshot(0);
    const audio = this.options.presentation.getRuntimeAudioSnapshot();
    const hold = this.options.presentation.holdSnapshot;
    const crowd = this.options.presentation.getCrowdPresentationSnapshot();
    const officials = this.options.presentation.getOfficialsSnapshot();
    const stadium = this.options.presentation.getStadiumSnapshot();
    return {
      activeAudioNodes: audio.activeAudioNodeCount,
      activeCameraShot: this.options.presentation.cameraDebugSnapshot.activeShotName ?? null,
      activePlayerRootCount: this.getActivePlayers().length,
      activePresentationHold: hold.active,
      crowdInstanceCount: metrics.crowdInstanceCount,
      crowdReaction: crowd?.reactionState ?? null,
      debugOverlayCount: countActiveDebugOverlays(),
      footballMeshCount: metrics.footballMeshCount,
      geometryCount: metrics.geometries,
      helmetInstanceCount: getHelmetAssetSnapshot().attachedPlayerIds.length,
      materialCount: metrics.sceneMaterialCount,
      officialCount: officials.visibleOfficialCount,
      officialMeshCount: metrics.officialMeshCount,
      presentationHistoryCount:
        this.options.presentation.getGamePresentationRuntimeSnapshot().history.length,
      stadiumGeometryCount: stadium.geometryCount,
      stadiumMeshCount: metrics.stadiumMeshCount,
      textureCount: metrics.textures,
      visualRootCount: this.options.playerVisuals.size,
    };
  }

  private createSevenAuditResetCycleResourceSnapshot() {
    const metrics = this.createRenderMetricsSnapshot(0);
    const audio = this.options.presentation.getRuntimeAudioSnapshot();
    return {
      activeAudioNodes: audio.activeAudioNodeCount,
      activePlayerRootCount: this.getActivePlayers().length,
      crowdInstanceCount: metrics.crowdInstanceCount,
      debugOverlayCount: countActiveDebugOverlays(),
      footballMeshCount: metrics.footballMeshCount,
      geometryCount: metrics.geometries,
      materialCount: metrics.sceneMaterialCount,
      officialMeshCount: metrics.officialMeshCount,
      presentationHistoryCount:
        this.options.presentation.getGamePresentationRuntimeSnapshot().history.length,
      stadiumMeshCount: metrics.stadiumMeshCount,
      textureCount: metrics.textures,
      visualRootCount: this.options.playerVisuals.size,
    };
  }

  private getActivePlayers() {
    return this.options.gameplay.getActivePlayers(
      !!this.options.presentation.crowdPreviewController,
    );
  }
}

function countActiveDebugOverlays(): number {
  return document.querySelectorAll([
    '.appearance-audit-overlay',
    '.audio-debug-overlay',
    '.crowd-presentation-overlay',
    '.crowd-preview-overlay',
    '.controlled-player-label-debug-overlay',
    '.debug-overlay',
    '.eleven-audit-overlay',
    '.field-audit-overlay',
    '.formation-audit-overlay',
    '.memory-debug-panel',
    '.officials-debug-overlay',
    '.pass-audit-overlay',
    '.performance-debug-overlay',
    '.pose-debug-overlay',
    '.presentation-audit-overlay',
    '.presentation-hardening-audit-overlay',
    '.route-audit-overlay',
    '.seven-audit-overlay',
  ].join(',')).length;
}
