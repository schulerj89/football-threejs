import * as THREE from 'three';
import type {
  JerseyNumberDebugSnapshot,
  StageVisualMatrixSnapshot,
} from './ApplicationDiagnostics';
import type { RuntimeAudioDebugSnapshot } from '../audio/AudioDebugOverlay';
import {
  createAudioDebugOverlay,
  syncAudioDebugOverlay,
} from '../audio/AudioDebugOverlay';
import {
  createAppearanceAuditOverlay,
  createAppearanceAuditSnapshot,
  syncAppearanceAuditOverlay,
  type AppearanceAuditSnapshot,
} from '../appearanceAuditOverlay';
import type { GameplayCameraDebugSnapshot } from '../camera/GameplayCameraController';
import type { GameExperienceDebugSnapshot } from '../config/GameExperienceSettings';
import type { MatchSnapshot } from '../match/MatchTypes';
import { formatPossessionFieldPosition } from '../match/FieldPositionModel';
import type { CoinTossDebugSnapshot } from '../presentation/coinToss/CoinTossTypes';
import type { KickoffFrameSnapshot } from '../specialTeams/KickoffTypes';
import type { PlaceKickFrameSnapshot } from '../specialTeams/PlaceKickTypes';
import type { PreSnapCadenceSnapshot } from '../gameplay/PreSnapCadenceModel';
import {
  createCrowdPreviewOverlay,
  syncCrowdPreviewOverlay,
  type CrowdPreviewCameraView,
  type CrowdPreviewSnapshot,
} from '../crowdPreview';
import {
  createCrowdPresentationOverlay,
  syncCrowdPresentationOverlay,
  type CrowdPresentationSnapshot,
} from '../presentation/CrowdPresentationController';
import {
  createControlledPlayerLabelOverlay,
  syncControlledPlayerLabelOverlay,
  type ControlledPlayerLabelSnapshot,
} from '../presentation/ControlledPlayerLabel';
import {
  createOfficialsDebugOverlay,
  syncOfficialsDebugOverlay,
} from '../officials/OfficialsPresentationController';
import type { OfficialsPresentationSnapshot } from '../officials/OfficialTypes';
import {
  createSidelineDebugOverlay,
  syncSidelineDebugOverlay,
  type SidelineTeamControllerSnapshot,
} from '../presentation/teams/SidelineTeamController';
import {
  createPregameDebugOverlay,
  syncPregameDebugOverlay,
} from '../presentation/pregame/PregameLowerThird';
import type { PregamePresentationSnapshot } from '../presentation/pregame/PregamePresentationTypes';
import type { KeysToGameOverlaySnapshot } from '../presentation/pregame/KeysToGameOverlay';
import type { HalftimePresentationSnapshot } from '../presentation/halftime/HalftimePresentationTypes';
import { DebugOverlay, type RenderMetricsSnapshot } from '../debugOverlay';
import { createFieldAuditOverlay } from '../field/FieldAuditOverlay';
import {
  createElevenAuditOverlay,
  syncElevenAuditOverlay,
  type ElevenAuditSnapshot,
} from '../elevenOnElevenAudit';
import { syncFormationAuditOverlay } from '../formationAuditOverlay';
import type {
  FormationPreviewModel,
  FormationPreviewSnapshot,
} from '../formationPreview';
import {
  createFormationAuditOverlay,
} from '../formationAuditOverlay';
import {
  createPassAuditOverlay,
  syncPassAuditOverlay,
} from '../passAuditOverlay';
import type { GameplayModel, GameplaySnapshot, PassAuditSnapshot } from '../playState';
import type { PlayerModel, PlayerSnapshot } from '../playerModel';
import {
  getPlayerBodyVisualSnapshot,
  type PlayerBodyVisualSnapshot,
} from '../playerVisual';
import {
  createPlayerPoseDebugOverlay,
  syncPlayerPoseDebugOverlay,
  type PlayerPoseSnapshot,
} from '../presentation/PlayerPoseController';
import {
  createRouteAuditOverlay,
  syncRouteAuditOverlay,
  type RouteArtRendererSnapshot,
} from '../presentation/RouteArtRenderer';
import {
  createPresentationAuditOverlay,
  syncPresentationAuditOverlay,
  type CameraFramingSnapshot,
  type PresentationAuditSnapshot,
} from '../presentationAudit';
import {
  createPresentationHardeningAuditOverlay,
  syncPresentationHardeningAuditOverlay,
  type PresentationHardeningAuditSnapshot,
} from '../presentation/PresentationHardeningAudit';
import type { PresentationHoldSnapshot } from '../presentation/PresentationHoldDirector';
import type { GamePresentationRuntimeSnapshot } from '../presentation/GamePresentationRuntime';
import type {
  PerformanceReport,
  PerformanceReportEnvironment,
} from '../performance/PerformanceReport';
import {
  createPerformanceDebugOverlay,
  syncPerformanceDebugOverlay,
  type QualityDebugSnapshot,
} from '../ui/PerformanceSettingsPanel';
import {
  MemoryDebugPanel,
  type MemoryDebugSnapshot,
} from '../ui/MemoryDebugPanel';
import { DebugPanel } from '../ui/DebugPanel';
import {
  DebugFeatureRegistry,
  type DisposableDebugFeature,
} from '../ui/DebugFeatureRegistry';
import type {
  PerformanceScenarioName,
} from '../performance/PerformanceBudget';
import type {
  PerformanceScenarioSnapshot,
} from '../performance/PerformanceScenarioRunner';
import type {
  CrowdCapacityBenchmarkSnapshot,
  CrowdCapacityReport,
  SceneResourceProfileSnapshot,
} from '../performance/MemoryTypes';
import type { StadiumControllerSnapshot } from '../stadium/StadiumController';
import { getHelmetAssetSnapshot, type HelmetAssetSnapshot } from '../helmetVisual';
import {
  createWeatherDebugOverlay,
  syncWeatherDebugOverlay,
} from '../weather/WeatherPresentationController';
import type { WeatherPresentationSnapshot } from '../weather/WeatherTypes';
import type { PlayerVisualMode } from '../presentation/players/PlayerVisualMode';
import type { LeagueInitializationSnapshot } from '../league/LeagueTypes';
import { formatGameStatsDebugSnapshot } from '../stats/GameStatsSnapshot';

