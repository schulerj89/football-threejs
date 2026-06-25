import * as THREE from 'three';
import {
  createBallVisual,
  getBallVisualSnapshot,
  resolveBallVisualStyle,
  syncBallVisual,
  type BallVisualSnapshot,
} from '../ballVisual';
import { AudioMixer, type AudioPlaybackHandle } from '../audio/AudioMixer';
import {
  MenuMusicPlaylistController,
  type MenuMusicPlaylistSnapshot,
} from '../audio/MenuMusicPlaylistController';
import {
  GameMusicDirector,
} from '../audio/GameMusicDirector';
import {
  StadiumChantDirector,
} from '../audio/StadiumChantDirector';
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
import type { PreSnapCadenceSnapshot } from '../gameplay/PreSnapCadenceModel';
import {
  PlayerPoseController,
  type PlayerPoseSnapshot,
} from '../presentation/PlayerPoseController';
import { syncPreSnapQuarterbackHeadYaw } from '../presentation/PreSnapHeadSwivel';
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
import { NowPlayingIndicator } from '../ui/NowPlayingIndicator';
import type { PlayDefinition } from '../playbook';
import type { BallModel } from '../ballModel';
import type { RuntimeAudioDebugSnapshot } from '../audio/AudioDebugOverlay';
import { COMMENTARY_CATALOG } from '../audio/CommentaryCatalog';
import type { FramePerformanceProfiler } from '../performance/FramePerformanceProfiler';
import {
  getQualityProfile,
  type QualityProfileSnapshot,
} from '../performance/QualityProfile';
import {
  StadiumController,
  resolveStadiumThemeId,
  type StadiumControllerSnapshot,
} from '../stadium/StadiumController';
import type { StadiumThemeId } from '../stadium/StadiumTypes';
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
  SelectedReceiverTargetIndicator,
  type SelectedReceiverTargetIndicatorSnapshot,
} from '../presentation/SelectedReceiverTargetIndicator';
import {
  SidelineTeamController,
  type SidelineTeamControllerSnapshot,
} from '../presentation/teams/SidelineTeamController';
import type { MatchSnapshot } from '../match/MatchTypes';
import type { AppPhase } from './ApplicationLifecycle';
import {
  PregameAudioCoordinator,
} from '../presentation/pregame/PregameAudioCoordinator';
import {
  PregameLowerThird,
} from '../presentation/pregame/PregameLowerThird';
import {
  PregamePresentationDirector,
  type PregamePresentationUpdateResult,
} from '../presentation/pregame/PregamePresentationDirector';
import {
  PregameWarmupController,
} from '../presentation/pregame/PregameWarmupController';
import {
  preloadFootballPlayerVisualAssets,
} from '../presentation/players/FootballPlayerVisualFactory';
import {
  QBShowcaseCard,
  type QBShowcaseCardSnapshot,
} from '../presentation/pregame/QBShowcaseCard';
import {
  KeysToGameOverlay,
  type KeysToGameOverlaySnapshot,
} from '../presentation/pregame/KeysToGameOverlay';
import type {
  PregamePresentationContext,
  PregamePresentationSnapshot,
} from '../presentation/pregame/PregamePresentationTypes';
import type { PregameWeatherCondition } from '../audio/PregameCommentaryCatalog';
import { createClearWeatherSnapshot } from '../weather/WeatherProfile';
import type { WeatherSnapshot } from '../weather/WeatherTypes';
import {
  CoinTossController,
} from '../presentation/coinToss/CoinTossController';
import type {
  CoinTossDebugSnapshot,
  CoinTossFrameResult,
} from '../presentation/coinToss/CoinTossTypes';
import {
  KickoffPresentationDirector,
} from '../specialTeams/KickoffPresentationDirector';
import type {
  KickoffFrameResult,
  KickoffFrameSnapshot,
  KickoffPresentationContext,
} from '../specialTeams/KickoffTypes';
import {
  PlaceKickPresentationDirector,
} from '../specialTeams/PlaceKickPresentationDirector';
import type {
  PlaceKickFrameResult,
  PlaceKickFrameSnapshot,
  PlaceKickPresentationContext,
  PlaceKickTimingInput,
} from '../specialTeams/PlaceKickTypes';
import { PlaceKickMeter } from '../ui/PlaceKickMeter';
import { VoicePackAssetResolver } from '../audio/voicePacks/VoicePackAssetResolver';
import {
  HalftimePresentationDirector,
} from '../presentation/halftime/HalftimePresentationDirector';
import type {
  HalftimePresentationSnapshot,
  HalftimePresentationUpdateResult,
} from '../presentation/halftime/HalftimePresentationTypes';
import { resolvePostgameStory } from '../presentation/postgame/PostgameStoryResolver';
import { POSTGAME_SIGNOFF_CLIP } from '../audio/PostgameSignoffCatalog';

export interface PresentationRuntimeOptions {
  formationPreviewActive: boolean;
  gameExperience: ResolvedGameExperienceSettings;
  initialPlays: PlayDefinition[];
  routeAuditEnabled: boolean;
  scene: THREE.Scene;
  searchParams: URLSearchParams;
  renderer: THREE.WebGLRenderer;
  warn?: (message: string) => void;
  getWeatherSnapshot?: () => WeatherSnapshot;
  onHalftimeContinue?: () => void;
  onPunt?: () => void;
}

export interface PresentationFrameOptions {
  active: boolean;
  ball: BallModel;
  commentaryActive: boolean;
  crowdCutawaysEnabled: boolean;
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  playerVisuals: Map<string, THREE.Group>;
  preSnapCadence?: PreSnapCadenceSnapshot | null;
  selectedPlay: PlayDefinition;
  profiler?: FramePerformanceProfiler;
}

export interface MenuPresentationFrameOptions {
  appPhase: AppPhase;
  ball: BallModel;
  profiler?: FramePerformanceProfiler;
}

export interface PregamePresentationFrameOptions {
  ball: BallModel;
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: MatchSnapshot | null;
  playerVisuals: Map<string, THREE.Group>;
  profiler?: FramePerformanceProfiler;
}

export interface CoinTossPresentationFrameOptions {
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: MatchSnapshot | null;
  playerVisuals: Map<string, THREE.Group>;
  profiler?: FramePerformanceProfiler;
}

export interface KickoffPresentationFrameOptions {
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: MatchSnapshot | null;
  playerVisuals: Map<string, THREE.Group>;
  profiler?: FramePerformanceProfiler;
}

export interface PlaceKickPresentationFrameOptions {
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: MatchSnapshot | null;
  playerVisuals: Map<string, THREE.Group>;
  profiler?: FramePerformanceProfiler;
}

