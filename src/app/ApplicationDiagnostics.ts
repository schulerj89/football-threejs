import * as THREE from 'three';
import { createAppearanceAuditSnapshot } from '../appearanceAuditOverlay';
import { getHelmetAssetSnapshot } from '../helmetVisual';
import { snapshotFormationPreviewModel } from '../formationPreview';
import type { FormationPreviewSnapshot } from '../formationPreview';
import type { ResolvedGameExperienceSettings } from '../config/GameExperienceSettings';
import type { MatchSnapshot } from '../match/MatchTypes';
import {
  resetPlay,
  selectPlay,
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
import { FIELD_GOAL_DEVELOPMENT_FORMATION } from '../presentation/stage/FootballFormationFamilies';
import { FOOTBALL_PLAYER_VISUAL_PROFILE_ID } from '../presentation/players/FootballPlayerVisualFactory';
import type { GameplayRuntime } from './GameplayRuntime';
import type { PlayerVisualRegistry } from './PlayerVisualRegistry';
import type { PresentationRuntime } from './PresentationRuntime';
import type { SceneRuntime } from './SceneRuntime';
import type { WeatherPresentationSnapshot } from '../weather/WeatherTypes';
import {
  getJerseyNumberAtlasSnapshot,
  type JerseyNumberAtlasSnapshot,
} from '../presentation/players/JerseyNumberAtlas';
import {
  JERSEY_NUMBER_MESH_NAME,
  getJerseyNumberMaterialSnapshot,
  readJerseyNumberVisualSnapshot,
  type JerseyNumberMaterialSnapshot,
  type JerseyNumberVisualSnapshot,
} from '../presentation/players/JerseyNumberVisual';
import type { LeagueInitializationSnapshot } from '../league/LeagueTypes';

export interface ApplicationDiagnosticsOptions {
  getGameExperience: () => ResolvedGameExperienceSettings;
  getMatchSnapshot: () => MatchSnapshot | null;
  getCrowdCapacityBenchmarkSnapshot: () => CrowdCapacityBenchmarkSnapshot;
  isCrowdPresentationDebugEnabled: () => boolean;
  getMemoryProfileSnapshot: () => SceneResourceProfileSnapshot;
  getWeatherSnapshot: () => WeatherPresentationSnapshot;
  getLeagueSnapshot: () => LeagueInitializationSnapshot;
  resetLeagueData: () => Promise<void>;
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

export type StageVisualPrimaryGroup =
  | 'coinTossParticipants'
  | 'gameplayPlayers'
  | 'kickoffParticipants'
  | 'warmupPlayers';

export interface StageVisualMatrixSnapshot {
  activePrimaryGroups: readonly StageVisualPrimaryGroup[];
  appPhase: string;
  coinToss: {
    bareHeadCount: number;
    coinVisible: boolean;
    helmetReadyCount: number;
    profileMatchCount: number;
    totalCount: number;
    visibleCount: number;
  };
  conflictingPrimaryGroups: readonly StageVisualPrimaryGroup[];
  fieldGoalFixture: {
    family: 'fieldGoal';
    normalGameActive: boolean;
    participantCount: number;
    profileMatchCount: number;
  };
  gameplay: {
    bareHeadCount: number;
    helmetCount: number;
    profileMatchCount: number;
    totalCount: number;
    visibleCount: number;
  };
  helmetAsset: ReturnType<typeof getHelmetAssetSnapshot>;
  kickoff: {
    bareHeadCount: number;
    helmetReadyCount: number;
    profileMatchCount: number;
    reticleVisible: boolean;
    totalCount: number;
    visibleCount: number;
  };
  matchPhase: string | null;
  normalOfficialsVisibleCount: number;
  previewCanvasCount: number;
  profileId: typeof FOOTBALL_PLAYER_VISUAL_PROFILE_ID;
  resourceCounts: {
    coinObjects: number;
    geometries: number;
    helmetAttachedPlayerIds: number;
    jerseyNumberAtlasCreated: boolean;
    jerseyNumberMeshes: number;
    jerseyNumberMaterials: number;
    materials: number;
    reticleObjects: number;
    textures: number;
    webglContexts: number;
  };
  scrimmage: {
    dynamicMarkersVisible: boolean;
  };
  warmup: {
    enabled: boolean;
    helmetReady: boolean;
    profileMatchCount: number;
    quarterbackReady: boolean;
    totalFullProfileCount: number;
    visibleFullProfileCount: number;
  };
}

export interface JerseyNumberDebugSnapshot {
  atlas: JerseyNumberAtlasSnapshot;
  hiddenCount: number;
  materialCache: JerseyNumberMaterialSnapshot;
  missingBindingCount: number;
  unreadableContrastCount: number;
  visibleCount: number;
  visualCount: number;
  visuals: JerseyNumberVisualSnapshot[];
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

  getStageVisualMatrixSnapshot(): StageVisualMatrixSnapshot {
    const appPhase = document.body.dataset.appPhase ?? 'unknown';
    const matchSnapshot = this.options.getMatchSnapshot();
    const metrics = this.latestRenderMetrics ?? this.createRenderMetricsSnapshot(0);
    const gameplayRoots = [...this.options.playerVisuals.values()];
    const visibleGameplayRoots = gameplayRoots.filter(isWorldVisible);
    const coinCaptainRoots = collectSceneObjects(this.options.sceneRuntime.scene, (object) =>
      object.userData.coinTossCaptain === true && object.userData.fullFootballPlayerVisual === true);
    const visibleCoinCaptainRoots = coinCaptainRoots.filter(isWorldVisible);
    const kickoffRoots = collectSceneObjects(this.options.sceneRuntime.scene, (object) =>
      object.userData.kickoffParticipant === true && object.userData.fullFootballPlayerVisual === true);
    const visibleKickoffRoots = kickoffRoots.filter(isWorldVisible);
    const warmupProfileRoots = collectSceneObjects(this.options.sceneRuntime.scene, (object) =>
      object.userData.pregameWarmup === true && object.userData.fullFootballPlayerVisual === true);
    const visibleWarmupProfileRoots = warmupProfileRoots.filter(isWorldVisible);
    const warmupGroupVisible = collectSceneObjects(this.options.sceneRuntime.scene, (object) =>
      object.userData.pregameWarmup === true && object.name === 'pregame-warmup-root')
      .some(isWorldVisible);
    const coinSnapshot = this.options.presentation.getCoinTossSnapshot(matchSnapshot);
    const kickoffSnapshot = this.options.presentation.getKickoffSnapshot();
    const pregameSnapshot = this.options.presentation.getPregamePresentationSnapshot();
    const officialsSnapshot = this.options.presentation.getOfficialsSnapshot();
    const helmetAsset = getHelmetAssetSnapshot();
    const jerseyNumberSnapshot = this.getJerseyNumberDebugSnapshot();
    const activePrimaryGroups = [
      visibleGameplayRoots.length > 0 ? 'gameplayPlayers' : null,
      warmupGroupVisible ? 'warmupPlayers' : null,
      visibleCoinCaptainRoots.length > 0 ? 'coinTossParticipants' : null,
      visibleKickoffRoots.length > 0 ? 'kickoffParticipants' : null,
    ].filter((group): group is StageVisualPrimaryGroup => Boolean(group));

    return {
      activePrimaryGroups,
      appPhase,
      coinToss: {
        bareHeadCount: countBareHeads(visibleCoinCaptainRoots),
        coinVisible: coinSnapshot.coinVisible,
        helmetReadyCount: coinSnapshot.helmetReadyCount,
        profileMatchCount: countProfileRoots(coinCaptainRoots),
        totalCount: coinSnapshot.captainVisualCount,
        visibleCount: visibleCoinCaptainRoots.length,
      },
      conflictingPrimaryGroups: activePrimaryGroups.length > 1 ? activePrimaryGroups : [],
      fieldGoalFixture: {
        family: 'fieldGoal',
        normalGameActive: false,
        participantCount: FIELD_GOAL_DEVELOPMENT_FORMATION.participantPlacements.length,
        profileMatchCount: FIELD_GOAL_DEVELOPMENT_FORMATION.participantPlacements
          .filter((participant) => participant.visualProfileId === FOOTBALL_PLAYER_VISUAL_PROFILE_ID).length,
      },
      gameplay: {
        bareHeadCount: countBareHeads(visibleGameplayRoots),
        helmetCount: visibleGameplayRoots.filter((root) => Boolean(root.getObjectByName('low-poly-helmet'))).length,
        profileMatchCount: countProfileRoots(gameplayRoots),
        totalCount: gameplayRoots.length,
        visibleCount: visibleGameplayRoots.length,
      },
      helmetAsset,
      kickoff: {
        bareHeadCount: kickoffSnapshot.visualProfile.bareHeadCount,
        helmetReadyCount: kickoffSnapshot.helmetReadyCount,
        profileMatchCount: kickoffSnapshot.visualProfile.profileMatchCount,
        reticleVisible: kickoffSnapshot.reticleVisible,
        totalCount: kickoffSnapshot.participantCount,
        visibleCount: visibleKickoffRoots.length,
      },
      matchPhase: matchSnapshot?.phase ?? null,
      normalOfficialsVisibleCount: officialsSnapshot.visibleOfficialCount,
      previewCanvasCount: document.querySelectorAll('.match-helmet-preview-canvas').length,
      profileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
      resourceCounts: {
        coinObjects: collectSceneObjects(this.options.sceneRuntime.scene, (object) =>
          object.userData.coinTossCoin === true || object.name.includes('coin')).length,
        geometries: metrics.geometries,
        helmetAttachedPlayerIds: helmetAsset.attachedPlayerIds.length,
        jerseyNumberAtlasCreated: jerseyNumberSnapshot.atlas.atlasCreated,
        jerseyNumberMeshes: collectJerseyNumberMeshes(this.options.sceneRuntime.scene).length,
        jerseyNumberMaterials: jerseyNumberSnapshot.materialCache.materialCount,
        materials: metrics.sceneMaterialCount,
        reticleObjects: collectSceneObjects(this.options.sceneRuntime.scene, (object) =>
          object.userData.kickLandingReticle === true || object.name.includes('kick-landing-reticle')).length,
        textures: metrics.textures,
        webglContexts: document.querySelectorAll('canvas').length,
      },
      scrimmage: {
        dynamicMarkersVisible: appPhase === 'gameplay' && visibleGameplayRoots.length > 0,
      },
      warmup: {
        enabled: pregameSnapshot.warmup.enabled,
        helmetReady: pregameSnapshot.quarterbackAppearance?.helmetReady ?? false,
        profileMatchCount: countProfileRoots(warmupProfileRoots),
        quarterbackReady: pregameSnapshot.quarterbackAppearance?.subjectReady ?? false,
        totalFullProfileCount: warmupProfileRoots.length,
        visibleFullProfileCount: visibleWarmupProfileRoots.length,
      },
    };
  }

  getJerseyNumberDebugSnapshot(): JerseyNumberDebugSnapshot {
    const visuals = collectJerseyNumberSnapshots(this.options.sceneRuntime.scene);

    return {
      atlas: getJerseyNumberAtlasSnapshot(),
      hiddenCount: visuals.filter((visual) => !visual.visible).length,
      materialCache: getJerseyNumberMaterialSnapshot(),
      missingBindingCount: visuals.filter((visual) => visual.missingBindingReason).length,
      unreadableContrastCount: visuals.filter((visual) => visual.contrastReadable === false).length,
      visibleCount: visuals.filter((visual) => visual.visible).length,
      visualCount: visuals.length,
      visuals,
    };
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
    const leagueSnapshot = this.options.getLeagueSnapshot();
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
          leagueSnapshot.error ? `League: ${leagueSnapshot.error}` : '',
        ]
      : [];
    return {
      audio: audioStatus,
      crowd: crowdStatus,
      developmentDetails,
      helmet: helmetSnapshot.status,
      league: `${leagueSnapshot.status === 'ready' ? 'Ready' : leagueSnapshot.stage} (${leagueSnapshot.teamCount || 6} teams)`,
      leagueLoadingVisible: leagueSnapshot.loadingVisible,
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
      getCoinTossSnapshot: () =>
        this.options.presentation.getCoinTossSnapshot(this.options.getMatchSnapshot()),
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
      getMatchSnapshot: () => this.options.getMatchSnapshot(),
      getGameplaySnapshot: () =>
        this.options.gameplay.getActivePresentationSnapshot(
          !!this.options.presentation.crowdPreviewController,
        ),
      getGamePresentationRuntimeSnapshot: () =>
        this.options.presentation.getGamePresentationRuntimeSnapshot(),
      getHelmetAssetSnapshot,
      getKickoffSnapshot: () => this.options.presentation.getKickoffSnapshot(),
      getKeysToGameOverlaySnapshot: () => this.options.presentation.getKeysToGameOverlaySnapshot(),
      getLeagueSnapshot: () => this.options.getLeagueSnapshot(),
      getJerseyNumberDebugSnapshot: () => this.getJerseyNumberDebugSnapshot(),
      getPlaceKickSnapshot: () => this.options.presentation.getPlaceKickSnapshot(),
      getPreSnapCadenceSnapshot: () => this.options.gameplay.getPreSnapCadenceSnapshot(),
      getStageVisualMatrixSnapshot: () => this.getStageVisualMatrixSnapshot(),
      getOfficialsSnapshot: () => this.options.presentation.getOfficialsSnapshot(),
      getSidelineTeamSnapshot: () => this.options.presentation.getSidelineTeamSnapshot(),
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
      getWeatherSnapshot: () => this.options.getWeatherSnapshot(),
      getPlayerBodyVisualSnapshots: () => this.options.playerVisuals.getBodySnapshots(),
      getPlayerPoseSnapshots: () => this.options.presentation.getPlayerPoseSnapshots(),
      getPregamePresentationSnapshot: () =>
        this.options.presentation.getPregamePresentationSnapshot(),
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
      resetLeagueData: () => this.options.resetLeagueData(),
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
    const availablePlayIds = gameplay.gameplayModel.availablePlays.map((play) => play.id);
    const exercisedPlayIds = new Set<string>();
    this.prepareResetCyclePlaybookAudit(availablePlayIds);
    const before = this.createElevenAuditResetCycleResourceSnapshot();
    for (let cycle = 0; cycle < cycleCount; cycle += 1) {
      if (gameplay.gameplayModel.playState !== 'preSnap') {
        resetPlay(gameplay.gameplayModel);
      }
      const playId = availablePlayIds[cycle % availablePlayIds.length];
      if (playId) {
        selectPlay(gameplay.gameplayModel, playId);
        exercisedPlayIds.add(playId);
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
    return {
      after: this.createElevenAuditResetCycleResourceSnapshot(),
      availablePlayIds,
      before,
      cycles: cycleCount,
      exercisedPlayIds: [...exercisedPlayIds],
    };
  }

  private runSevenAuditResetCycles(cycles: number): SevenAuditResetCycleResult | null {
    const gameplay = this.options.gameplay;
    if (this.options.presentation.crowdPreviewController || gameplay.formationPreviewModel) {
      return null;
    }
    const cycleCount = Math.max(0, Math.min(500, Math.floor(cycles)));
    const availablePlayIds = gameplay.gameplayModel.availablePlays.map((play) => play.id);
    const exercisedPlayIds = new Set<string>();
    this.prepareResetCyclePlaybookAudit(availablePlayIds);
    const before = this.createSevenAuditResetCycleResourceSnapshot();
    for (let cycle = 0; cycle < cycleCount; cycle += 1) {
      if (gameplay.gameplayModel.playState !== 'preSnap') {
        resetPlay(gameplay.gameplayModel);
      }
      const playId = availablePlayIds[cycle % availablePlayIds.length];
      if (playId) {
        selectPlay(gameplay.gameplayModel, playId);
        exercisedPlayIds.add(playId);
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
    return {
      after: this.createSevenAuditResetCycleResourceSnapshot(),
      availablePlayIds,
      before,
      cycles: cycleCount,
      exercisedPlayIds: [...exercisedPlayIds],
    };
  }

  private createElevenAuditResetCycleResourceSnapshot() {
    const metrics = this.createRenderMetricsSnapshot(0);
    const audio = this.options.presentation.getRuntimeAudioSnapshot();
    const hold = this.options.presentation.holdSnapshot;
    const crowd = this.options.presentation.getCrowdPresentationSnapshot();
    const officials = this.options.presentation.getOfficialsSnapshot();
    const sidelineTeams = this.options.presentation.getSidelineTeamSnapshot();
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
      jerseyNumberAtlasCreated: getJerseyNumberAtlasSnapshot().atlasCreated,
      jerseyNumberMaterialCount: getJerseyNumberMaterialSnapshot().materialCount,
      jerseyNumberMeshCount: collectJerseyNumberMeshes(this.options.sceneRuntime.scene).length,
      materialCount: metrics.sceneMaterialCount,
      officialCount: officials.visibleOfficialCount,
      officialMeshCount: metrics.officialMeshCount,
      presentationHistoryCount:
        this.options.presentation.getGamePresentationRuntimeSnapshot().history.length,
      sidelineMeshCount: sidelineTeams.meshCount,
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
      jerseyNumberAtlasCreated: getJerseyNumberAtlasSnapshot().atlasCreated,
      jerseyNumberMaterialCount: getJerseyNumberMaterialSnapshot().materialCount,
      jerseyNumberMeshCount: collectJerseyNumberMeshes(this.options.sceneRuntime.scene).length,
      materialCount: metrics.sceneMaterialCount,
      officialMeshCount: metrics.officialMeshCount,
      presentationHistoryCount:
        this.options.presentation.getGamePresentationRuntimeSnapshot().history.length,
      sidelineMeshCount: metrics.sidelineMeshCount,
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

  private prepareResetCyclePlaybookAudit(playIds: readonly string[]): void {
    const gameplay = this.options.gameplay.gameplayModel;
    if (gameplay.playState !== 'preSnap') {
      resetPlay(gameplay);
    }
    const originalPlayId = gameplay.selectedPlay.id;
    for (const playId of playIds) {
      if (!selectPlay(gameplay, playId)) {
        continue;
      }
      this.syncResetCyclePresentationState();
    }
    selectPlay(gameplay, originalPlayId);
    this.syncResetCyclePresentationState();
  }

  private syncResetCyclePresentationState(): void {
    const gameplay = this.options.gameplay.gameplayModel;
    this.options.playerVisuals.reconcile(this.getActivePlayers());
    this.options.presentation.syncBall(gameplay.ball);
    this.options.presentation.runRouteArtUpdate(
      snapshotGameplayModel(gameplay),
      gameplay.selectedPlay,
    );
    this.options.presentation.skipPresentationHold();
    this.options.presentation.skipPresentation();
  }
}

function countActiveDebugOverlays(): number {
  return document.querySelectorAll([
    '.appearance-audit-overlay',
    '.audio-debug-overlay',
    '.cadence-debug-overlay',
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
    '.place-kick-debug-overlay',
    '.pose-debug-overlay',
    '.presentation-audit-overlay',
    '.presentation-hardening-audit-overlay',
    '.pregame-debug-overlay',
    '.intro-keys-debug-overlay',
    '.jersey-number-debug-overlay',
    '.kickoff-return-debug-overlay',
    '.league-debug-overlay',
    '.route-audit-overlay',
    '.seven-audit-overlay',
    '.sideline-debug-overlay',
  ].join(',')).length;
}

function collectJerseyNumberMeshes(root: THREE.Object3D): THREE.Object3D[] {
  return collectSceneObjects(root, (object) =>
    object.name === JERSEY_NUMBER_MESH_NAME ||
    object.userData.jerseyNumberVisual === true);
}

function collectJerseyNumberSnapshots(root: THREE.Object3D): JerseyNumberVisualSnapshot[] {
  const snapshots: JerseyNumberVisualSnapshot[] = [];
  root.traverse((object) => {
    const snapshot = readJerseyNumberVisualSnapshot(object);
    if (snapshot) {
      snapshots.push(snapshot);
    }
  });
  return snapshots.sort((a, b) => a.visualId.localeCompare(b.visualId));
}

function collectSceneObjects(
  root: THREE.Object3D,
  predicate: (object: THREE.Object3D) => boolean,
): THREE.Object3D[] {
  const objects: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (predicate(object)) {
      objects.push(object);
    }
  });
  return objects;
}

function isWorldVisible(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) {
      return false;
    }
    current = current.parent;
  }
  return true;
}

function countProfileRoots(roots: readonly THREE.Object3D[]): number {
  return roots.filter((root) =>
    root.userData.visualProfileId === FOOTBALL_PLAYER_VISUAL_PROFILE_ID).length;
}

function countBareHeads(roots: readonly THREE.Object3D[]): number {
  return roots.filter((root) =>
    root.userData.fullFootballPlayerVisual === true &&
    !root.getObjectByName('low-poly-helmet')).length;
}