declare global {
  interface Window {
    __footballDebug?: FootballDebugApi;
  }
}

export interface BaseAuditResetCycleResourceSnapshot {
  activeAudioNodes: number;
  activePlayerRootCount: number;
  crowdInstanceCount: number;
  debugOverlayCount: number;
  footballMeshCount: number;
  geometryCount: number;
  jerseyNumberAtlasCreated: boolean;
  jerseyNumberMaterialCount: number;
  jerseyNumberMeshCount: number;
  materialCount: number;
  officialMeshCount: number;
  presentationHistoryCount: number;
  sidelineMeshCount: number;
  stadiumMeshCount: number;
  textureCount: number;
  visualRootCount: number;
}

export interface ElevenAuditResetCycleResourceSnapshot extends BaseAuditResetCycleResourceSnapshot {
  activeCameraShot: string | null;
  activePresentationHold: boolean;
  crowdReaction: string | null;
  helmetInstanceCount: number;
  officialCount: number;
  stadiumGeometryCount: number;
}

export interface ElevenAuditResetCycleResult {
  after: ElevenAuditResetCycleResourceSnapshot;
  availablePlayIds: string[];
  before: ElevenAuditResetCycleResourceSnapshot;
  cycles: number;
  exercisedPlayIds: string[];
}

export interface FootballDebugApi {
  clearPerformanceSamples: () => void;
  forceQuarterbackPastLineForTest: () => boolean;
  getAudioSnapshot: () => RuntimeAudioDebugSnapshot;
  getAppearanceAuditSnapshot: () => AppearanceAuditSnapshot;
  getBallVisualSnapshot: () => unknown;
  getCameraSnapshot: () => GameplayCameraDebugSnapshot;
  getControlledPlayerLabelSnapshot: () => ControlledPlayerLabelSnapshot;
  getCameraFramingSnapshot: () => CameraFramingSnapshot;
  getCoinTossSnapshot: () => CoinTossDebugSnapshot;
  getCrowdPresentationSnapshot: () => CrowdPresentationSnapshot | null;
  getCrowdPreviewSnapshot: () => CrowdPreviewSnapshot | null;
  getFormationPreviewSnapshot: () => FormationPreviewSnapshot | null;
  getGameExperienceSnapshot: () => GameExperienceDebugSnapshot;
  getMatchSnapshot: () => MatchSnapshot | null;
  getGameplaySnapshot: () => GameplaySnapshot;
  getGamePresentationRuntimeSnapshot: () => GamePresentationRuntimeSnapshot;
  getHelmetAssetSnapshot: () => HelmetAssetSnapshot;
  getKickoffSnapshot: () => KickoffFrameSnapshot;
  getKeysToGameOverlaySnapshot: () => KeysToGameOverlaySnapshot;
  getLeagueSnapshot: () => LeagueInitializationSnapshot;
  getJerseyNumberDebugSnapshot: () => JerseyNumberDebugSnapshot;
  getPlaceKickSnapshot: () => PlaceKickFrameSnapshot;
  getPreSnapCadenceSnapshot: () => PreSnapCadenceSnapshot;
  getStageVisualMatrixSnapshot: () => StageVisualMatrixSnapshot;
  getOfficialsSnapshot: () => OfficialsPresentationSnapshot;
  getSidelineTeamSnapshot: () => SidelineTeamControllerSnapshot;
  getCrowdCapacityBenchmarkSnapshot: () => CrowdCapacityBenchmarkSnapshot;
  getMemoryProfileSnapshot: () => SceneResourceProfileSnapshot;
  getPassAuditSnapshot: () => PassAuditSnapshot | null;
  getQualityDebugSnapshot: () => QualityDebugSnapshot;
  getElevenAuditSnapshot: () => ElevenAuditSnapshot | null;
  getPerformanceProfileReport: (
    environment?: Partial<PerformanceReportEnvironment>,
  ) => PerformanceReport;
  getPerformanceScenarioSnapshot: () => PerformanceScenarioSnapshot | null;
  getPresentationHardeningAuditSnapshot: () => PresentationHardeningAuditSnapshot | null;
  getPresentationHoldSnapshot: () => PresentationHoldSnapshot;
  getPresentationAuditSnapshot: () => PresentationAuditSnapshot | null;
  getStadiumSnapshot: () => StadiumControllerSnapshot;
  getWeatherSnapshot: () => WeatherPresentationSnapshot;
  getPlayerBodyVisualSnapshots: () => PlayerBodyVisualSnapshot[];
  getPlayerPoseSnapshots: () => PlayerPoseSnapshot[];
  getPregamePresentationSnapshot: () => PregamePresentationSnapshot;
  getPlayerSnapshot: () => PlayerSnapshot;
  getRenderMetrics: () => RenderMetricsSnapshot;
  getRouteArtSnapshot: () => RouteArtRendererSnapshot;
  playAudioTestOneShot: () => Promise<boolean>;
  applyCrowdCapacityRecommendation: () => string | null;
  cancelCrowdCapacityBenchmark: () => CrowdCapacityBenchmarkSnapshot;
  exportCrowdCapacityReport: () => CrowdCapacityReport | null;
  runCrowdCapacityBenchmark: () => CrowdCapacityBenchmarkSnapshot;
  resetLeagueData: () => Promise<void>;
  runElevenAuditResetCycles: (cycles?: number) => ElevenAuditResetCycleResult | null;
  setPerformanceScenario: (scenario: PerformanceScenarioName) => PerformanceScenarioSnapshot | null;
  setCrowdPreviewCameraView: (view: CrowdPreviewCameraView) => void;
  setAnnouncerEnabled: (enabled: boolean) => void;
  setAnnouncerVolume: (volume: number) => void;
  setAudioPageActiveForTest: (active: boolean) => void;
  setAudioMuted: (muted: boolean) => void;
  setCaptionsEnabled: (enabled: boolean) => void;
  startAudioTestLoop: () => Promise<boolean>;
  stopAudioTestLoop: () => boolean;
}

