import * as THREE from 'three';
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
import {
  createSevenAuditOverlay,
  syncSevenAuditOverlay,
  type SevenAuditSnapshot,
} from '../sevenOnSevenAudit';
import { getHelmetAssetSnapshot, type HelmetAssetSnapshot } from '../helmetVisual';

declare global {
  interface Window {
    __footballDebug?: FootballDebugApi;
  }
}

export interface SevenAuditResetCycleResourceSnapshot {
  activeAudioNodes: number;
  activePlayerRootCount: number;
  crowdInstanceCount: number;
  debugOverlayCount: number;
  footballMeshCount: number;
  geometryCount: number;
  materialCount: number;
  officialMeshCount: number;
  presentationHistoryCount: number;
  sidelineMeshCount: number;
  stadiumMeshCount: number;
  textureCount: number;
  visualRootCount: number;
}

export interface SevenAuditResetCycleResult {
  after: SevenAuditResetCycleResourceSnapshot;
  before: SevenAuditResetCycleResourceSnapshot;
  cycles: number;
}

export interface ElevenAuditResetCycleResourceSnapshot extends SevenAuditResetCycleResourceSnapshot {
  activeCameraShot: string | null;
  activePresentationHold: boolean;
  crowdReaction: string | null;
  helmetInstanceCount: number;
  officialCount: number;
  stadiumGeometryCount: number;
}

export interface ElevenAuditResetCycleResult {
  after: ElevenAuditResetCycleResourceSnapshot;
  before: ElevenAuditResetCycleResourceSnapshot;
  cycles: number;
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
  getCrowdPresentationSnapshot: () => CrowdPresentationSnapshot | null;
  getCrowdPreviewSnapshot: () => CrowdPreviewSnapshot | null;
  getFormationPreviewSnapshot: () => FormationPreviewSnapshot | null;
  getGameExperienceSnapshot: () => GameExperienceDebugSnapshot;
  getMatchSnapshot: () => MatchSnapshot | null;
  getGameplaySnapshot: () => GameplaySnapshot;
  getGamePresentationRuntimeSnapshot: () => GamePresentationRuntimeSnapshot;
  getHelmetAssetSnapshot: () => HelmetAssetSnapshot;
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
  getSevenAuditSnapshot: () => SevenAuditSnapshot | null;
  getStadiumSnapshot: () => StadiumControllerSnapshot;
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
  runElevenAuditResetCycles: (cycles?: number) => ElevenAuditResetCycleResult | null;
  runSevenAuditResetCycles: (cycles?: number) => SevenAuditResetCycleResult | null;
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
  sevenAuditEnabled: boolean;
  sidelineTeamsDebugEnabled: boolean;
  renderer: THREE.WebGLRenderer;
  activePlayer: () => PlayerModel;
  debugApi: FootballDebugApi;
  onCrowdPreviewControls: (event: KeyboardEvent) => void;
  onDevelopmentCameraToggle: (event: KeyboardEvent) => void;
  onFormationPreviewLaneControls: (event: KeyboardEvent) => void;
  onPauseSettingsShortcut: (event: KeyboardEvent) => void;
  onPresentationAuditControls: (event: KeyboardEvent) => void;
}

export interface DevelopmentOverlayFrame {
  activePrimaryPlayer: Parameters<DebugOverlay['update']>[2];
  cameraSnapshot: GameplayCameraDebugSnapshot;
  controlledPlayerLabelSnapshot: ControlledPlayerLabelSnapshot;
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
  pregamePresentationSnapshot: PregamePresentationSnapshot | null;
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
  sevenAuditSnapshot: SevenAuditSnapshot | null;
  playerVisuals: Map<string, THREE.Group>;
}

export class DevelopmentToolsRuntime {
  private appearanceAuditOverlay: HTMLDivElement | null = null;
  private audioDebugOverlay: HTMLDivElement | null = null;
  private crowdPresentationOverlay: HTMLDivElement | null = null;
  private crowdPreviewOverlay: HTMLDivElement | null = null;
  private controlledPlayerLabelOverlay: HTMLDivElement | null = null;
  private debugOverlay: DebugOverlay | null = null;
  private elevenAuditOverlay: HTMLDivElement | null = null;
  private formationAuditOverlay: HTMLDivElement | null = null;
  private passAuditOverlay: HTMLDivElement | null = null;
  private memoryDebugPanel: MemoryDebugPanel | null = null;
  private officialsDebugOverlay: HTMLDivElement | null = null;
  private sidelineTeamsDebugOverlay: HTMLDivElement | null = null;
  private performanceDebugOverlay: HTMLDivElement | null = null;
  private poseDebugOverlay: HTMLDivElement | null = null;
  private presentationAuditOverlay: HTMLDivElement | null = null;
  private pregameDebugOverlay: HTMLDivElement | null = null;
  private presentationHardeningAuditOverlay: HTMLDivElement | null = null;
  private routeAuditOverlay: HTMLDivElement | null = null;
  private sevenAuditOverlay: HTMLDivElement | null = null;
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
      !!this.controlledPlayerLabelOverlay ||
      !!this.performanceDebugOverlay ||
      !!this.pregameDebugOverlay ||
      !!this.sevenAuditOverlay ||
      !!this.elevenAuditOverlay ||
      !!this.appearanceAuditOverlay ||
      !!this.crowdPresentationOverlay ||
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
      syncPregameDebugOverlay(this.pregameDebugOverlay, frame.pregamePresentationSnapshot);
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
    if (this.controlledPlayerLabelOverlay) {
      syncControlledPlayerLabelOverlay(
        this.controlledPlayerLabelOverlay,
        frame.controlledPlayerLabelSnapshot,
      );
    }
    if (this.performanceDebugOverlay) {
      syncPerformanceDebugOverlay(this.performanceDebugOverlay, frame.qualityDebugSnapshot);
    }
    if (this.sevenAuditOverlay && frame.sevenAuditSnapshot) {
      syncSevenAuditOverlay(this.sevenAuditOverlay, frame.sevenAuditSnapshot);
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
      'sevenAudit',
      '7v7 audit',
      options.sevenAuditEnabled,
      createSevenAuditOverlay,
      (element) => {
        this.sevenAuditOverlay = element;
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
    this.debugPanel.toggleVisible();
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
      options.sevenAuditEnabled ||
      options.elevenAuditEnabled ||
      options.audioDebugEnabled ||
      options.performanceDebugEnabled ||
      options.searchParams.has('memoryDebug') ||
      options.commentaryDebugEnabled ||
      options.crowdPresentationDebugEnabled ||
      options.crowdPreviewEnabled;
  }
}
