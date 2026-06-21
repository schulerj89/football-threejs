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
import { DebugOverlay, type RenderMetricsSnapshot } from '../debugOverlay';
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
import type {
  PerformanceScenarioName,
} from '../performance/PerformanceBudget';
import type {
  PerformanceScenarioSnapshot,
} from '../performance/PerformanceScenarioRunner';
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
  geometryCount: number;
  materialCount: number;
  presentationHistoryCount: number;
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
  getPerformanceProfileReport: (
    environment?: Partial<PerformanceReportEnvironment>,
  ) => PerformanceReport;
  getPerformanceScenarioSnapshot: () => PerformanceScenarioSnapshot | null;
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
  elevenAuditEnabled: boolean;
  formationPreviewActive: boolean;
  passAuditEnabled: boolean;
  presentationAuditEnabled: boolean;
  routeAuditEnabled: boolean;
  searchParams: URLSearchParams;
  sevenAuditEnabled: boolean;
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
  presentationAuditSnapshot: PresentationAuditSnapshot | null;
  emptyPresentationAuditSnapshot: PresentationAuditSnapshot;
  presentationHardeningAuditSnapshot: PresentationHardeningAuditSnapshot | null;
  renderMetrics: RenderMetricsSnapshot | null;
  routeArtSnapshot: RouteArtRendererSnapshot;
  runtimeAudioSnapshot: RuntimeAudioDebugSnapshot;
  sevenAuditSnapshot: SevenAuditSnapshot | null;
  playerVisuals: Map<string, THREE.Group>;
}

export class DevelopmentToolsRuntime {
  private readonly appearanceAuditOverlay: HTMLDivElement | null;
  private readonly audioDebugOverlay: HTMLDivElement | null;
  private readonly crowdPresentationOverlay: HTMLDivElement | null;
  private readonly crowdPreviewOverlay: HTMLDivElement | null;
  private readonly debugOverlay: DebugOverlay;
  private readonly elevenAuditOverlay: HTMLDivElement | null;
  private readonly formationAuditOverlay: HTMLDivElement | null;
  private readonly passAuditOverlay: HTMLDivElement | null;
  private readonly poseDebugOverlay: HTMLDivElement | null;
  private readonly presentationAuditOverlay: HTMLDivElement | null;
  private readonly presentationHardeningAuditOverlay: HTMLDivElement | null;
  private readonly routeAuditOverlay: HTMLDivElement | null;
  private readonly sevenAuditOverlay: HTMLDivElement | null;
  private readonly listeners: Array<[EventTarget, string, EventListener]> = [];

  constructor(private readonly options: DevelopmentToolsRuntimeOptions) {
    this.debugOverlay = new DebugOverlay({
      renderer: options.renderer,
      player: options.activePlayer(),
    });
    this.poseDebugOverlay = options.searchParams.has('poseDebug')
      ? createPlayerPoseDebugOverlay()
      : null;
    this.formationAuditOverlay = options.searchParams.has('formationAudit')
      ? createFormationAuditOverlay()
      : null;
    this.presentationAuditOverlay = options.presentationAuditEnabled
      ? createPresentationAuditOverlay()
      : null;
    this.routeAuditOverlay = options.routeAuditEnabled ? createRouteAuditOverlay() : null;
    this.passAuditOverlay = options.passAuditEnabled ? createPassAuditOverlay() : null;
    this.sevenAuditOverlay = options.sevenAuditEnabled ? createSevenAuditOverlay() : null;
    this.elevenAuditOverlay = options.elevenAuditEnabled ? createElevenAuditOverlay() : null;
    this.appearanceAuditOverlay = options.appearanceAuditEnabled
      ? createAppearanceAuditOverlay()
      : null;
    this.audioDebugOverlay = options.audioDebugEnabled || options.commentaryDebugEnabled
      ? createAudioDebugOverlay()
      : null;
    this.crowdPreviewOverlay = options.crowdPreviewEnabled ? createCrowdPreviewOverlay() : null;
    this.crowdPresentationOverlay =
      options.crowdPresentationDebugEnabled && !options.crowdPreviewEnabled
        ? createCrowdPresentationOverlay()
        : null;
    this.presentationHardeningAuditOverlay =
      options.presentationAuditEnabled && !options.crowdPreviewEnabled
        ? createPresentationHardeningAuditOverlay()
        : null;

    if (this.shouldInstallDebugApi(options)) {
      window.__footballDebug = options.debugApi;
      this.addListener(window, 'keydown', options.onDevelopmentCameraToggle);
    }
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
    return this.debugOverlay.isVisible();
  }

  shouldCollectPresentationDiagnostics(): boolean {
    return this.debugOverlay.isVisible() ||
      !!this.poseDebugOverlay ||
      !!this.presentationAuditOverlay ||
      !!this.routeAuditOverlay ||
      !!this.passAuditOverlay ||
      !!this.sevenAuditOverlay ||
      !!this.elevenAuditOverlay ||
      !!this.appearanceAuditOverlay ||
      !!this.crowdPresentationOverlay ||
      !!this.presentationHardeningAuditOverlay;
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

    const renderMetrics = this.debugOverlay.isVisible()
      ? frame.renderMetrics ?? undefined
      : undefined;
    this.debugOverlay.update(
      frame.deltaSeconds,
      this.options.renderer,
      frame.activePrimaryPlayer,
      frame.cameraSnapshot,
      frame.gameplaySnapshot,
      this.debugOverlay.isVisible() && frame.playerBodyVisual
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
    for (const overlay of [
      this.appearanceAuditOverlay,
      this.audioDebugOverlay,
      this.crowdPresentationOverlay,
      this.crowdPreviewOverlay,
      this.elevenAuditOverlay,
      this.formationAuditOverlay,
      this.passAuditOverlay,
      this.poseDebugOverlay,
      this.presentationAuditOverlay,
      this.presentationHardeningAuditOverlay,
      this.routeAuditOverlay,
      this.sevenAuditOverlay,
    ]) {
      overlay?.remove();
    }
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
      options.cameraDebugEnabled ||
      options.presentationAuditEnabled ||
      options.appearanceAuditEnabled ||
      options.sevenAuditEnabled ||
      options.elevenAuditEnabled ||
      options.audioDebugEnabled ||
      options.commentaryDebugEnabled ||
      options.crowdPresentationDebugEnabled ||
      options.crowdPreviewEnabled;
  }
}