export interface DevelopmentToolsRuntimeOptions {
  appearanceAuditEnabled: boolean;
  audioDebugEnabled: boolean;
  cameraDebugEnabled: boolean;
  commentaryDebugEnabled: boolean;
  crowdPresentationDebugEnabled: boolean;
  crowdPreviewEnabled: boolean;
  debugToolsEnabled: boolean;
  elevenAuditEnabled: boolean;
  formationPreviewActive: boolean;
  passAuditEnabled: boolean;
  performanceDebugEnabled: boolean;
  presentationAuditEnabled: boolean;
  pregameDebugEnabled: boolean;
  officialsDebugEnabled: boolean;
  routeAuditEnabled: boolean;
  searchParams: URLSearchParams;
  sidelineTeamsDebugEnabled: boolean;
  renderer: THREE.WebGLRenderer;
  activePlayer: () => PlayerModel;
  debugApi: FootballDebugApi;
  onCrowdPreviewControls: (event: KeyboardEvent) => void;
  onDevelopmentCameraToggle: (event: KeyboardEvent) => void;
  onFormationPreviewLaneControls: (event: KeyboardEvent) => void;
  onPauseSettingsShortcut: (event: KeyboardEvent) => void;
  onPlayerVisualModeChange: (mode: PlayerVisualMode) => void;
  onPresentationAuditControls: (event: KeyboardEvent) => void;
}

export interface DevelopmentOverlayFrame {
  activePrimaryPlayer: Parameters<DebugOverlay['update']>[2];
  cameraSnapshot: GameplayCameraDebugSnapshot;
  controlledPlayerLabelSnapshot: ControlledPlayerLabelSnapshot;
  coinTossSnapshot: CoinTossDebugSnapshot;
  placeKickSnapshot: PlaceKickFrameSnapshot;
  kickoffSnapshot: KickoffFrameSnapshot;
  matchSnapshot: MatchSnapshot | null;
  keysToGameSnapshot: KeysToGameOverlaySnapshot;
  jerseyNumberSnapshot: JerseyNumberDebugSnapshot;
  crowdPresentationSnapshot: CrowdPresentationSnapshot | null;
  crowdPreviewSnapshot: CrowdPreviewSnapshot | null;
  deltaSeconds: number;
  elevenAuditSnapshot: ElevenAuditSnapshot | null;
  formationPreviewModel: FormationPreviewModel | null;
  formationPreviewSnapshot: FormationPreviewSnapshot | null;
  gameplayModel: GameplayModel;
  gameplaySnapshot: GameplaySnapshot;
  playerBodyVisual: THREE.Group | undefined;
  playerPoseSnapshots: PlayerPoseSnapshot[];
  preSnapCadenceSnapshot: PreSnapCadenceSnapshot;
  pregamePresentationSnapshot: PregamePresentationSnapshot | null;
  halftimePresentationSnapshot: HalftimePresentationSnapshot;
  presentationAuditSnapshot: PresentationAuditSnapshot | null;
  emptyPresentationAuditSnapshot: PresentationAuditSnapshot;
  presentationHardeningAuditSnapshot: PresentationHardeningAuditSnapshot | null;
  renderMetrics: RenderMetricsSnapshot | null;
  routeArtSnapshot: RouteArtRendererSnapshot;
  runtimeAudioSnapshot: RuntimeAudioDebugSnapshot;
  qualityDebugSnapshot: QualityDebugSnapshot;
  memoryDebugSnapshot: MemoryDebugSnapshot | null;
  officialsSnapshot: OfficialsPresentationSnapshot;
  sidelineTeamsSnapshot: SidelineTeamControllerSnapshot;
  playerVisuals: Map<string, THREE.Group>;
  weatherSnapshot: WeatherPresentationSnapshot;
}

export class DevelopmentToolsRuntime {
  private appearanceAuditOverlay: HTMLDivElement | null = null;
  private audioDebugOverlay: HTMLDivElement | null = null;
  private cadenceDebugOverlay: HTMLDivElement | null = null;
  private crowdPresentationOverlay: HTMLDivElement | null = null;
  private crowdPreviewOverlay: HTMLDivElement | null = null;
  private controlledPlayerLabelOverlay: HTMLDivElement | null = null;
  private debugOverlay: DebugOverlay | null = null;
  private elevenAuditOverlay: HTMLDivElement | null = null;
  private formationAuditOverlay: HTMLDivElement | null = null;
  private passAuditOverlay: HTMLDivElement | null = null;
  private placeKickDebugOverlay: HTMLDivElement | null = null;
  private memoryDebugPanel: MemoryDebugPanel | null = null;
  private officialsDebugOverlay: HTMLDivElement | null = null;
  private sidelineTeamsDebugOverlay: HTMLDivElement | null = null;
  private statsDebugOverlay: HTMLDivElement | null = null;
  private performanceDebugOverlay: HTMLDivElement | null = null;
  private poseDebugOverlay: HTMLDivElement | null = null;
  private presentationAuditOverlay: HTMLDivElement | null = null;
  private introKeysDebugOverlay: HTMLDivElement | null = null;
  private jerseyNumberDebugOverlay: HTMLDivElement | null = null;
  private leagueDebugOverlay: HTMLDivElement | null = null;
  private kickoffReturnDebugOverlay: HTMLDivElement | null = null;
  private matchTransitionDebugOverlay: HTMLDivElement | null = null;
  private halftimeDebugOverlay: HTMLDivElement | null = null;
  private pregameDebugOverlay: HTMLDivElement | null = null;
  private presentationHardeningAuditOverlay: HTMLDivElement | null = null;
  private routeAuditOverlay: HTMLDivElement | null = null;
  private weatherDebugOverlay: HTMLDivElement | null = null;
  private readonly debugFeatureRegistry = new DebugFeatureRegistry();
  private readonly debugPanel: DebugPanel;
  private readonly listeners: Array<[EventTarget, string, EventListener]> = [];

