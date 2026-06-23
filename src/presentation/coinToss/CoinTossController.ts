import * as THREE from 'three';
import type { PresentationCameraShot } from '../../camera/PresentationShotDefinitions';
import { resolveCoinTossFace, type CoinFace } from '../../match/CoinTossModel';
import type { MatchSnapshot } from '../../match/MatchTypes';
import type { PregameAudioCoordinator } from '../pregame/PregameAudioCoordinator';
import {
  resolveCoinTossResult,
  resolveCoinTossSetup,
} from '../../audio/PregameCommentaryCatalog';
import type { GameplayRosterBinding } from '../../roster/GameplayRosterBinding';
import type { TeamPresentationTheme } from '../../teams/TeamThemeApplier';
import type { PlayerVisualMode } from '../players/PlayerVisualMode';
import {
  FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  createFootballPlayerVisual,
  type FootballPlayerVisualFactoryOptions,
  type FootballPlayerVisualResources,
} from '../players/FootballPlayerVisualFactory';
import {
  calculateCoinAnimationPose,
  createCoinVisualResources,
  disposeSharedCoinVisualResources,
  getCoinAnimationDurationSeconds,
  type CoinVisualResources,
} from './CoinTossVisualFactory';
import { createCoinTossLayout, validateCoinTossLayout } from './CoinTossLayout';
import { CoinTossUi } from './CoinTossUi';
import type {
  CoinTossControllerContext,
  CoinTossDebugSnapshot,
  CoinTossFrameResult,
  CoinTossCaptainPlacement,
  CoinTossPresentationLayout,
  CoinTossPresentationPhase,
} from './CoinTossTypes';

export interface CoinTossControllerOptions {
  audioCoordinator: PregameAudioCoordinator;
  coinAudio?: {
    playOneShot(assetId: string): Promise<boolean> | boolean;
  };
  footballPlayerVisual?: Pick<
    FootballPlayerVisualFactoryOptions,
    'attachHelmet' | 'helmet' | 'playerVisualOptions'
  >;
  playerVisualMode?: PlayerVisualMode;
  rosterBinding: GameplayRosterBinding;
  teamTheme: TeamPresentationTheme;
  warn?: (message: string) => void;
}

const COIN_TOSS_CAMERA_CONFIG = {
  fieldOfView: 38,
  lookHeight: 1.3,
  maximumDeltaSeconds: 1 / 15,
  pushInDistance: 1.1,
  shotHeight: 8.4,
  shotZ: -12.5,
} as const;

export class CoinTossController {
  readonly group = new THREE.Group();
  private animationElapsedSeconds = 0;
  private coin: CoinVisualResources;
  private completed = false;
  private layout: CoinTossPresentationLayout;
  private phase: CoinTossPresentationPhase = 'idle';
  private playedLandingSound = false;
  private playedSpinSound = false;
  private requestedResultLine = false;
  private requestedSetupLine = false;
  private selectedCall: CoinFace = 'heads';
  private readonly captainVisuals = new Map<string, FootballPlayerVisualResources>();
  private readonly ui = new CoinTossUi();

  constructor(private options: CoinTossControllerOptions) {
    this.group.name = 'coin-toss-presentation-root';
    this.group.userData.coinTossPresentation = true;
    this.group.visible = false;
    this.layout = createCoinTossLayout(options.rosterBinding);
    this.coin = createCoinVisualResources();
    this.coin.group.visible = false;
    this.ui.setVisible(false);
  }

  applySettings(options: Pick<CoinTossControllerOptions, 'playerVisualMode' | 'rosterBinding' | 'teamTheme'>): void {
    this.options = {
      ...this.options,
      ...options,
    };
    this.rebuildLayout();
  }

  start(matchSnapshot: MatchSnapshot | null): void {
    this.completed = false;
    this.animationElapsedSeconds = 0;
    this.phase = 'awaitingCall';
    this.playedLandingSound = false;
    this.playedSpinSound = false;
    this.requestedResultLine = false;
    this.requestedSetupLine = false;
    this.selectedCall = 'heads';
    this.group.visible = true;
    this.ensureVisualResources();
    this.ui.reset();
    this.ui.setVisible(true);
    this.startSetupLine(matchSnapshot);
  }