export interface HalftimePresentationFrameOptions {
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: MatchSnapshot | null;
  playerVisuals: Map<string, THREE.Group>;
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
  readonly gameMusicDirector: GameMusicDirector;
  readonly gameplayHud = createGameplayHud();
  readonly playerPoseController: PlayerPoseController;
  readonly pregameLowerThird: PregameLowerThird;
  readonly keysToGameOverlay: KeysToGameOverlay;
  readonly pregameWarmupController: PregameWarmupController;
  readonly qbShowcaseCard: QBShowcaseCard;
  readonly routeArtRenderer: RouteArtRenderer;
  readonly selectedReceiverTargetIndicator: SelectedReceiverTargetIndicator;
  readonly stadiumController: StadiumController;
  readonly sidelineTeamController: SidelineTeamController;
  readonly titleMusicController: MenuMusicPlaylistController;
  readonly stadiumChantDirector: StadiumChantDirector;
  readonly nowPlayingIndicator: NowPlayingIndicator;
  readonly controlledPlayerLabels: ControlledPlayerLabelRenderer;
  readonly coinTossController: CoinTossController;
  readonly kickoffPresentationDirector: KickoffPresentationDirector;
  readonly placeKickMeter: PlaceKickMeter;
  readonly placeKickPresentationDirector: PlaceKickPresentationDirector;