  constructor(private readonly options: DevelopmentToolsRuntimeOptions) {
    this.registerDebugFeatures(options);
    this.debugPanel = new DebugPanel({ registry: this.debugFeatureRegistry });
    this.debugPanel.setVisible(options.debugToolsEnabled);

    if (this.shouldInstallDebugApi(options)) {
      window.__footballDebug = options.debugApi;
      this.addListener(window, 'keydown', options.onDevelopmentCameraToggle);
    }
    this.addListener(window, 'keydown', (event) => this.handleDebugPanelShortcut(event));
    if (options.formationPreviewActive) {
      this.addListener(window, 'keydown', options.onFormationPreviewLaneControls);
    }
    if (options.presentationAuditEnabled) {
      this.addListener(window, 'keydown', options.onPresentationAuditControls);
    }
    if (options.crowdPreviewEnabled) {
      this.addListener(window, 'keydown', options.onCrowdPreviewControls);
    }
    if (!options.crowdPreviewEnabled && !options.formationPreviewActive) {
      this.addListener(window, 'keydown', options.onPauseSettingsShortcut);
    }
  }

  get crowdPreviewOverlayElement(): HTMLDivElement | null {
    return this.crowdPreviewOverlay;
  }

  isDebugOverlayVisible(): boolean {
    return this.debugOverlay?.isVisible() ?? false;
  }

  shouldCollectPresentationDiagnostics(): boolean {
    return this.isDebugOverlayVisible() ||
      !!this.poseDebugOverlay ||
      !!this.presentationAuditOverlay ||
      !!this.routeAuditOverlay ||
      !!this.passAuditOverlay ||
      !!this.memoryDebugPanel ||
      !!this.officialsDebugOverlay ||
      !!this.sidelineTeamsDebugOverlay ||
      !!this.statsDebugOverlay ||
      !!this.controlledPlayerLabelOverlay ||
      !!this.performanceDebugOverlay ||
      !!this.pregameDebugOverlay ||
      !!this.halftimeDebugOverlay ||
      !!this.elevenAuditOverlay ||
      !!this.appearanceAuditOverlay ||
      !!this.cadenceDebugOverlay ||
      !!this.crowdPresentationOverlay ||
      !!this.placeKickDebugOverlay ||
      !!this.introKeysDebugOverlay ||
      !!this.jerseyNumberDebugOverlay ||
      !!this.leagueDebugOverlay ||
      !!this.kickoffReturnDebugOverlay ||
      !!this.weatherDebugOverlay ||
      !!this.presentationHardeningAuditOverlay;
  }

  shouldCollectMemoryDiagnostics(): boolean {
    return !!this.memoryDebugPanel;
  }

  syncCrowdPreviewOverlay(snapshot: CrowdPreviewSnapshot): void {
    if (this.crowdPreviewOverlay) {
      syncCrowdPreviewOverlay(this.crowdPreviewOverlay, snapshot);
    }
  }

  syncGameplayOverlays(frame: DevelopmentOverlayFrame): void {
    if (this.poseDebugOverlay) {
      syncPlayerPoseDebugOverlay(this.poseDebugOverlay, frame.playerPoseSnapshots);
    }
    if (this.formationAuditOverlay) {
      syncFormationAuditOverlay(
        this.formationAuditOverlay,
        frame.gameplayModel,
        frame.formationPreviewModel?.formation,
        frame.formationPreviewSnapshot
          ? {
              labels: frame.formationPreviewSnapshot.labels,
              previewName: `${frame.formationPreviewSnapshot.mode} Formation Preview`,
            }
          : undefined,
      );
    }
    if (this.presentationAuditOverlay) {
      syncPresentationAuditOverlay(
        this.presentationAuditOverlay,
        frame.presentationAuditSnapshot ?? frame.emptyPresentationAuditSnapshot,
      );
    }
    if (this.routeAuditOverlay) {
      syncRouteAuditOverlay(this.routeAuditOverlay, frame.routeArtSnapshot);
    }
    if (this.passAuditOverlay) {
      syncPassAuditOverlay(this.passAuditOverlay, frame.gameplaySnapshot.passAudit);
    }
    if (this.pregameDebugOverlay) {
      syncPregameDebugOverlay(
        this.pregameDebugOverlay,
        frame.pregamePresentationSnapshot,
        frame.renderMetrics,
        frame.cameraSnapshot,
        frame.coinTossSnapshot,
        frame.kickoffSnapshot,
      );
    }
    if (this.placeKickDebugOverlay) {
      syncPlaceKickDebugOverlay(this.placeKickDebugOverlay, frame.placeKickSnapshot);
    }
    if (this.kickoffReturnDebugOverlay) {
      syncKickoffReturnDebugOverlay(this.kickoffReturnDebugOverlay, frame.kickoffSnapshot);
    }
    if (this.matchTransitionDebugOverlay) {
      syncMatchTransitionDebugOverlay(
        this.matchTransitionDebugOverlay,
        frame.matchSnapshot,
        frame.gameplaySnapshot,
      );
    }
    if (this.halftimeDebugOverlay) {
      syncHalftimeDebugOverlay(this.halftimeDebugOverlay, frame.halftimePresentationSnapshot);
    }
    if (this.cadenceDebugOverlay) {
      syncCadenceDebugOverlay(this.cadenceDebugOverlay, frame.preSnapCadenceSnapshot);
    }
    if (this.jerseyNumberDebugOverlay) {
      syncJerseyNumberDebugOverlay(this.jerseyNumberDebugOverlay, frame.jerseyNumberSnapshot);
    }
    if (this.leagueDebugOverlay) {
      syncLeagueDebugOverlay(this.leagueDebugOverlay, this.options.debugApi.getLeagueSnapshot());
    }
    if (this.introKeysDebugOverlay) {
      syncIntroKeysDebugOverlay(
        this.introKeysDebugOverlay,
        frame.keysToGameSnapshot,
        frame.pregamePresentationSnapshot,
      );
    }
    if (this.memoryDebugPanel && frame.memoryDebugSnapshot) {
      this.memoryDebugPanel.sync(frame.memoryDebugSnapshot);
    }
    if (this.officialsDebugOverlay) {
      syncOfficialsDebugOverlay(this.officialsDebugOverlay, frame.officialsSnapshot);
    }
    if (this.sidelineTeamsDebugOverlay) {
      syncSidelineDebugOverlay(this.sidelineTeamsDebugOverlay, frame.sidelineTeamsSnapshot);
    }
    if (this.statsDebugOverlay) {
      this.statsDebugOverlay.textContent = formatGameStatsDebugSnapshot(frame.matchSnapshot?.stats ?? null);
    }
    if (this.controlledPlayerLabelOverlay) {
      syncControlledPlayerLabelOverlay(
        this.controlledPlayerLabelOverlay,
        frame.controlledPlayerLabelSnapshot,
      );
    }
    if (this.performanceDebugOverlay) {
      syncPerformanceDebugOverlay(this.performanceDebugOverlay, frame.qualityDebugSnapshot);
    }
    if (this.elevenAuditOverlay && frame.elevenAuditSnapshot) {
      syncElevenAuditOverlay(this.elevenAuditOverlay, frame.elevenAuditSnapshot);
    }
    if (this.appearanceAuditOverlay) {
      syncAppearanceAuditOverlay(
        this.appearanceAuditOverlay,
        createAppearanceAuditSnapshot(frame.playerVisuals),
      );
    }
    if (this.audioDebugOverlay) {
      syncAudioDebugOverlay(this.audioDebugOverlay, frame.runtimeAudioSnapshot);
    }
    if (this.crowdPresentationOverlay && frame.crowdPresentationSnapshot) {
      syncCrowdPresentationOverlay(
        this.crowdPresentationOverlay,
        frame.crowdPresentationSnapshot,
      );
    }
    if (this.presentationHardeningAuditOverlay && frame.presentationHardeningAuditSnapshot) {
      syncPresentationHardeningAuditOverlay(
        this.presentationHardeningAuditOverlay,
        frame.presentationHardeningAuditSnapshot,
      );
    }
    if (this.weatherDebugOverlay) {
      syncWeatherDebugOverlay(this.weatherDebugOverlay, frame.weatherSnapshot);
    }

    const renderMetrics = this.isDebugOverlayVisible()
      ? frame.renderMetrics ?? undefined
      : undefined;
    this.debugOverlay?.update(
        frame.deltaSeconds,
        this.options.renderer,
        frame.activePrimaryPlayer,
        frame.cameraSnapshot,
        frame.gameplaySnapshot,
        this.isDebugOverlayVisible() && frame.playerBodyVisual
          ? getPlayerBodyVisualSnapshot(frame.playerBodyVisual)
          : undefined,
        renderMetrics,
      );
  }