  update(context: CoinTossControllerContext): CoinTossFrameResult {
    if (this.phase === 'idle') {
      return { completed: false, requestedCall: null };
    }

    const delta = Math.min(
      Math.max(0, context.deltaSeconds),
      COIN_TOSS_CAMERA_CONFIG.maximumDeltaSeconds,
    );
    this.options.audioCoordinator.updateAmbience(context.gameplaySnapshot, delta);
    this.ui.sync(context.matchSnapshot);
    const uiSnapshot = this.ui.getSnapshot();
    this.selectedCall = context.matchSnapshot?.coinToss.userCall ?? uiSnapshot.selectedCall;

    const requestedCall = context.matchSnapshot?.coinToss.userCall
      ? null
      : this.ui.consumeConfirmedCall();

    this.updatePhaseFromMatch(context.matchSnapshot);
    this.updateCoinPose(context.matchSnapshot, delta);
    this.updateResultLine(context.matchSnapshot);

    return {
      completed: this.completed,
      requestedCall,
    };
  }

  createCameraShot(): PresentationCameraShot {
    const progress = this.phase === 'idle' ? 0 : Math.min(1, this.animationElapsedSeconds / 3.5);
    const pushIn = COIN_TOSS_CAMERA_CONFIG.pushInDistance * progress;
    const focus = new THREE.Vector3(0, COIN_TOSS_CAMERA_CONFIG.lookHeight, 0);
    const position = new THREE.Vector3(
      0,
      COIN_TOSS_CAMERA_CONFIG.shotHeight,
      COIN_TOSS_CAMERA_CONFIG.shotZ + pushIn,
    );

    return {
      activeShotName: null,
      fieldOfView: COIN_TOSS_CAMERA_CONFIG.fieldOfView,
      focus,
      lookTarget: focus.clone(),
      orbitCenter: null,
      orbitRadius: null,
      phase: 'preSnapEstablish',
      position,
      restoreCamera: 'coinToss',
      shotProgress: progress,
    };
  }

  finish(): void {
    this.phase = 'completed';
    this.completed = true;
    this.group.visible = false;
    this.disposeVisualResources();
    this.ui.setVisible(false);
  }

  reset(): void {
    this.animationElapsedSeconds = 0;
    this.completed = false;
    this.phase = 'idle';
    this.playedLandingSound = false;
    this.playedSpinSound = false;
    this.requestedResultLine = false;
    this.requestedSetupLine = false;
    this.selectedCall = 'heads';
    this.group.visible = false;
    this.disposeVisualResources();
    this.ui.reset();
    this.ui.setVisible(false);
  }

  getSnapshot(matchSnapshot: MatchSnapshot | null = null): CoinTossDebugSnapshot {
    const audioSnapshot = this.options.audioCoordinator.getSnapshot();
    const animation = this.createAnimationSnapshot(matchSnapshot);
    const blockers: string[] = [];

    if (!matchSnapshot?.coinToss.userCall) {
      blockers.push('playerSelection');
    }
    if (
      matchSnapshot?.coinToss.userCall &&
      !this.options.audioCoordinator.isLineComplete('coinTossResult')
    ) {
      blockers.push('commentary:coinTossResult');
    }

    return {
      activeCommentary: audioSnapshot.activeLine?.lineId ?? null,
      animation,
      callLocked: Boolean(matchSnapshot?.coinToss.userCall),
      captainRosterIds: this.layout.captains.map((captain) => captain.rosterPlayerId),
      captainVisualCount: this.captainVisuals.size,
      captainsVisible: this.countVisibleCaptains(),
      completionBlockers: blockers,
      coinVisible: this.coin.group.visible,
      gameplayPlayersVisible: false,
      bareHeadCount: this.countBareHeadCaptains(),
      helmetReadyCount: this.countHelmetReadyCaptains(),
      matchSeed: matchSnapshot?.deterministicSeed ?? null,
      nextStage: this.completed ? 'kickoff' : null,
      openingPossession: matchSnapshot?.coinToss.firstHalfOpeningPossession ?? null,
      phase: this.phase,
      refereeVisible: false,
      officialsVisibleCount: 0,
      resolvedFace: matchSnapshot?.coinToss.resolvedFace ?? null,
      secondHalfPossession: matchSnapshot?.coinToss.secondHalfOpeningPossession ?? null,
      selectedCall: this.selectedCall,
      stageId: this.phase === 'idle' ? 'none' : 'coinToss',
      userCall: matchSnapshot?.coinToss.userCall ?? null,
      visualProfileCount: this.countProfileCaptains(),
      visualProfileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
      winner: matchSnapshot?.coinToss.winner ?? null,
    };
  }