  private readonly scene: THREE.Scene;
  private cameraController: GameplayCameraController;
  private crowdPresentationController: CrowdPresentationController | null;
  private crowdPresentationSettings: CrowdPresentationSettings;
  private gameExperience: ResolvedGameExperienceSettings;
  private qualityProfile: QualityProfileSnapshot;
  private readonly gamePresentationRuntime: GamePresentationRuntime;
  private readonly holdCinematicPreSnapEstablish: boolean;
  private lastAutomaticPlaceKickSequenceIndex: number | null = null;
  private officialsController: OfficialsPresentationController | null = null;
  private playCallUi: PlayCallUi | null;
  private pregameAudioCoordinator: PregameAudioCoordinator;
  private pregamePresentationDirector: PregamePresentationDirector;
  private halftimePresentationDirector: HalftimePresentationDirector;
  private postgameAudioHandle: AudioPlaybackHandle | null = null;
  private postgameCaption: string | null = null;
  private postgameCaptionUntilSeconds = 0;
  private postgameKey: string | null = null;
  private readonly onHalftimeContinue: () => void;
  private readonly onPunt: () => void;
  private presentationHoldDirector: PresentationHoldDirector;
  private readonly voicePackResolver: VoicePackAssetResolver;
  private readonly searchParams: URLSearchParams;
  private readonly getWeatherSnapshot: () => WeatherSnapshot;
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
    getWeatherSnapshot,
    onHalftimeContinue,
    onPunt,
  }: PresentationRuntimeOptions) {
    this.scene = scene;
    this.searchParams = searchParams;
    this.onHalftimeContinue = onHalftimeContinue ?? (() => undefined);
    this.onPunt = onPunt ?? (() => undefined);
    this.getWeatherSnapshot = getWeatherSnapshot ?? createClearWeatherSnapshot;
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
    void preloadFootballPlayerVisualAssets(gameExperience.settings.playerVisualMode).catch((error: unknown) => {
      warn?.(`Player visual asset preload failed: ${error instanceof Error ? error.message : String(error)}`);
    });

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
      themeId: this.resolveStadiumThemeId(),
      upperTierEnabled: shouldUseStadiumUpperTier(gameExperience, this.qualityProfile),
    });
    if (!this.crowdPreviewController) {
      this.scene.add(this.stadiumController.group);
    }

    this.applyOfficialsSettings(gameExperience);

    this.sidelineTeamController = new SidelineTeamController({
      coachesEnabled: gameExperience.settings.coachesEnabled,
      density: gameExperience.settings.sidelineDensity,
      enabled: !this.crowdPreviewController && (
        gameExperience.settings.sidelinePlayersEnabled ||
        gameExperience.settings.tunnelTableauEnabled
      ),
      playerVisualMode: gameExperience.settings.playerVisualMode,
      rosterBinding: this.rosterBinding,
      sidelinePlayersEnabled: gameExperience.settings.sidelinePlayersEnabled,
      teamTheme: this.teamTheme,
      tunnelTableauEnabled: gameExperience.settings.tunnelTableauEnabled,
    });
    if (!this.crowdPreviewController) {
      this.scene.add(this.sidelineTeamController.group);
    }

    this.pregameWarmupController = new PregameWarmupController({
      enabled: !this.crowdPreviewController,
      playerVisualMode: gameExperience.settings.playerVisualMode,
      rosterBinding: this.rosterBinding,
      teamTheme: this.teamTheme,
    });
    if (!this.crowdPreviewController) {
      this.scene.add(this.pregameWarmupController.group);
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

    const defensiveCoverageArtEnabled =
      searchParams.has('coverageArt') || searchParams.has('defenseArt');
    const combinedPlayArtEnabled = searchParams.has('bothPlayArt');
    this.routeArtRenderer = new RouteArtRenderer({
      auditEnabled: routeAuditEnabled,
      coverageShellEnabled: defensiveCoverageArtEnabled || combinedPlayArtEnabled,
      enabled: gameExperience.settings.routeArtEnabled,
      playArtMode: combinedPlayArtEnabled
        ? 'both'
        : defensiveCoverageArtEnabled
          ? 'defense'
          : 'offense',
    });
    this.scene.add(this.routeArtRenderer.group);

    this.selectedReceiverTargetIndicator = new SelectedReceiverTargetIndicator();
    this.scene.add(this.selectedReceiverTargetIndicator.group);

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
    this.titleMusicController = new MenuMusicPlaylistController(this.audioMixer, {
      randomizeInitialTrack: true,
    });
    this.gameAudioDirector = new GameAudioDirector(this.audioMixer);
    this.gameMusicDirector = new GameMusicDirector(this.audioMixer);
    this.stadiumChantDirector = new StadiumChantDirector(this.audioMixer);
    this.voicePackResolver = new VoicePackAssetResolver({
      initialSelection: {
        matchSeed: 'menu',
        opponentTeamId: this.teamTheme.defense.profile.id,
        setting: gameExperience.settings.announcerVoice,
        userTeamId: this.teamTheme.offense.profile.id,
      },
      registerAudioAssets: (assets) => {
        this.audioMixer.registerDynamicAudioAssets(assets);
      },
      warn,
    });
    this.broadcastCommentaryDirector = new BroadcastCommentaryDirector(this.audioMixer, {
      enabled: true,
      voicePackResolver: this.voicePackResolver,
    });
    this.pregameLowerThird = new PregameLowerThird();
    this.keysToGameOverlay = new KeysToGameOverlay();
    this.pregameAudioCoordinator = new PregameAudioCoordinator(
      this.audioMixer,
      this.titleMusicController,
      this.gameAudioDirector,
      {
        voicePackResolver: this.voicePackResolver,
      },
    );
    this.coinTossController = new CoinTossController({
      audioCoordinator: this.pregameAudioCoordinator,
      coinAudio: this.audioMixer,
      playerVisualMode: gameExperience.settings.playerVisualMode,
      rosterBinding: this.rosterBinding,
      teamTheme: this.teamTheme,
      warn,
    });
    this.kickoffPresentationDirector = new KickoffPresentationDirector({
      audioCoordinator: this.pregameAudioCoordinator,
      ballVisualStyle: resolveBallVisualStyle(searchParams.get('ballVisual')),
      playerVisualMode: gameExperience.settings.playerVisualMode,
      sfxAudio: this.audioMixer,
      rosterBinding: this.rosterBinding,
      teamTheme: this.teamTheme,
      warn,
    });
    this.placeKickPresentationDirector = new PlaceKickPresentationDirector({
      audio: this.audioMixer,
      ballVisualStyle: resolveBallVisualStyle(searchParams.get('ballVisual')),
      playerVisualMode: gameExperience.settings.playerVisualMode,
      rosterBinding: this.rosterBinding,
      teamTheme: this.teamTheme,
      warn,
    });
    this.placeKickMeter = new PlaceKickMeter(window);
    if (!this.crowdPreviewController) {
      this.scene.add(this.coinTossController.group);
      this.scene.add(this.kickoffPresentationDirector.group);
      this.scene.add(this.placeKickPresentationDirector.group);
    }
    this.pregamePresentationDirector = this.createPregamePresentationDirector();
    this.halftimePresentationDirector = this.createHalftimePresentationDirector();
    this.qbShowcaseCard = new QBShowcaseCard();
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
    this.nowPlayingIndicator = new NowPlayingIndicator({
      onNext: () => {
        void this.titleMusicController.nextTrack();
      },
      onPrevious: () => {
        void this.titleMusicController.previousTrack();
      },
    });
    this.playCallUi = formationPreviewActive || this.crowdPreviewController
      ? null
      : createPlayCallUi(initialPlays, this.teamTheme, this.onPunt);
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

  dismissPlayCallUiAfterSelection(): void {
    this.playCallUi?.dismissAfterSelection();
  }

  resetCameraPresentation(): void {
    this.cameraController.resetPresentation();
  }

  resetPregamePresentationIdentity(): void {
    this.pregamePresentationDirector.resetPresentationIdentity();
    this.pregameWarmupController.setActive(false);
    this.coinTossController.reset();
    this.kickoffPresentationDirector.reset();
    this.placeKickPresentationDirector.reset();
    this.placeKickMeter.hide();
    this.syncKickoffResultMessage(null);
    this.qbShowcaseCard.hide('resetPresentationIdentity');
    this.keysToGameOverlay.hide('hidden');
    this.halftimePresentationDirector.reset();
    this.resetPostgamePresentation();
    this.broadcastCaptions.hidden = true;
    this.broadcastCaptions.textContent = '';
  }

  skipPresentation(): void {
    this.cameraController.skipPresentationShot();
    this.gamePresentationRuntime.skipPresentation();
    this.pregamePresentationDirector.skip();
    this.keysToGameOverlay.hide('hidden');
    this.pregameWarmupController.setActive(false);
    this.coinTossController.reset();
    this.kickoffPresentationDirector.reset();
    this.placeKickPresentationDirector.reset();
    this.placeKickMeter.hide();
    this.syncKickoffResultMessage(null);
    this.qbShowcaseCard.hide('skipped');
    this.halftimePresentationDirector.finish();
    this.resetPostgamePresentation();
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

  updateMenuFrame({ appPhase, ball, profiler }: MenuPresentationFrameOptions): void {
    if (profiler?.enabled) {
      profiler.measure('footballVisualUpdate', () => syncBallVisual(this.ballVisual, ball));
    } else {
      syncBallVisual(this.ballVisual, ball);
    }
    this.routeArtRenderer.group.visible = false;
    this.selectedReceiverTargetIndicator.group.visible = false;
    this.controlledPlayerLabels.setApplicationPhase(appPhase);
  }

  renderStadiumPreviewFrame(): void {
    this.gameplayHud.root.hidden = true;
    this.ballVisual.visible = false;
    this.broadcastCaptions.hidden = true;
    this.routeArtRenderer.group.visible = false;
    this.selectedReceiverTargetIndicator.group.visible = false;
    this.sidelineTeamController.group.visible = false;
    this.officialsController?.group && (this.officialsController.group.visible = false);
    this.pregameWarmupController.group.visible = false;
    this.controlledPlayerLabels.setApplicationPhase('title');
    this.cameraController.updateStadiumPreview(
      new THREE.Vector3(62, 46, -116),
      new THREE.Vector3(0, 4.6, 26),
      44,
    );
  }

  updateGameplayFrame({
    active,
    ball,
    commentaryActive,
    crowdCutawaysEnabled,
    deltaSeconds,
    gameplaySnapshot,
    playerVisuals,
    preSnapCadence = null,
    profiler,
    selectedPlay,
  }: PresentationFrameOptions): void {
    const presentationEvents = this.gamePresentationRuntime.update(gameplaySnapshot, deltaSeconds, {
      active,
      commentaryActive,
      profiler,
    });
    this.gameMusicDirector.processEvents(gameplaySnapshot, presentationEvents, deltaSeconds);
    this.stadiumChantDirector.processEvents(gameplaySnapshot, presentationEvents, deltaSeconds, {
      commentary: commentaryActive ? this.broadcastCommentaryDirector.getSnapshot() : null,
      gameMusic: this.gameMusicDirector.getSnapshot(),
    });

    if (profiler?.enabled) {
      profiler.measure('footballVisualUpdate', () => syncBallVisual(this.ballVisual, ball));
    } else {
      syncBallVisual(this.ballVisual, ball);
    }
    this.routeArtRenderer.update(gameplaySnapshot, selectedPlay);
    this.selectedReceiverTargetIndicator.update(gameplaySnapshot, deltaSeconds);
    if (profiler?.enabled) {
      profiler.measure('proceduralPlayerPosing', () => {
        this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
        syncPreSnapQuarterbackHeadYaw(playerVisuals, preSnapCadence);
      });
      profiler.measure('officialsUpdate', () => {
        this.officialsController?.update(gameplaySnapshot, deltaSeconds, active);
      });
      profiler.measure('sidelineTeamsUpdate', () => {
        this.sidelineTeamController.update(presentationEvents, deltaSeconds);
      });
      profiler.measure('cameraUpdate', () => {
        this.cameraController.update(gameplaySnapshot, deltaSeconds, {
          crowdCutawaysEnabled,
          playSelectionOrbitActive: shouldRunPlaySelectionOrbit(gameplaySnapshot, preSnapCadence),
          presentationEvents,
        });
      });
    } else {
      this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
      syncPreSnapQuarterbackHeadYaw(playerVisuals, preSnapCadence);
      this.officialsController?.update(gameplaySnapshot, deltaSeconds, active);
      this.sidelineTeamController.update(presentationEvents, deltaSeconds);
      this.cameraController.update(gameplaySnapshot, deltaSeconds, {
        crowdCutawaysEnabled,
        playSelectionOrbitActive: shouldRunPlaySelectionOrbit(gameplaySnapshot, preSnapCadence),
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
        syncGameplayHud(
          this.gameplayHud,
          gameplaySnapshot,
          this.teamTheme,
          this.rosterBinding,
          preSnapCadence,
        );
        syncBroadcastCaptions(
          this.broadcastCaptions,
          this.broadcastCommentaryDirector.getSnapshot(),
        );
      });
    } else {
      syncGameplayHud(
        this.gameplayHud,
        gameplaySnapshot,
        this.teamTheme,
        this.rosterBinding,
        preSnapCadence,
      );
      syncBroadcastCaptions(
        this.broadcastCaptions,
        this.broadcastCommentaryDirector.getSnapshot(),
      );
    }
  }

  startPregamePresentation(
    gameplaySnapshot: GameplaySnapshot,
    matchSnapshot: MatchSnapshot | null,
  ): boolean {
    this.syncVoicePackSelection(matchSnapshot);
    if (this.crowdPreviewController || this.gameExperience.settings.cinematics === 'off') {
      this.pregamePresentationDirector.reset();
      this.pregameWarmupController.setActive(false);
      this.qbShowcaseCard.hide('cinematicsOff');
      this.keysToGameOverlay.hide('hidden');
      return false;
    }

    this.pregameWarmupController.setActive(true);
    this.pregameWarmupController.update();
    const started = this.pregamePresentationDirector.start(
      this.createPregameContext(gameplaySnapshot, matchSnapshot),
    );
    if (!started) {
      this.pregameWarmupController.setActive(false);
      this.qbShowcaseCard.hide('pregameNotStarted');
      this.keysToGameOverlay.hide('hidden');
    }
    return started;
  }

  updatePregameFrame({
    ball,
    deltaSeconds,
    gameplaySnapshot,
    matchSnapshot,
    playerVisuals,
    profiler,
  }: PregamePresentationFrameOptions): PregamePresentationUpdateResult {
    if (profiler?.enabled) {
      profiler.measure('footballVisualUpdate', () => syncBallVisual(this.ballVisual, ball));
      profiler.measure('proceduralPlayerPosing', () => {
        this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
      });
      this.officialsController?.group && (this.officialsController.group.visible = false);
      profiler.measure('sidelineTeamsUpdate', () => {
        this.sidelineTeamController.update();
      });
      this.pregameWarmupController.update();
    } else {
      syncBallVisual(this.ballVisual, ball);
      this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
      this.officialsController?.group && (this.officialsController.group.visible = false);
      this.sidelineTeamController.update();
      this.pregameWarmupController.update();
    }

    const context = this.createPregameContext(gameplaySnapshot, matchSnapshot);
    const result = this.pregamePresentationDirector.update(deltaSeconds, context);
    if (result.shot) {
      this.cameraController.updatePregamePresentation(result.shot, deltaSeconds);
    }
    this.qbShowcaseCard.update({
      camera: this.cameraController.camera,
      pregameSnapshot: this.pregamePresentationDirector.getSnapshot(),
      teamTheme: this.teamTheme,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      warmupSnapshot: this.pregameWarmupController.getSnapshot(),
    });
    const pregameSnapshot = this.pregamePresentationDirector.getSnapshot();
    this.keysToGameOverlay.update({
      keys: pregameSnapshot.keysToGame,
      matchSnapshot,
      pregameSnapshot,
      stadiumName: resolvePregameStadiumName(context.stadiumSnapshot.enabled),
      teamTheme: this.teamTheme,
    });
    this.syncPregameCaptions();
    return result;
  }

  finishPregamePresentation(
    gameplaySnapshot: GameplaySnapshot,
    options: { skipped?: boolean } = {},
  ): void {
    if (options.skipped) {
      this.pregamePresentationDirector.skip();
    } else {
      this.pregamePresentationDirector.complete();
    }
    this.cameraController.finishPregamePresentation(gameplaySnapshot);
    this.pregameWarmupController.setActive(false);
    this.qbShowcaseCard.hide('pregameFinished');
    this.keysToGameOverlay.hide('hidden');
    this.broadcastCaptions.hidden = true;
    this.broadcastCaptions.textContent = '';
  }

  startCoinToss(matchSnapshot: MatchSnapshot | null): void {
    this.syncVoicePackSelection(matchSnapshot);
    this.pregameWarmupController.setActive(false);
    this.qbShowcaseCard.hide('coinToss');
    this.keysToGameOverlay.hide('hidden');
    this.ballVisual.visible = false;
    this.routeArtRenderer.group.visible = false;
    this.selectedReceiverTargetIndicator.group.visible = false;
    this.controlledPlayerLabels.group.visible = false;
    this.officialsController?.group && (this.officialsController.group.visible = false);
    this.coinTossController.start(matchSnapshot);
  }

  updateCoinTossFrame({
    deltaSeconds,
    gameplaySnapshot,
    matchSnapshot,
    playerVisuals,
    profiler,
  }: CoinTossPresentationFrameOptions): CoinTossFrameResult {
    if (profiler?.enabled) {
      profiler.measure('proceduralPlayerPosing', () => {
        this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
      });
    } else {
      this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
    }
    this.officialsController?.group && (this.officialsController.group.visible = false);
    this.sidelineTeamController.update();
    const result = this.coinTossController.update({
      deltaSeconds,
      gameplaySnapshot,
      matchSnapshot,
    });
    this.cameraController.updatePregamePresentation(
      this.coinTossController.createCameraShot(),
      deltaSeconds,
    );
    this.syncPregameCaptions();
    return result;
  }

  finishCoinToss(gameplaySnapshot: GameplaySnapshot): void {
    this.coinTossController.finish();
    this.broadcastCaptions.hidden = true;
    this.broadcastCaptions.textContent = '';
    this.cameraController.finishPregamePresentation(gameplaySnapshot);
  }

  startKickoff(matchSnapshot: MatchSnapshot | null): void {
    this.syncVoicePackSelection(matchSnapshot);
    this.pregameWarmupController.setActive(false);
    this.qbShowcaseCard.hide('kickoff');
    this.coinTossController.reset();
    this.placeKickPresentationDirector.reset();
    this.placeKickMeter.hide();
    this.ballVisual.visible = false;
    this.routeArtRenderer.group.visible = false;
    this.selectedReceiverTargetIndicator.group.visible = false;
    this.controlledPlayerLabels.group.visible = false;
    this.officialsController?.group && (this.officialsController.group.visible = false);
    this.syncKickoffResultMessage(null);
    this.kickoffPresentationDirector.start(matchSnapshot);
  }

  updateKickoffFrame({
    deltaSeconds,
    gameplaySnapshot,
    matchSnapshot,
    playerVisuals,
    profiler,
  }: KickoffPresentationFrameOptions): KickoffFrameResult {
    if (profiler?.enabled) {
      profiler.measure('proceduralPlayerPosing', () => {
        this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
      });
    } else {
      this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
    }
    this.officialsController?.group && (this.officialsController.group.visible = false);
    this.sidelineTeamController.update();
    const context: KickoffPresentationContext = {
      deltaSeconds,
      gameplaySnapshot,
      matchSnapshot,
    };
    const result = this.kickoffPresentationDirector.update(context);
    this.syncKickoffResultMessage(this.kickoffPresentationDirector.getSnapshot());
    this.cameraController.updatePregamePresentation(
      this.kickoffPresentationDirector.createCameraShot(),
      deltaSeconds,
    );
    this.syncPregameCaptions();
    return result;
  }

  finishKickoff(gameplaySnapshot: GameplaySnapshot): void {
    this.kickoffPresentationDirector.finish();
    this.syncKickoffResultMessage(null);
    this.broadcastCaptions.hidden = true;
    this.broadcastCaptions.textContent = '';
    this.cameraController.finishPregamePresentation(gameplaySnapshot);
  }

  startExtraPoint(matchSnapshot: MatchSnapshot | null): void {
    this.syncVoicePackSelection(matchSnapshot);
    this.lastAutomaticPlaceKickSequenceIndex = null;
    this.pregameWarmupController.setActive(false);
    this.qbShowcaseCard.hide('extraPoint');
    this.coinTossController.reset();
    this.kickoffPresentationDirector.reset();
    this.placeKickMeter.hide();
    this.ballVisual.visible = false;
    this.routeArtRenderer.group.visible = false;
    this.selectedReceiverTargetIndicator.group.visible = false;
    this.controlledPlayerLabels.group.visible = false;
    this.officialsController?.group && (this.officialsController.group.visible = false);
    this.placeKickPresentationDirector.start(matchSnapshot);
  }

  updateExtraPointFrame({
    deltaSeconds,
    gameplaySnapshot,
    matchSnapshot,
    playerVisuals,
    profiler,
  }: PlaceKickPresentationFrameOptions): PlaceKickFrameResult {
    if (profiler?.enabled) {
      profiler.measure('proceduralPlayerPosing', () => {
        this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
      });
    } else {
      this.playerPoseController.update(gameplaySnapshot, playerVisuals, deltaSeconds);
    }
    this.officialsController?.group && (this.officialsController.group.visible = false);
    this.sidelineTeamController.update();
    const context: PlaceKickPresentationContext = {
      deltaSeconds,
      gameplaySnapshot,
      matchSnapshot,
    };
    const result = this.placeKickPresentationDirector.update(context);
    const placeKickSnapshot = this.placeKickPresentationDirector.getSnapshot();
    this.placeKickMeter.syncResult(
      matchSnapshot?.extraPoint ?? null,
      placeKickSnapshot.phase === 'result' && Boolean(placeKickSnapshot.resultMessage),
    );
    const timingInput = this.resolveAutomaticPlaceKickTimingInput(matchSnapshot);
    this.cameraController.updatePregamePresentation(
      this.placeKickPresentationDirector.createCameraShot(),
      deltaSeconds,
    );
    this.syncPregameCaptions();
    return {
      completed: result.completed,
      timingInput,
    };
  }

  finishExtraPoint(gameplaySnapshot: GameplaySnapshot): void {
    this.placeKickPresentationDirector.finish();
    this.placeKickMeter.hide();
    this.broadcastCaptions.hidden = true;
    this.broadcastCaptions.textContent = '';
    this.cameraController.finishPregamePresentation(gameplaySnapshot);
  }

  startHalftimePresentation(matchSnapshot: MatchSnapshot | null): void {
    this.syncVoicePackSelection(matchSnapshot);
    this.pregameWarmupController.setActive(false);
    this.qbShowcaseCard.hide('halftime');
    this.keysToGameOverlay.hide('hidden');
    this.coinTossController.reset();
    this.kickoffPresentationDirector.reset();
    this.placeKickPresentationDirector.reset();
    this.placeKickMeter.hide();
    this.ballVisual.visible = false;
    this.routeArtRenderer.group.visible = false;
    this.selectedReceiverTargetIndicator.group.visible = false;
    this.controlledPlayerLabels.group.visible = false;
    this.officialsController?.group && (this.officialsController.group.visible = false);
    if (matchSnapshot) {
      this.halftimePresentationDirector.start(matchSnapshot);
    }
  }

  updateHalftimeFrame({
    deltaSeconds,
    gameplaySnapshot,
    matchSnapshot,
    playerVisuals,
    profiler,
  }: HalftimePresentationFrameOptions): HalftimePresentationUpdateResult {
    if (profiler?.enabled) {
      profiler.measure('proceduralPlayerPosing', () => {
        this.playerPoseController.update(gameplaySnapshot, playerVisuals, 0);
      });
      profiler.measure('sidelineTeamsUpdate', () => {
        this.sidelineTeamController.update([], deltaSeconds);
      });
    } else {
      this.playerPoseController.update(gameplaySnapshot, playerVisuals, 0);
      this.sidelineTeamController.update([], deltaSeconds);
    }
    this.officialsController?.group && (this.officialsController.group.visible = false);
    this.ballVisual.visible = false;
    this.routeArtRenderer.group.visible = false;
    this.selectedReceiverTargetIndicator.group.visible = false;
    this.controlledPlayerLabels.group.visible = false;
    const result = this.halftimePresentationDirector.update({
      deltaSeconds,
      gameplayPlayerVisibleCount: countVisibleGroups(playerVisuals),
      matchSnapshot,
      sidelineVisibleCount: this.getVisibleSidelineCount(),
    });
    if (this.gameExperience.settings.cinematics !== 'off') {
      this.cameraController.updatePregamePresentation(
        this.halftimePresentationDirector.createCameraShot(),
        deltaSeconds,
      );
    }
    this.syncHalftimeCaptions(matchSnapshot);
    return result;
  }

  finishHalftimePresentation(gameplaySnapshot: GameplaySnapshot): void {
    this.halftimePresentationDirector.finish();
    this.broadcastCaptions.hidden = true;
    this.broadcastCaptions.textContent = '';
    this.cameraController.finishPregamePresentation(gameplaySnapshot);
  }

  updatePostgameFrame(matchSnapshot: MatchSnapshot | null): void {
    if (!matchSnapshot || matchSnapshot.phase !== 'gameOver') {
      if (this.postgameKey || this.postgameAudioHandle || this.postgameCaption) {
        this.resetPostgamePresentation();
      }
      return;
    }

    const key = createPostgameKey(matchSnapshot);
    if (this.postgameKey !== key) {
      this.startPostgameCommentary(matchSnapshot, key);
    }
    this.syncPostgameCaptions();
  }

  syncPlayCallUi(
    gameplaySnapshot: GameplaySnapshot,
    visible: boolean,
    preSnapCadence: PreSnapCadenceSnapshot | null = null,
    options: { canPunt?: boolean } = {},
  ): void {
    if (this.playCallUi && visible) {
      syncPlayCallUi(this.playCallUi, gameplaySnapshot, {
        canPunt: options.canPunt ?? false,
        selectionLocked: preSnapCadence?.playSelectionLocked ?? false,
      });
    } else {
      this.playCallUi?.hide();
    }
  }

  syncApplicationChrome(appPhase: AppPhase): void {
    document.body.dataset.appPhase = appPhase;
    this.gameplayHud.root.hidden = appPhase !== 'gameplay';
    this.controlledPlayerLabels.setApplicationPhase(appPhase);
    if (appPhase !== 'gameplay') {
      this.playCallUi?.hide();
      if (
        appPhase !== 'pregamePresentation' &&
        appPhase !== 'coinToss' &&
        appPhase !== 'kickoff' &&
        appPhase !== 'extraPoint'
      ) {
        this.broadcastCaptions.hidden = true;
        this.broadcastCaptions.textContent = '';
        this.qbShowcaseCard.hide('appPhase');
      }
    }
  }

  updateMenuMusicChrome(
    appPhase: AppPhase,
    pauseSettingsVisible: boolean,
    deltaSeconds: number,
  ): void {
    this.titleMusicController.update(deltaSeconds);
    const visible = appPhase === 'title' ||
      appPhase === 'matchSetup' ||
      pauseSettingsVisible;
    this.nowPlayingIndicator.setVisible(visible);
    this.nowPlayingIndicator.sync(this.titleMusicController.getSnapshot());
  }

  private applyOfficialsSettings(gameExperience: ResolvedGameExperienceSettings): void {
    const shouldCreateController =
      !this.crowdPreviewController &&
      (
        gameExperience.settings.officialsEnabled ||
        gameExperience.settings.officialsDebugLabels ||
        this.searchParams.get('officials') === '1' ||
        this.searchParams.get('officialsDebug') === '1' ||
        this.searchParams.get('officialsDebugLabels') === '1'
      );

    if (!shouldCreateController) {
      if (this.officialsController) {
        this.scene.remove(this.officialsController.group);
        this.officialsController.dispose();
        this.officialsController = null;
      }
      return;
    }

    if (!this.officialsController) {
      this.officialsController = new OfficialsPresentationController({
        debugLabelsEnabled: gameExperience.settings.officialsDebugLabels,
        enabled: gameExperience.settings.officialsEnabled,
      });
      this.scene.add(this.officialsController.group);
    }

    this.officialsController.applySettings({
      debugLabelsEnabled: gameExperience.settings.officialsDebugLabels,
      enabled: gameExperience.settings.officialsEnabled,
    });
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
    this.applyOfficialsSettings(gameExperience);
    this.sidelineTeamController.applySettings({
      coachesEnabled: gameExperience.settings.coachesEnabled,
      density: gameExperience.settings.sidelineDensity,
      enabled: !this.crowdPreviewController && (
        gameExperience.settings.sidelinePlayersEnabled ||
        gameExperience.settings.tunnelTableauEnabled
      ),
      playerVisualMode: gameExperience.settings.playerVisualMode,
      rosterBinding: this.rosterBinding,
      sidelinePlayersEnabled: gameExperience.settings.sidelinePlayersEnabled,
      teamTheme: this.teamTheme,
      tunnelTableauEnabled: gameExperience.settings.tunnelTableauEnabled,
    });
    this.pregameWarmupController.applySettings({
      enabled: !this.crowdPreviewController,
      playerVisualMode: gameExperience.settings.playerVisualMode,
      rosterBinding: this.rosterBinding,
      teamTheme: this.teamTheme,
    });
    this.coinTossController.applySettings({
      playerVisualMode: gameExperience.settings.playerVisualMode,
      rosterBinding: this.rosterBinding,
      teamTheme: this.teamTheme,
    });
    this.kickoffPresentationDirector.applySettings({
      playerVisualMode: gameExperience.settings.playerVisualMode,
      rosterBinding: this.rosterBinding,
      teamTheme: this.teamTheme,
    });
    this.placeKickPresentationDirector.applySettings({
      playerVisualMode: gameExperience.settings.playerVisualMode,
      rosterBinding: this.rosterBinding,
      teamTheme: this.teamTheme,
    });
    this.applyStadiumSettings();
    this.broadcastCommentaryDirector.setAnnouncerEnabled(
      gameExperience.settings.announcerEnabled,
    );
    this.broadcastCommentaryDirector.setCaptionsEnabled(
      gameExperience.settings.captionsEnabled,
    );
    this.syncVoicePackSelection(null);
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
    this.pregamePresentationDirector = this.createPregamePresentationDirector();
    this.halftimePresentationDirector.dispose();
    this.halftimePresentationDirector = this.createHalftimePresentationDirector();

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
      gameMusic: this.gameMusicDirector.getSnapshot(),
      pregame: this.pregameAudioCoordinator.getSnapshot(),
      stadiumChants: this.stadiumChantDirector.getSnapshot(),
      titleMusic: this.titleMusicController.getSnapshot(),
    };
  }

  getTitleMusicSnapshot(): MenuMusicPlaylistSnapshot {
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
    return this.officialsController?.getSnapshot() ?? createEmptyOfficialsSnapshot();
  }

  getSidelineTeamSnapshot(): SidelineTeamControllerSnapshot {
    return this.sidelineTeamController.getSnapshot();
  }

  getGamePresentationRuntimeSnapshot(): GamePresentationRuntimeSnapshot {
    return this.gamePresentationRuntime.getSnapshot();
  }

  getPregamePresentationSnapshot(): PregamePresentationSnapshot {
    return this.pregamePresentationDirector.getSnapshot();
  }

  getHalftimePresentationSnapshot(
    matchSnapshot: MatchSnapshot | null = null,
    playerVisuals: Map<string, THREE.Group> = new Map(),
  ): HalftimePresentationSnapshot {
    return this.halftimePresentationDirector.getSnapshot({
      gameplayPlayerVisibleCount: countVisibleGroups(playerVisuals),
      matchSnapshot,
      sidelineVisibleCount: this.getVisibleSidelineCount(),
    });
  }

  getCoinTossSnapshot(matchSnapshot: MatchSnapshot | null = null): CoinTossDebugSnapshot {
    return this.coinTossController.getSnapshot(matchSnapshot);
  }

  getKickoffSnapshot(): KickoffFrameSnapshot {
    return this.kickoffPresentationDirector.getSnapshot();
  }

  getPlaceKickSnapshot(): PlaceKickFrameSnapshot {
    return this.placeKickPresentationDirector.getSnapshot();
  }

  getQBShowcaseCardSnapshot(): QBShowcaseCardSnapshot {
    return this.qbShowcaseCard.getSnapshot();
  }

  getKeysToGameOverlaySnapshot(): KeysToGameOverlaySnapshot {
    return this.keysToGameOverlay.getSnapshot();
  }

  getPlayerPoseSnapshots(): PlayerPoseSnapshot[] {
    return this.playerPoseController.getPoseSnapshots();
  }

  getRouteArtSnapshot(): RouteArtRendererSnapshot {
    return this.routeArtRenderer.getSnapshot();
  }

  getSelectedReceiverTargetIndicatorSnapshot(): SelectedReceiverTargetIndicatorSnapshot {
    return this.selectedReceiverTargetIndicator.getSnapshot();
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
    this.resetPostgamePresentation();
    this.scene.remove(this.ballVisual);
    this.scene.remove(this.routeArtRenderer.group);
    this.scene.remove(this.selectedReceiverTargetIndicator.group);
    this.scene.remove(this.controlledPlayerLabels.group);
    this.routeArtRenderer.dispose();
    this.selectedReceiverTargetIndicator.dispose();
    this.controlledPlayerLabels.dispose();
    this.pregameLowerThird.dispose();
    this.keysToGameOverlay.dispose();
    this.qbShowcaseCard.dispose();
    this.nowPlayingIndicator.dispose();
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
    if (this.officialsController) {
      this.scene.remove(this.officialsController.group);
      this.officialsController.dispose();
      this.officialsController = null;
    }
    this.scene.remove(this.sidelineTeamController.group);
    this.sidelineTeamController.dispose();
    this.scene.remove(this.pregameWarmupController.group);
    this.pregameWarmupController.dispose();
    this.scene.remove(this.coinTossController.group);
    this.coinTossController.dispose();
    this.scene.remove(this.kickoffPresentationDirector.group);
    this.kickoffPresentationDirector.dispose();
    this.scene.remove(this.placeKickPresentationDirector.group);
    this.placeKickPresentationDirector.dispose();
    this.halftimePresentationDirector.dispose();
    this.placeKickMeter.dispose();
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

  private createPregamePresentationDirector(): PregamePresentationDirector {
    return new PregamePresentationDirector({
      audioCoordinator: this.pregameAudioCoordinator,
      lowerThird: this.pregameLowerThird,
      settings: {
        cinematics: this.gameExperience.settings.cinematics,
      },
    });
  }

  private createHalftimePresentationDirector(): HalftimePresentationDirector {
    return new HalftimePresentationDirector({
      audio: this.audioMixer,
      cinematics: this.gameExperience.settings.cinematics,
      gameMusicDirector: this.gameMusicDirector,
      onContinue: this.onHalftimeContinue,
      targetGameplayCamera: this.cameraController.getMode(),
      voicePackResolver: this.voicePackResolver,
    });
  }

  private createPregameContext(
    gameplaySnapshot: GameplaySnapshot,
    matchSnapshot: MatchSnapshot | null,
  ): PregamePresentationContext {
    return {
      aspectRatio: Math.max(0.1, window.innerWidth / Math.max(1, window.innerHeight)),
      gameplaySnapshot,
      matchSnapshot,
      rosterBinding: this.rosterBinding,
      sidelineSnapshot: this.sidelineTeamController.getSnapshot(),
      stadiumSnapshot: this.stadiumController.getSnapshot(),
      targetGameplayCamera: this.cameraController.getMode(),
      teamTheme: this.teamTheme,
      warmupSnapshot: this.pregameWarmupController.getSnapshot(),
      weatherCondition: resolvePregameWeatherCondition(
        this.getWeatherSnapshot().condition ??
          this.searchParams.get('pregameWeather'),
      ),
    };
  }

  private syncPregameCaptions(): void {
    const audioSnapshot = this.pregameAudioCoordinator.getSnapshot();
    const caption = audioSnapshot.activeLine?.caption ?? null;
    if (!this.gameExperience.settings.captionsEnabled || !caption) {
      this.broadcastCaptions.hidden = true;
      this.broadcastCaptions.textContent = '';
      return;
    }

    this.broadcastCaptions.hidden = false;
    this.broadcastCaptions.textContent = caption;
  }

  private syncKickoffResultMessage(snapshot: KickoffFrameSnapshot | null): void {
    const message = snapshot?.resultMessage ?? null;
    const visible =
      Boolean(message) &&
      (snapshot?.phase === 'touchback' || snapshot?.phase === 'result');

    this.gameplayHud.resultMessage.hidden = !visible;
    this.gameplayHud.resultMessage.textContent = visible ? message! : '';
  }

  private syncHalftimeCaptions(matchSnapshot: MatchSnapshot | null): void {
    const snapshot = this.getHalftimePresentationSnapshot(matchSnapshot);
    const caption = snapshot.activeLine?.caption ?? null;
    if (!this.gameExperience.settings.captionsEnabled || !caption) {
      this.broadcastCaptions.hidden = true;
      this.broadcastCaptions.textContent = '';
      return;
    }

    this.broadcastCaptions.hidden = false;
    this.broadcastCaptions.textContent = caption;
  }

  private startPostgameCommentary(matchSnapshot: MatchSnapshot, key: string): void {
    this.resetPostgamePresentation();
    this.postgameKey = key;
    this.syncVoicePackSelection(matchSnapshot);
    this.audioMixer.stopOneShotsByCategory('announcer');
    this.audioMixer.setCrowdDuckingGain(0.68);

    void this.playPostgameSequence(matchSnapshot, key)
      .catch(() => {
        if (this.postgameKey === key) {
          this.audioMixer.setCrowdDuckingGain(1);
        }
      });
  }

  private async playPostgameSequence(matchSnapshot: MatchSnapshot, key: string): Promise<void> {
    const opening = await this.resolvePostgameOpeningLine(matchSnapshot);
    const openingHandle = await this.playPostgameLine(key, opening.assetId, opening.caption);

    if (this.postgameKey !== key) {
      openingHandle?.stop(0.05);
      return;
    }

    if (openingHandle) {
      await openingHandle.ended.catch(() => undefined);
    }

    if (this.postgameKey !== key) {
      return;
    }

    const signoffHandle = await this.playPostgameLine(
      key,
      POSTGAME_SIGNOFF_CLIP.assetId,
      POSTGAME_SIGNOFF_CLIP.caption,
      POSTGAME_SIGNOFF_CLIP.durationSeconds,
    );

    if (this.postgameKey !== key) {
      signoffHandle?.stop(0.05);
      return;
    }

    if (!signoffHandle) {
      this.audioMixer.setCrowdDuckingGain(1);
      return;
    }

    await signoffHandle.ended.catch(() => undefined);
    if (this.postgameKey === key) {
      this.postgameCaptionUntilSeconds = this.audioMixer.getCurrentTime() + 0.4;
      this.audioMixer.setCrowdDuckingGain(1);
    }
  }

  private async resolvePostgameOpeningLine(
    matchSnapshot: MatchSnapshot,
  ): Promise<{ assetId: string; caption: string; durationSeconds?: number }> {
    const story = resolvePostgameStory(matchSnapshot);
    const resolved = await this.voicePackResolver.resolveClip(story.scriptId);

    if (resolved) {
      return {
        assetId: resolved.asset.assetId,
        caption: resolved.caption,
        durationSeconds: resolved.clip.durationSeconds,
      };
    }

    return selectFinalHornFallback(matchSnapshot);
  }

  private async playPostgameLine(
    key: string,
    assetId: string,
    caption: string,
    fallbackDurationSeconds = 3,
  ): Promise<AudioPlaybackHandle | null> {
    if (this.postgameKey !== key) {
      return null;
    }

    this.postgameCaption = caption;
    const handle = await this.audioMixer.playOneShotTracked(assetId);
    if (this.postgameKey !== key) {
      handle?.stop(0.05);
      return null;
    }

    this.postgameAudioHandle = handle;
    this.postgameCaptionUntilSeconds =
      (handle?.startedAt ?? this.audioMixer.getCurrentTime()) +
      (handle?.durationSeconds ?? fallbackDurationSeconds) +
      0.4;
    return handle;
  }

  private syncPostgameCaptions(): void {
    const visible =
      this.gameExperience.settings.captionsEnabled &&
      Boolean(this.postgameCaption) &&
      this.audioMixer.getCurrentTime() <= this.postgameCaptionUntilSeconds;

    this.broadcastCaptions.hidden = !visible;
    this.broadcastCaptions.textContent = visible ? this.postgameCaption! : '';
  }

  private resetPostgamePresentation(): void {
    const hadPostgameAudio = Boolean(this.postgameKey || this.postgameAudioHandle || this.postgameCaption);
    this.postgameAudioHandle?.stop(0.06);
    this.postgameAudioHandle = null;
    this.postgameCaption = null;
    this.postgameCaptionUntilSeconds = 0;
    this.postgameKey = null;
    if (hadPostgameAudio) {
      this.audioMixer.setCrowdDuckingGain(1);
    }
  }

  private getVisibleSidelineCount(): number {
    const snapshot = this.sidelineTeamController.getSnapshot();
    if (!snapshot.enabled) {
      return 0;
    }
    return snapshot.sidelinePlayerCount + snapshot.tunnelPlayerCount;
  }

  private syncVoicePackSelection(matchSnapshot: MatchSnapshot | null): void {
    this.voicePackResolver.select({
      matchSeed: matchSnapshot?.deterministicSeed ?? 'menu',
      opponentTeamId: matchSnapshot?.opponentTeam.id ?? this.teamTheme.defense.profile.id,
      setting: this.gameExperience.settings.announcerVoice,
      userTeamId: matchSnapshot?.userTeam.id ?? this.teamTheme.offense.profile.id,
    });
  }

  private applyStadiumSettings(): void {
    this.stadiumController.applySettings({
      enabled: !this.crowdPreviewController && this.gameExperience.settings.stadiumEnabled,
      imageMaterialsEnabled: shouldUseStadiumImageMaterials(
        this.gameExperience,
        this.qualityProfile,
      ),
      themeId: this.resolveStadiumThemeId(),
      upperTierEnabled: shouldUseStadiumUpperTier(this.gameExperience, this.qualityProfile),
    });
  }

  private resolveStadiumThemeId(): StadiumThemeId {
    return resolveStadiumThemeId(
      this.searchParams.get('stadiumTheme') ??
        (this.gameExperience.settings.mountainBowlEnabled ? 'mountainBowl' : null),
    );
  }

  private resolveAutomaticPlaceKickTimingInput(
    matchSnapshot: MatchSnapshot | null,
  ): PlaceKickTimingInput | null {
    const extraPoint = matchSnapshot?.extraPoint ?? null;
    const presentation = this.placeKickPresentationDirector.getSnapshot();
    if (
      matchSnapshot?.phase !== 'extraPoint' ||
      !extraPoint ||
      extraPoint.result ||
      extraPoint.completed ||
      presentation.phase !== 'meter' ||
      this.lastAutomaticPlaceKickSequenceIndex === extraPoint.sequenceIndex
    ) {
      return null;
    }

    this.lastAutomaticPlaceKickSequenceIndex = extraPoint.sequenceIndex;
    return {
      confirmedAtSeconds: presentation.animationProgress,
      normalizedValue: 0,
    };
  }
}

function shouldRunPlaySelectionOrbit(
  gameplaySnapshot: GameplaySnapshot,
  preSnapCadence: PreSnapCadenceSnapshot | null,
): boolean {
  return gameplaySnapshot.playState === 'preSnap' &&
    preSnapCadence !== null &&
    preSnapCadence.playSelectedForSnap === false;
}

function createPostgameKey(match: MatchSnapshot): string {
  return [
    match.deterministicSeed,
    match.userTeam.id,
    match.opponentTeam.id,
    match.userScore,
    match.opponentScore,
    match.driveSummaries.length,
    match.stats.processedEventCount,
  ].join(':');
}

function selectFinalHornFallback(match: MatchSnapshot): { assetId: string; caption: string } {
  const assetId = Math.abs(match.deterministicSeed + match.userScore - match.opponentScore) % 2 === 0
    ? 'ann_challenge_ending_01'
    : 'ann_challenge_ending_02';
  const caption = COMMENTARY_CATALOG.find((clip) => clip.assetId === assetId)?.caption ??
    'That is the horn. Final score is on the board.';
  return { assetId, caption };
}

function areCrowdSettingsEqual(
  a: CrowdPresentationSettings,
  b: CrowdPresentationSettings,
): boolean {
  return a.crowdDensity === b.crowdDensity &&
    a.crowdFullness === b.crowdFullness &&
    a.crowdReactionsEnabled === b.crowdReactionsEnabled &&
    a.crowdVisualsEnabled === b.crowdVisualsEnabled;
}

function countVisibleGroups(groups: Map<string, THREE.Group>): number {
  let count = 0;
  for (const group of groups.values()) {
    if (group.visible) {
      count += 1;
    }
  }
  return count;
}

function createEmptyOfficialsSnapshot(): OfficialsPresentationSnapshot {
  return {
    debugLabelsEnabled: false,
    enabled: false,
    officials: [],
    targetUpdateHz: 0,
    visibleOfficialCount: 0,
    visualMetrics: {
      geometryCount: 0,
      materialCount: 0,
      meshCount: 0,
      triangleCount: 0,
    },
  };
}

function resolveEffectiveCrowdSettings(
  base: CrowdPresentationSettings,
  quality: QualityProfileSnapshot,
): CrowdPresentationSettings {
  return {
    crowdDensity: minCrowdDensity(base.crowdDensity, quality.crowdDensity),
    crowdFullness: base.crowdFullness,
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

function resolvePregameStadiumName(enabled: boolean): string {
  return enabled ? 'Football JS Stadium' : 'Practice Field';
}

function resolvePregameWeatherCondition(value: string | null | undefined): PregameWeatherCondition {
  if (
    value === 'clear' ||
    value === 'overcast' ||
    value === 'rain' ||
    value === 'snow' ||
    value === 'windy'
  ) {
    return value;
  }

  return 'clear';
}