  dispose(): void {
    for (const [target, type, listener] of this.listeners) {
      target.removeEventListener(type, listener);
    }
    this.listeners.length = 0;
    if (window.__footballDebug === this.options.debugApi) {
      delete window.__footballDebug;
    }
    this.debugPanel.dispose();
    this.debugFeatureRegistry.dispose();
  }

  setDebugToolsEnabled(enabled: boolean): void {
    if (!enabled) {
      this.debugFeatureRegistry.disableAll();
    }
    this.debugPanel.setVisible(enabled);
  }

  private registerDebugFeatures(options: DevelopmentToolsRuntimeOptions): void {
    const queryEnabled = (queryKey: string) => options.searchParams.has(queryKey);
    const registerElementFeature = (
      id: string,
      label: string,
      enabled: boolean,
      createElement: () => HTMLDivElement,
      setElement: (element: HTMLDivElement | null) => void,
    ): void => {
      this.debugFeatureRegistry.register({
        create: () => {
          const element = createElement();
          setElement(element);
          return {
            dispose: () => {
              element.remove();
              setElement(null);
            },
          };
        },
        enabled,
        id,
        label,
      });
    };

    this.debugFeatureRegistry.register({
      create: () => this.createSharedMetricsFeature(),
      enabled: queryEnabled('debug') || options.cameraDebugEnabled,
      id: 'general',
      label: 'General metrics',
    });
    this.debugFeatureRegistry.register({
      create: () => this.createSharedMetricsFeature(),
      enabled: options.cameraDebugEnabled,
      id: 'camera',
      label: 'Camera',
    });
    registerElementFeature(
      'field',
      'Field',
      queryEnabled('fieldAudit'),
      createFieldAuditOverlay,
      () => {},
    );
    registerElementFeature(
      'formation',
      'Formation',
      queryEnabled('formationAudit'),
      createFormationAuditOverlay,
      (element) => {
        this.formationAuditOverlay = element;
      },
    );
    registerElementFeature(
      'route',
      'Route',
      options.routeAuditEnabled,
      createRouteAuditOverlay,
      (element) => {
        this.routeAuditOverlay = element;
      },
    );
    registerElementFeature(
      'passing',
      'Passing',
      options.passAuditEnabled,
      createPassAuditOverlay,
      (element) => {
        this.passAuditOverlay = element;
      },
    );
    registerElementFeature(
      'appearance',
      'Appearance',
      options.appearanceAuditEnabled,
      createAppearanceAuditOverlay,
      (element) => {
        this.appearanceAuditOverlay = element;
      },
    );
    this.debugFeatureRegistry.register({
      create: () => {
        options.onPlayerVisualModeChange('meshyRigged');
        return {
          dispose: () => {
            options.onPlayerVisualModeChange('procedural');
          },
        };
      },
      enabled: false,
      id: 'playerVisualMode',
      label: 'Meshy rigged players',
      description: 'Switch active gameplay player visuals between procedural fallback and the optional Meshy rigged body.',
    });
    registerElementFeature(
      'officials',
      'Officials',
      options.officialsDebugEnabled,
      createOfficialsDebugOverlay,
      (element) => {
        this.officialsDebugOverlay = element;
      },
    );
    registerElementFeature(
      'sidelineTeams',
      'Sideline teams',
      options.sidelineTeamsDebugEnabled,
      createSidelineDebugOverlay,
      (element) => {
        this.sidelineTeamsDebugOverlay = element;
      },
    );
    registerElementFeature(
      'stats',
      'Stats',
      queryEnabled('statsDebug'),
      () => createPlainDebugOverlay('stats-debug-overlay'),
      (element) => {
        this.statsDebugOverlay = element;
      },
    );
    registerElementFeature(
      'rosterLabels',
      'Roster labels',
      queryEnabled('labelDebug') || queryEnabled('rosterDebug'),
      createControlledPlayerLabelOverlay,
      (element) => {
        this.controlledPlayerLabelOverlay = element;
      },
    );
    registerElementFeature(
      'audio',
      'Audio',
      options.audioDebugEnabled,
      createAudioDebugOverlay,
      (element) => {
        this.audioDebugOverlay = element;
      },
    );
    registerElementFeature(
      'commentary',
      'Commentary',
      options.commentaryDebugEnabled,
      createAudioDebugOverlay,
      (element) => {
        this.audioDebugOverlay = element;
      },
    );
    registerElementFeature(
      'crowd',
      'Crowd',
      options.crowdPreviewEnabled || options.crowdPresentationDebugEnabled,
      options.crowdPreviewEnabled ? createCrowdPreviewOverlay : createCrowdPresentationOverlay,
      (element) => {
        if (options.crowdPreviewEnabled) {
          this.crowdPreviewOverlay = element;
        } else {
          this.crowdPresentationOverlay = element;
        }
      },
    );
    registerElementFeature(
      'presentation',
      'Presentation',
      options.presentationAuditEnabled,
      createPresentationAuditOverlay,
      (element) => {
        this.presentationAuditOverlay = element;
      },
    );
    registerElementFeature(
      'pregame',
      'Pregame',
      options.pregameDebugEnabled,
      createPregameDebugOverlay,
      (element) => {
        this.pregameDebugOverlay = element;
      },
    );
    registerElementFeature(
      'introKeys',
      'Intro keys',
      queryEnabled('introKeysDebug') || queryEnabled('keysDebug'),
      () => createPlainDebugOverlay('intro-keys-debug-overlay'),
      (element) => {
        this.introKeysDebugOverlay = element;
      },
    );
    registerElementFeature(
      'placeKick',
      'Place kick',
      queryEnabled('placeKickDebug'),
      () => createPlainDebugOverlay('place-kick-debug-overlay'),
      (element) => {
        this.placeKickDebugOverlay = element;
      },
    );
    registerElementFeature(
      'kickoffReturn',
      'Kickoff return',
      queryEnabled('kickoffReturnDebug'),
      () => createPlainDebugOverlay('kickoff-return-debug-overlay'),
      (element) => {
        this.kickoffReturnDebugOverlay = element;
      },
    );
    registerElementFeature(
      'matchTransition',
      'Match transition',
      queryEnabled('matchDebug') || queryEnabled('transitionDebug'),
      () => createPlainDebugOverlay('match-transition-debug-overlay'),
      (element) => {
        this.matchTransitionDebugOverlay = element;
      },
    );
    registerElementFeature(
      'halftime',
      'Halftime',
      queryEnabled('halftimeDebug'),
      () => createPlainDebugOverlay('halftime-debug-overlay'),
      (element) => {
        this.halftimeDebugOverlay = element;
      },
    );
    registerElementFeature(
      'cadence',
      'Cadence',
      queryEnabled('cadenceDebug'),
      () => createPlainDebugOverlay('cadence-debug-overlay'),
      (element) => {
        this.cadenceDebugOverlay = element;
      },
    );
    registerElementFeature(
      'jerseyNumbers',
      'Jersey numbers',
      queryEnabled('jerseyDebug') || queryEnabled('jerseyNumbersDebug'),
      () => createPlainDebugOverlay('jersey-number-debug-overlay'),
      (element) => {
        this.jerseyNumberDebugOverlay = element;
      },
    );
    registerElementFeature(
      'weather',
      'Weather',
      queryEnabled('weatherDebug'),
      createWeatherDebugOverlay,
      (element) => {
        this.weatherDebugOverlay = element;
      },
    );
    registerElementFeature(
      'league',
      'League',
      queryEnabled('leagueDebug'),
      () => createLeagueDebugOverlay(options.debugApi),
      (element) => {
        this.leagueDebugOverlay = element;
      },
    );
    registerElementFeature(
      'quality',
      'Quality',
      options.performanceDebugEnabled,
      createPerformanceDebugOverlay,
      (element) => {
        this.performanceDebugOverlay = element;
      },
    );
    this.debugFeatureRegistry.register({
      create: () => {
        const panel = new MemoryDebugPanel({
          onApplyRecommendedCount: () => options.debugApi.applyCrowdCapacityRecommendation(),
          onCancelBenchmark: () => {
            options.debugApi.cancelCrowdCapacityBenchmark();
          },
          onExportReport: () => options.debugApi.exportCrowdCapacityReport(),
          onRunBenchmark: () => {
            options.debugApi.runCrowdCapacityBenchmark();
          },
        });
        this.memoryDebugPanel = panel;
        return {
          dispose: () => {
            panel.dispose();
            this.memoryDebugPanel = null;
          },
        };
      },
      enabled: queryEnabled('memoryDebug'),
      id: 'memory',
      label: 'Memory',
      description: 'Scene resource memory estimates and crowd capacity benchmark.',
    });
    registerElementFeature(
      'motion',
      'Player motion',
      queryEnabled('poseDebug'),
      createPlayerPoseDebugOverlay,
      (element) => {
        this.poseDebugOverlay = element;
      },
    );
    registerElementFeature(
      'elevenAudit',
      '11v11 audit',
      options.elevenAuditEnabled,
      createElevenAuditOverlay,
      (element) => {
        this.elevenAuditOverlay = element;
      },
    );
    registerElementFeature(
      'presentationHardening',
      'Presentation hardening',
      options.presentationAuditEnabled && !options.crowdPreviewEnabled,
      createPresentationHardeningAuditOverlay,
      (element) => {
        this.presentationHardeningAuditOverlay = element;
      },
    );
  }