  dispose(): void {
    this.group.clear();
    this.disposeVisualResources();
    this.coin.dispose();
    this.ui.dispose();
    disposeSharedCoinVisualResources();
  }

  private rebuildLayout(): void {
    this.layout = createCoinTossLayout(this.options.rosterBinding);
    const issues = validateCoinTossLayout(this.layout);
    if (issues.length > 0) {
      this.options.warn?.(`Coin toss layout issues: ${issues.join('; ')}`);
    }

    this.disposeVisualResources();
    if (this.group.visible) {
      this.ensureVisualResources();
    }
  }

  private syncLayoutResources(): void {
    for (const placement of this.layout.captainPlacements) {
      const resource = this.captainVisuals.get(placement.id);
      if (!resource) {
        continue;
      }
      this.syncCaptainVisual(placement, resource);
    }
    this.coin.group.position.set(
      this.layout.coinPosition.x,
      this.layout.coinPosition.y,
      this.layout.coinPosition.z,
    );
  }

  private ensureVisualResources(): void {
    for (const placement of this.layout.captainPlacements) {
      if (this.captainVisuals.has(placement.id)) {
        continue;
      }
      const resource = this.createCaptainVisual(placement);
      this.captainVisuals.set(placement.id, resource);
      this.group.add(resource.root);
      void resource.ready
        .then(() => {
          if (this.captainVisuals.get(placement.id) === resource) {
            this.syncCaptainVisual(placement, resource);
          }
        })
        .catch(() => {
          if (this.captainVisuals.get(placement.id) === resource) {
            this.syncCaptainVisual(placement, resource);
          }
        });
    }
    if (!this.coin.group.parent) {
      this.group.add(this.coin.group);
    }
    this.coin.group.visible = true;
    this.syncLayoutResources();
  }

  private disposeVisualResources(): void {
    for (const resource of this.captainVisuals.values()) {
      resource.dispose();
    }
    this.captainVisuals.clear();
    if (this.coin.group.parent === this.group) {
      this.group.remove(this.coin.group);
    }
    this.coin.group.visible = false;
  }

  private createCaptainVisual(
    placement: CoinTossCaptainPlacement,
  ): FootballPlayerVisualResources {
    const resource = createFootballPlayerVisual(
      {
        appearanceId: placement.appearanceId,
        footballPosition: placement.footballPosition,
        gameplayPlayerId: placement.gameplayPlayerId ?? undefined,
        gameplayTeam: placement.gameplayTeam,
        presentationOnly: true,
        role: placement.role,
        jerseyNumber: placement.jerseyNumber,
        rosterPlayerId: placement.rosterPlayerId,
        teamSide: placement.team,
        uniform: this.options.teamTheme.uniforms[placement.gameplayTeam],
        visualId: placement.visualId,
      },
      {
        attachHelmet: this.options.footballPlayerVisual?.attachHelmet,
        helmet: this.options.footballPlayerVisual?.helmet ?? 'required',
        playerVisualOptions: {
          ...this.options.footballPlayerVisual?.playerVisualOptions,
          visualMode: this.options.playerVisualMode ?? 'procedural',
        },
        teamUniforms: this.options.teamTheme.uniforms,
      },
    );
    resource.root.name = placement.id;
    resource.root.userData.coinTossPresentation = true;
    resource.root.userData.coinTossCaptain = true;
    return resource;
  }

  private syncCaptainVisual(
    placement: CoinTossCaptainPlacement,
    resource: FootballPlayerVisualResources,
  ): void {
    resource.syncTransform(placement.position, placement.facingRadians);
    resource.syncUniform(
      this.options.teamTheme.uniforms[placement.gameplayTeam],
      this.options.teamTheme.uniforms,
    );
    resource.setPose(placement.gameplayTeam === 'offense' ? 'readyOffense' : 'readyDefense');
    resource.root.scale.setScalar(placement.scale);
    resource.setVisible(this.group.visible && resource.getReadiness().subjectReady);
  }

  private countHelmetReadyCaptains(): number {
    let count = 0;
    for (const resource of this.captainVisuals.values()) {
      if (resource.getReadiness().helmetReady) {
        count += 1;
      }
    }
    return count;
  }

  private countVisibleCaptains(): number {
    let count = 0;
    for (const resource of this.captainVisuals.values()) {
      if (resource.root.visible) {
        count += 1;
      }
    }
    return count;
  }

