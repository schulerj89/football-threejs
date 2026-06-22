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
import {
  createOfficialVisualResources,
  syncOfficialVisualResources,
  type OfficialVisualResources,
} from '../../officials/OfficialVisualFactory';
import {
  createSidelineVisualResources,
  syncSidelineVisualResources,
  type SidelineVisualResources,
} from '../teams/SidelineVisualFactory';
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
  CoinTossPresentationLayout,
  CoinTossPresentationPhase,
} from './CoinTossTypes';

export interface CoinTossControllerOptions {
  audioCoordinator: PregameAudioCoordinator;
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
  private requestedResultLine = false;
  private requestedSetupLine = false;
  private selectedCall: CoinFace = 'heads';
  private sidelineVisuals: SidelineVisualResources | null = null;
  private officialVisuals: OfficialVisualResources | null = null;
  private readonly ui = new CoinTossUi();

  constructor(private options: CoinTossControllerOptions) {
    this.group.name = 'coin-toss-presentation-root';
    this.group.userData.coinTossPresentation = true;
    this.layout = createCoinTossLayout(options.rosterBinding);
    this.coin = createCoinVisualResources();
    this.coin.group.visible = false;
    this.ui.setVisible(false);
  }

  applySettings(options: Pick<CoinTossControllerOptions, 'rosterBinding' | 'teamTheme'>): void {
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
      captainsVisible: this.group.visible ? this.layout.captainPlacements.length : 0,
      completionBlockers: blockers,
      matchSeed: matchSnapshot?.deterministicSeed ?? null,
      openingPossession: matchSnapshot?.coinToss.firstHalfOpeningPossession ?? null,
      phase: this.phase,
      refereeVisible: this.group.visible && this.layout.officials.length > 0,
      resolvedFace: matchSnapshot?.coinToss.resolvedFace ?? null,
      secondHalfPossession: matchSnapshot?.coinToss.secondHalfOpeningPossession ?? null,
      selectedCall: this.selectedCall,
      userCall: matchSnapshot?.coinToss.userCall ?? null,
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
    if (!this.sidelineVisuals || !this.officialVisuals) {
      return;
    }

    syncSidelineVisualResources(
      { meshes: this.sidelineVisuals.meshes },
      this.layout.captainPlacements,
      this.options.teamTheme,
    );
    syncOfficialVisualResources(
      { meshes: this.officialVisuals.meshes },
      this.layout.officials,
    );
    this.coin.group.position.set(
      this.layout.coinPosition.x,
      this.layout.coinPosition.y,
      this.layout.coinPosition.z,
    );
  }

  private ensureVisualResources(): void {
    if (!this.sidelineVisuals) {
      this.sidelineVisuals = createSidelineVisualResources(
        this.layout.captainPlacements,
        this.options.teamTheme,
      );
      this.group.add(this.sidelineVisuals.group);
    }
    if (!this.officialVisuals) {
      this.officialVisuals = createOfficialVisualResources(this.layout.officials);
      this.group.add(this.officialVisuals.group);
    }
    if (!this.coin.group.parent) {
      this.group.add(this.coin.group);
    }
    this.coin.group.visible = true;
    this.syncLayoutResources();
  }

  private disposeVisualResources(): void {
    if (this.sidelineVisuals) {
      this.group.remove(this.sidelineVisuals.group);
      this.sidelineVisuals.dispose();
      this.sidelineVisuals = null;
    }
    if (this.officialVisuals) {
      this.group.remove(this.officialVisuals.group);
      this.officialVisuals.dispose();
      this.officialVisuals = null;
    }
    if (this.coin.group.parent === this.group) {
      this.group.remove(this.coin.group);
    }
    this.coin.group.visible = false;
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

    this.animationElapsedSeconds = Math.min(
      getCoinAnimationDurationSeconds(),
      this.animationElapsedSeconds + deltaSeconds,
    );
    const pose = calculateCoinAnimationPose(face, this.animationElapsedSeconds);
    this.coin.group.position.y = pose.positionY;
    this.coin.mesh.rotation.set(pose.rotationX, 0, pose.rotationZ);
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
}