  private createSharedMetricsFeature(): DisposableDebugFeature {
    if (!this.debugOverlay) {
      const overlay = new DebugOverlay({
        initialVisible: true,
        player: this.options.activePlayer(),
        renderer: this.options.renderer,
      });
      this.debugOverlay = overlay;
      return {
        dispose: () => {
          if (
            !this.debugFeatureRegistry.isEnabled('general') &&
            !this.debugFeatureRegistry.isEnabled('camera')
          ) {
            overlay.dispose();
            this.debugOverlay = null;
          }
        },
      };
    }

    this.debugOverlay.setVisible(true);
    return {
      dispose: () => {
        if (
          !this.debugFeatureRegistry.isEnabled('general') &&
          !this.debugFeatureRegistry.isEnabled('camera')
        ) {
          this.debugOverlay?.dispose();
          this.debugOverlay = null;
        }
      },
    };
  }

  private handleDebugPanelShortcut(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key !== 'F1') {
      return;
    }

    event.preventDefault();
    if (this.debugPanel.isVisible()) {
      this.debugFeatureRegistry.disableAll();
      this.debugPanel.setVisible(false);
      return;
    }

    this.debugPanel.setVisible(true);
  }

  private addListener(
    target: EventTarget,
    type: string,
    listener: (event: KeyboardEvent) => void,
  ): void {
    const eventListener: EventListener = (event) => {
      listener(event as KeyboardEvent);
    };
    target.addEventListener(type, eventListener);
    this.listeners.push([target, type, eventListener]);
  }

  private shouldInstallDebugApi(options: DevelopmentToolsRuntimeOptions): boolean {
    return import.meta.env.DEV ||
      options.searchParams.has('debug') ||
      options.searchParams.has('readback') ||
      options.searchParams.has('perfProfile') ||
      options.debugToolsEnabled ||
      options.cameraDebugEnabled ||
      options.presentationAuditEnabled ||
      options.pregameDebugEnabled ||
      options.appearanceAuditEnabled ||
      options.officialsDebugEnabled ||
      options.sidelineTeamsDebugEnabled ||
      options.elevenAuditEnabled ||
      options.audioDebugEnabled ||
      options.performanceDebugEnabled ||
      options.searchParams.has('weatherDebug') ||
      options.searchParams.has('leagueDebug') ||
      options.searchParams.has('placeKickDebug') ||
      options.searchParams.has('kickoffReturnDebug') ||
      options.searchParams.has('halftimeDebug') ||
      options.searchParams.has('statsDebug') ||
      options.searchParams.has('cadenceDebug') ||
      options.searchParams.has('jerseyDebug') ||
      options.searchParams.has('jerseyNumbersDebug') ||
      options.searchParams.has('introKeysDebug') ||
      options.searchParams.has('keysDebug') ||
      options.searchParams.has('memoryDebug') ||
      options.commentaryDebugEnabled ||
      options.crowdPresentationDebugEnabled ||
      options.crowdPreviewEnabled;
  }
}