  private countProfileCaptains(): number {
    let count = 0;
    for (const resource of this.captainVisuals.values()) {
      if (resource.root.userData.visualProfileId === FOOTBALL_PLAYER_VISUAL_PROFILE_ID) {
        count += 1;
      }
    }
    return count;
  }

  private countBareHeadCaptains(): number {
    let count = 0;
    for (const resource of this.captainVisuals.values()) {
      if (resource.root.visible && !resource.getReadiness().helmetReady) {
        count += 1;
      }
    }
    return count;
  }

  private startSetupLine(matchSnapshot: MatchSnapshot | null): void {
    if (this.requestedSetupLine) {
      return;
    }

    this.requestedSetupLine = true;
    this.options.audioCoordinator.startLine(
      'coinTossSetup',
      resolveCoinTossSetup({
        matchSeed: matchSnapshot?.deterministicSeed ?? 'coinToss',
      }),
    );
  }

  private updatePhaseFromMatch(matchSnapshot: MatchSnapshot | null): void {
    const coinToss = matchSnapshot?.coinToss;

    if (!coinToss?.userCall) {
      this.phase = 'awaitingCall';
      return;
    }

    if (coinToss.resolvedFace && this.animationElapsedSeconds < getCoinAnimationDurationSeconds()) {
      this.phase = 'animating';
      return;
    }

    if (coinToss.resolvedFace && !this.completed) {
      this.phase = 'result';
    }
  }

  private updateCoinPose(matchSnapshot: MatchSnapshot | null, deltaSeconds: number): void {
    const coinToss = matchSnapshot?.coinToss;
    const face = coinToss?.resolvedFace;

    if (!face) {
      this.coin.group.position.y = this.layout.coinPosition.y;
      this.coin.mesh.rotation.set(0, 0, Math.PI / 12);
      return;
    }

    if (!this.playedSpinSound) {
      this.playedSpinSound = true;
      this.playCoinOneShot('coin_toss_spin_01');
    }

    const previousElapsedSeconds = this.animationElapsedSeconds;
    this.animationElapsedSeconds = Math.min(
      getCoinAnimationDurationSeconds(),
      this.animationElapsedSeconds + deltaSeconds,
    );
    const pose = calculateCoinAnimationPose(face, this.animationElapsedSeconds);
    this.coin.group.position.y = pose.positionY;
    this.coin.mesh.rotation.set(pose.rotationX, 0, pose.rotationZ);

    if (
      !this.playedLandingSound &&
      previousElapsedSeconds < getCoinAnimationDurationSeconds() &&
      this.animationElapsedSeconds >= getCoinAnimationDurationSeconds()
    ) {
      this.playedLandingSound = true;
      this.playCoinOneShot('coin_toss_land_01');
    }
  }

  private updateResultLine(matchSnapshot: MatchSnapshot | null): void {
    if (!matchSnapshot) {
      return;
    }

    const coinToss = matchSnapshot?.coinToss;
    if (
      !coinToss?.resolvedFace ||
      !coinToss.winner ||
      this.animationElapsedSeconds < getCoinAnimationDurationSeconds()
    ) {
      return;
    }

    if (!this.requestedResultLine) {
      const winnerTeam = coinToss.winner === 'user'
        ? matchSnapshot.userTeam
        : matchSnapshot.opponentTeam;
      this.requestedResultLine = true;
      this.options.audioCoordinator.startLine(
        'coinTossResult',
        resolveCoinTossResult({
          matchSeed: matchSnapshot.deterministicSeed,
          outcome: 'receive',
          teamId: winnerTeam.id,
        }),
      );
    }

    if (this.options.audioCoordinator.isLineComplete('coinTossResult')) {
      this.completed = true;
      this.phase = 'completed';
    }
  }

  private createAnimationSnapshot(matchSnapshot: MatchSnapshot | null) {
    const face = matchSnapshot?.coinToss.resolvedFace ??
      resolveCoinTossFace(matchSnapshot?.deterministicSeed ?? 0, 0);
    const pose = calculateCoinAnimationPose(face, this.animationElapsedSeconds);

    return {
      finalRotationX: matchSnapshot?.coinToss.resolvedFace ? pose.finalRotationX : null,
      progress: matchSnapshot?.coinToss.resolvedFace ? pose.progress : 0,
      y: this.coin.group.position.y,
    };
  }

  private playCoinOneShot(assetId: string): void {
    try {
      void this.options.coinAudio?.playOneShot(assetId);
    } catch {
      // Missing or locked audio is optional for coin-toss presentation.
    }
  }
}