function createPlainDebugOverlay(className: string): HTMLDivElement {
  const element = document.createElement('div');
  element.className = className;
  document.body.append(element);
  return element;
}

function createLeagueDebugOverlay(debugApi: FootballDebugApi): HTMLDivElement {
  const element = createPlainDebugOverlay('league-debug-overlay');
  const pre = document.createElement('pre');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Reset League Data';
  button.addEventListener('click', () => {
    void debugApi.resetLeagueData();
  });
  element.append(pre, button);
  return element;
}

function syncLeagueDebugOverlay(
  element: HTMLElement,
  snapshot: LeagueInitializationSnapshot,
): void {
  const pre = element.querySelector('pre');
  if (!pre) {
    return;
  }
  pre.textContent = [
    'LEAGUE',
    `status: ${snapshot.status}`,
    `stage: ${snapshot.stage}`,
    `source: ${snapshot.source}`,
    `schema: ${snapshot.schemaVersion}`,
    `generator: ${snapshot.generatorVersion}`,
    `seed: ${snapshot.seed}`,
    `teams: ${snapshot.teamCount}`,
    `players: ${snapshot.playerCount}`,
    `encodedBytes: ${snapshot.encodedBytes}`,
    `decodedEstimateBytes: ${snapshot.decodedEstimateBytes}`,
    `hash: ${snapshot.contentHash ?? 'none'}`,
    `durationMs: ${snapshot.initializationDurationMs.toFixed(1)}`,
    `error: ${snapshot.error ?? 'none'}`,
  ].join('\n');
}

function syncPlaceKickDebugOverlay(
  element: HTMLElement,
  snapshot: PlaceKickFrameSnapshot,
): void {
  element.textContent = [
    'PLACE KICK',
    `phase: ${snapshot.phase}`,
    `sequence: ${snapshot.sequenceIndex ?? 'none'}`,
    `teams: ${snapshot.kickingTeam ?? 'none'} vs ${snapshot.defendingTeam ?? 'none'}`,
    `kicker: ${snapshot.kickerRosterId ?? 'none'}`,
    `holder: ${snapshot.holderRosterId ?? 'none'}`,
    `participants: ${snapshot.participantCount} protect ${snapshot.kickingParticipantCount} rush ${snapshot.defendingParticipantCount}`,
    `helmets: ${snapshot.helmetReadyCount}/${snapshot.participantCount}`,
    `meter: ${snapshot.meterActive ? 'active' : 'inactive'}`,
    `result: ${snapshot.good === null ? 'none' : snapshot.good ? 'good' : snapshot.result?.reason ?? 'miss'}`,
    `ball: ${formatVector(snapshot.ballPosition)}`,
    `validation: ${snapshot.formationValidation.join('; ') || 'none'}`,
    `next: ${snapshot.nextStage ?? 'none'}`,
  ].join('\n');
}

function syncKickoffReturnDebugOverlay(
  element: HTMLElement,
  snapshot: KickoffFrameSnapshot,
): void {
  const assigned = snapshot.assignedReturner;
  element.textContent = [
    'KICKOFF RETURN',
    `phase: ${snapshot.phase}`,
    `sequence: ${snapshot.sequenceIndex ?? 'none'}`,
    `teams: ${snapshot.kickingTeam ?? 'none'} -> ${snapshot.receivingTeam ?? 'none'}`,
    `landing: ${snapshot.landingType ?? 'none'}`,
    `returner: ${assigned?.returnerRosterId ?? 'none'} visual ${assigned?.returnerVisualId ?? 'none'}`,
    `carrier: ${snapshot.carrierRosterId ?? 'none'} visual ${snapshot.carrierVisualId ?? 'none'}`,
    `clock: ${snapshot.clockRunning ? 'running' : 'stopped'} ${snapshot.clockStartReason ?? 'none'}`,
    `lane: ${snapshot.returnLane ?? 'none'}`,
    `blockers: ${snapshot.blockerAssignments.length}`,
    `outcome: ${snapshot.returnResult?.type ?? 'none'}`,
    `spot: ${formatFieldPosition(snapshot.returnResult?.receivingStartPosition ?? snapshot.receivingStartPosition)}`,
    `validation: ${snapshot.formationValidation.join('; ') || 'none'}`,
  ].join('\n');
}

function syncMatchTransitionDebugOverlay(
  element: HTMLElement,
  match: MatchSnapshot | null,
  gameplay: GameplaySnapshot,
): void {
  const transition = match?.previousDriveSummary?.possessionTransition ?? null;
  element.textContent = [
    'MATCH TRANSITION',
    `possession: ${match?.possession ?? 'none'}`,
    `previous: ${transition?.fromTeam ?? match?.previousDriveSummary?.possession ?? 'none'}`,
    `driveEnd: ${formatFieldPosition(match?.previousDriveSummary?.endingFieldPosition ?? null)}`,
    `reason: ${transition?.reason ?? 'none'}`,
    `next: ${transition?.toTeam ?? 'none'} ${formatFieldPosition(transition?.nextOffenseStartingPosition ?? null)}`,
    `gameplaySpot: ${formatSpot(gameplay.currentBallSpot)}`,
    `snapLane: ${gameplay.drive.snapLane}`,
    `touchback: ${transition?.reason.includes('Touchback') ? 'yes' : 'no'}`,
  ].join('\n');
}

function syncHalftimeDebugOverlay(
  element: HTMLElement,
  snapshot: HalftimePresentationSnapshot,
): void {
  const story = snapshot.selectedStory;
  const active = snapshot.activeLine;
  element.textContent = [
    'HALFTIME',
    `phase: ${snapshot.phase}`,
    `story: ${story?.category ?? 'none'} team=${story?.supportingTeam ?? 'none'}`,
    `supporting: ${story?.supportingStatKeys.join(',') || 'none'}`,
    `voicePack: ${snapshot.activeVoicePack ?? 'none'}`,
    `line: ${active?.lineId ?? 'none'} script=${active?.scriptId ?? 'none'}`,
    `playback: ${active?.playbackState ?? 'idle'} remaining=${(active?.remainingSeconds ?? 0).toFixed(2)}`,
    `shotProgress: ${snapshot.shotProgress.toFixed(2)}`,
    `gameplayVisible: ${snapshot.gameplayPlayerVisibleCount}`,
    `sidelineVisible: ${snapshot.sidelineVisibleCount}`,
    `nextPossession: ${snapshot.nextPossession}`,
    `canContinue: ${snapshot.canContinue ? 'yes' : 'no'}`,
  ].join('\n');
}

function syncCadenceDebugOverlay(
  element: HTMLElement,
  snapshot: PreSnapCadenceSnapshot,
): void {
  element.textContent = [
    'CADENCE',
    `phase: ${snapshot.phase}`,
    `sequence: ${snapshot.sequence}`,
    `selectedPlay: ${snapshot.selectedPlayId ?? 'none'}`,
    `playSelected: ${snapshot.playSelectedForSnap ? 'yes' : 'no'}`,
    `hud: ${snapshot.hudText || 'hidden'}`,
    `headYaw: ${snapshot.headYawRadians.toFixed(2)}`,
    `ready: ${snapshot.readyAssetId ?? 'none'}`,
    `hut: ${snapshot.hutAssetId ?? 'none'}`,
    `selectionLocked: ${snapshot.playSelectionLocked ? 'yes' : 'no'}`,
    `earlySnapWarning: ${snapshot.earlySnapWarningVisible ? 'yes' : 'no'}`,
  ].join('\n');
}

function syncJerseyNumberDebugOverlay(
  element: HTMLElement,
  snapshot: JerseyNumberDebugSnapshot,
): void {
  const visiblePreview = snapshot.visuals
    .slice(0, 12)
    .map((visual) =>
      `${visual.visualId} roster=${visual.rosterPlayerId} #${visual.jerseyNumber ?? 'none'} visible=${visual.visible ? 'yes' : 'no'} material=${visual.materialId ?? 'none'}`)
    .join('\n');
  element.textContent = [
    'JERSEY NUMBERS',
    `atlas: ${snapshot.atlas.atlasCreated ? 'created' : 'not-created'} ${snapshot.atlas.textureSize}px cells ${snapshot.atlas.cellCount}`,
    `materials: ${snapshot.materialCache.materialCount}`,
    `visuals: ${snapshot.visualCount} visible ${snapshot.visibleCount} hidden ${snapshot.hiddenCount}`,
    `missingBindings: ${snapshot.missingBindingCount}`,
    `unreadableContrast: ${snapshot.unreadableContrastCount}`,
    visiblePreview || 'no numbered visuals',
  ].join('\n');
}

function syncIntroKeysDebugOverlay(
  element: HTMLElement,
  overlaySnapshot: KeysToGameOverlaySnapshot,
  pregameSnapshot: PregamePresentationSnapshot | null,
): void {
  const keys = pregameSnapshot?.keysToGame ?? [];
  element.textContent = [
    'INTRO KEYS',
    `overlay: ${overlaySnapshot.mode} visible ${overlaySnapshot.visible ? 'yes' : 'no'}`,
    `keyCount: ${overlaySnapshot.keyCount}`,
    `pregamePhase: ${pregameSnapshot?.phase ?? 'inactive'}`,
    `shot: ${pregameSnapshot?.currentShot ?? 'none'}`,
    `weather: ${pregameSnapshot?.weatherCondition ?? 'none'}`,
    ...keys.slice(0, 3).map((key, index) => `${index + 1}. ${key.text} [${key.source}]`),
  ].join('\n');
}

function formatVector(vector: { x: number; y: number; z: number } | null): string {
  if (!vector) {
    return 'none';
  }
  return `${vector.x.toFixed(1)},${vector.y.toFixed(1)},${vector.z.toFixed(1)}`;
}

function formatSpot(spot: { x: number; z: number } | null): string {
  if (!spot) {
    return 'none';
  }
  return `${spot.x.toFixed(1)},${spot.z.toFixed(1)}`;
}

function formatFieldPosition(
  position: { lateralX: number; yardsFromOwnGoalLine: number } | null,
): string {
  if (!position) {
    return 'none';
  }
  return `${formatPossessionFieldPosition(position)} x=${position.lateralX.toFixed(1)}`;
}
