import * as THREE from 'three';
import {
  createBallModel,
  type BallModel,
} from '../ballModel';
import {
  createBallVisual,
  syncBallVisual,
  type BallVisualStyle,
} from '../ballVisual';
import type { PresentationCameraShot } from '../camera/PresentationShotDefinitions';
import {
  resolveKickoffInFlight,
  resolveKickoffReady,
  resolveKickoffResult,
} from '../audio/PregameCommentaryCatalog';
import type { GameplayRosterBinding } from '../roster/GameplayRosterBinding';
import type { TeamPresentationTheme } from '../teams/TeamThemeApplier';
import { createKickLandingReticle } from '../presentation/KickLandingReticle';
import {
  createSidelineVisualResources,
  syncSidelineVisualResources,
  type SidelineVisualResources,
} from '../presentation/teams/SidelineVisualFactory';
import type { PregameAudioCoordinator } from '../presentation/pregame/PregameAudioCoordinator';
import {
  classifyKickoffCommentaryResult,
  sampleKickoffBallPosition,
} from './KickoffSimulation';
import {
  createKickoffFormation,
  validateKickoffFormation,
} from './KickoffFormation';
import type {
  KickoffFrameResult,
  KickoffFrameSnapshot,
  KickoffPresentationContext,
  KickoffPresentationPhase,
  KickoffResult,
  KickoffState,
} from './KickoffTypes';

export interface KickoffPresentationDirectorOptions {
  audioCoordinator: PregameAudioCoordinator;
  ballVisualStyle: BallVisualStyle;
  rosterBinding: GameplayRosterBinding;
  teamTheme: TeamPresentationTheme;
  warn?: (message: string) => void;
}

const KICKOFF_PRESENTATION_CONFIG = {
  fieldOfView: 42,
  flightCameraDistanceBehind: 18,
  flightCameraHeight: 10.5,
  flightLookAhead: 8,
  maximumDeltaSeconds: 1 / 15,
  minimumReadySeconds: 0.85,
  minimumResultSeconds: 1.1,
  readyCameraDistanceBehind: 22,
  readyCameraHeight: 12,
  resultCameraDistanceBehind: 15,
  resultCameraHeight: 8.5,
  sidelineCameraOffset: 8,
} as const;

export class KickoffPresentationDirector {
  readonly group = new THREE.Group();

  private readonly ballModel: BallModel;
  private readonly ballVisual: THREE.Group;
  private readonly reticle = createKickLandingReticle();
  private completed = false;
  private flightElapsedSeconds = 0;
  private phase: KickoffPresentationPhase = 'idle';
  private readyElapsedSeconds = 0;
  private requestedInFlightLine = false;
  private requestedReadyLine = false;
  private requestedResultLine = false;
  private resultElapsedSeconds = 0;
  private kickoffState: KickoffState | null = null;
  private sidelineVisuals: SidelineVisualResources | null = null;

  constructor(private options: KickoffPresentationDirectorOptions) {
    this.group.name = 'kickoff-presentation-root';
    this.group.userData.kickoffPresentation = true;
    this.group.visible = false;
    this.ballModel = createBallModel({ x: 0, z: -15 });
    this.ballVisual = createBallVisual({ style: options.ballVisualStyle });
    this.group.add(this.ballVisual, this.reticle.group);
  }

  applySettings(options: Pick<KickoffPresentationDirectorOptions, 'rosterBinding' | 'teamTheme'>): void {
    this.options = {
      ...this.options,
      ...options,
    };
    this.rebuildVisuals();
  }

  start(matchSnapshot: { deterministicSeed: number; kickoff: KickoffState } | null): void {
    const kickoff = matchSnapshot?.kickoff ?? null;
    if (!kickoff?.result || !kickoff.kickingTeam || !kickoff.receivingTeam) {
      this.reset();
      return;
    }

    this.kickoffState = cloneKickoffStateForPresentation(kickoff);
    this.completed = false;
    this.flightElapsedSeconds = 0;
    this.phase = 'ready';
    this.readyElapsedSeconds = 0;
    this.requestedInFlightLine = false;
    this.requestedReadyLine = false;
    this.requestedResultLine = false;
    this.resultElapsedSeconds = 0;
    this.group.visible = true;
    this.syncBallToKickoff(0);
    this.reticle.sync(kickoff.result, false);
    this.rebuildVisuals();
    this.options.audioCoordinator.reset();
    this.startReadyLine(matchSnapshot?.deterministicSeed ?? 'kickoff');
  }

  update(context: KickoffPresentationContext): KickoffFrameResult {
    if (this.phase === 'idle' || !this.kickoffState?.result) {
      return { completed: false };
    }

    const delta = Math.min(
      Math.max(0, context.deltaSeconds),
      KICKOFF_PRESENTATION_CONFIG.maximumDeltaSeconds,
    );
    this.options.audioCoordinator.updateAmbience(context.gameplaySnapshot, delta);

    if (this.phase === 'ready') {
      this.readyElapsedSeconds += delta;
      this.syncBallToKickoff(0);
      this.reticle.sync(this.kickoffState.result, false);
      if (
        this.readyElapsedSeconds >= KICKOFF_PRESENTATION_CONFIG.minimumReadySeconds &&
        this.options.audioCoordinator.isLineComplete('kickoffReady')
      ) {
        this.phase = 'flight';
        this.startInFlightLine(context.matchSnapshot?.deterministicSeed ?? 'kickoff');
      }
    } else if (this.phase === 'flight') {
      this.flightElapsedSeconds = Math.min(
        this.kickoffState.result.flightSeconds,
        this.flightElapsedSeconds + delta,
      );
      this.syncBallToKickoff(this.flightElapsedSeconds);
      this.reticle.sync(this.kickoffState.result, true);
      if (this.flightElapsedSeconds >= this.kickoffState.result.flightSeconds) {
        this.phase = 'result';
        this.resultElapsedSeconds = 0;
        this.reticle.sync(this.kickoffState.result, false);
        this.startResultLine(context.matchSnapshot?.deterministicSeed ?? 'kickoff');
      }
    } else if (this.phase === 'result') {
      this.resultElapsedSeconds += delta;
      this.syncBallToKickoff(this.kickoffState.result.flightSeconds);
      this.reticle.sync(this.kickoffState.result, false);
      if (
        this.resultElapsedSeconds >= KICKOFF_PRESENTATION_CONFIG.minimumResultSeconds &&
        this.options.audioCoordinator.isLineComplete('kickoffResult')
      ) {
        this.completed = true;
        this.phase = 'completed';
      }
    }

    return { completed: this.completed };
  }

  createCameraShot(): PresentationCameraShot {
    const result = this.kickoffState?.result ?? null;
    const direction = this.kickoffState?.direction ?? 1;
    const focus = result
      ? this.createFocusForPhase(result)
      : new THREE.Vector3(0, 1.4, 0);
    const sidelineOffset = KICKOFF_PRESENTATION_CONFIG.sidelineCameraOffset;
    const distanceBehind = this.phase === 'result'
      ? KICKOFF_PRESENTATION_CONFIG.resultCameraDistanceBehind
      : this.phase === 'flight'
        ? KICKOFF_PRESENTATION_CONFIG.flightCameraDistanceBehind
        : KICKOFF_PRESENTATION_CONFIG.readyCameraDistanceBehind;
    const height = this.phase === 'result'
      ? KICKOFF_PRESENTATION_CONFIG.resultCameraHeight
      : this.phase === 'flight'
        ? KICKOFF_PRESENTATION_CONFIG.flightCameraHeight
        : KICKOFF_PRESENTATION_CONFIG.readyCameraHeight;
    const position = new THREE.Vector3(
      focus.x - sidelineOffset,
      height,
      focus.z - direction * distanceBehind,
    );
    const lookAhead = this.phase === 'flight'
      ? KICKOFF_PRESENTATION_CONFIG.flightLookAhead
      : 0;
    const lookTarget = new THREE.Vector3(
      focus.x,
      focus.y,
      focus.z + direction * lookAhead,
    );

    return {
      activeShotName: null,
      fieldOfView: KICKOFF_PRESENTATION_CONFIG.fieldOfView,
      focus,
      lookTarget,
      orbitCenter: null,
      orbitRadius: null,
      phase: this.phase === 'flight' ? 'passFlight' : 'preSnapEstablish',
      position,
      restoreCamera: 'kickoff',
      shotProgress: this.getAnimationProgress(),
    };
  }

  finish(): void {
    this.phase = 'completed';
    this.completed = true;
    this.group.visible = false;
    this.reticle.sync(null, false);
    this.disposeVisualResources();
    this.options.audioCoordinator.fadeTitleMusicToGameplay(1.2);
  }

  reset(): void {
    this.completed = false;
    this.flightElapsedSeconds = 0;
    this.kickoffState = null;
    this.phase = 'idle';
    this.readyElapsedSeconds = 0;
    this.requestedInFlightLine = false;
    this.requestedReadyLine = false;
    this.requestedResultLine = false;
    this.resultElapsedSeconds = 0;
    this.group.visible = false;
    this.ballVisual.visible = false;
    this.reticle.sync(null, false);
    this.disposeVisualResources();
  }

  getSnapshot(): KickoffFrameSnapshot {
    const audioSnapshot = this.options.audioCoordinator.getSnapshot();
    const result = this.kickoffState?.result ?? null;
    return {
      activeCommentary: audioSnapshot.activeLine?.lineId ?? null,
      animationProgress: this.getAnimationProgress(),
      ballPosition: this.ballVisual.visible
        ? { ...this.ballModel.position }
        : null,
      completed: this.completed,
      direction: this.kickoffState?.direction ?? null,
      kickerRosterId: this.kickoffState?.kickerRosterId ?? null,
      kickingTeam: this.kickoffState?.kickingTeam ?? null,
      landingType: result?.landingType ?? null,
      phase: this.phase,
      receivingStartSpot: result ? { ...result.receivingStartSpot } : null,
      receivingTeam: this.kickoffState?.receivingTeam ?? null,
      result: result ? cloneKickoffResultForPresentation(result) : null,
      reticleVisible: this.reticle.group.visible,
      sequenceIndex: this.kickoffState?.sequenceIndex ?? null,
    };
  }

  dispose(): void {
    this.reset();
    this.group.clear();
    this.reticle.dispose();
  }

  private rebuildVisuals(): void {
    this.disposeVisualResources();
    if (!this.group.visible || !this.kickoffState) {
      return;
    }

    const layout = createKickoffFormation(this.kickoffState, this.options.rosterBinding);
    const issues = validateKickoffFormation(layout);
    if (issues.length > 0) {
      this.options.warn?.(`Kickoff formation issues: ${issues.join('; ')}`);
    }
    this.sidelineVisuals = createSidelineVisualResources(
      layout.placements,
      this.options.teamTheme,
    );
    this.group.add(this.sidelineVisuals.group);
    syncSidelineVisualResources(
      { meshes: this.sidelineVisuals.meshes },
      layout.placements,
      this.options.teamTheme,
    );
  }

  private disposeVisualResources(): void {
    if (!this.sidelineVisuals) {
      return;
    }

    this.group.remove(this.sidelineVisuals.group);
    this.sidelineVisuals.dispose();
    this.sidelineVisuals = null;
  }

  private startReadyLine(matchSeed: number | string): void {
    if (this.requestedReadyLine) {
      return;
    }

    this.requestedReadyLine = true;
    this.options.audioCoordinator.startLine(
      'kickoffReady',
      resolveKickoffReady({ matchSeed }),
    );
  }

  private startInFlightLine(matchSeed: number | string): void {
    if (this.requestedInFlightLine) {
      return;
    }

    this.requestedInFlightLine = true;
    this.options.audioCoordinator.startLine(
      'kickoffInFlight',
      resolveKickoffInFlight({ matchSeed }),
    );
  }

  private startResultLine(matchSeed: number | string): void {
    if (this.requestedResultLine || !this.kickoffState?.result) {
      return;
    }

    this.requestedResultLine = true;
    this.options.audioCoordinator.startLine(
      'kickoffResult',
      resolveKickoffResult({
        matchSeed,
        resultType: classifyKickoffCommentaryResult(this.kickoffState.result),
      }),
    );
  }

  private syncBallToKickoff(elapsedSeconds: number): void {
    const result = this.kickoffState?.result;
    if (!result) {
      this.ballVisual.visible = false;
      return;
    }

    const previous = { ...this.ballModel.position };
    const position = sampleKickoffBallPosition(result, elapsedSeconds);
    this.ballModel.previousPosition = previous;
    this.ballModel.position = position;
    this.ballModel.possession = { kind: 'none' };
    this.ballModel.state = {
      durationSeconds: result.flightSeconds,
      elapsedSeconds,
      kind: 'inFlight',
      maxFlightTimeSeconds: result.flightSeconds,
      peakHeight: result.apexHeight,
      start: { x: result.origin.x, y: 0.24, z: result.origin.z },
      target: { x: result.target.x, y: 0.18, z: result.target.z },
    };
    syncBallVisual(this.ballVisual, this.ballModel);
  }

  private createFocusForPhase(result: KickoffResult): THREE.Vector3 {
    if (this.phase === 'flight') {
      return new THREE.Vector3(
        this.ballModel.position.x,
        Math.max(1.4, this.ballModel.position.y * 0.72),
        this.ballModel.position.z,
      );
    }

    if (this.phase === 'result') {
      return new THREE.Vector3(result.target.x, 1.2, result.target.z);
    }

    return new THREE.Vector3(result.origin.x, 1.2, result.origin.z);
  }

  private getAnimationProgress(): number {
    const result = this.kickoffState?.result;
    if (this.phase === 'ready') {
      return Math.min(1, this.readyElapsedSeconds / KICKOFF_PRESENTATION_CONFIG.minimumReadySeconds);
    }
    if (this.phase === 'flight' && result) {
      return Math.min(1, this.flightElapsedSeconds / Math.max(0.001, result.flightSeconds));
    }
    if (this.phase === 'result') {
      return Math.min(1, this.resultElapsedSeconds / KICKOFF_PRESENTATION_CONFIG.minimumResultSeconds);
    }
    return this.completed ? 1 : 0;
  }
}

function cloneKickoffStateForPresentation(state: KickoffState): KickoffState {
  return {
    ...state,
    kickerRatings: state.kickerRatings ? { ...state.kickerRatings } : null,
    result: state.result ? cloneKickoffResultForPresentation(state.result) : null,
  };
}

function cloneKickoffResultForPresentation(result: KickoffResult): KickoffResult {
  return {
    ...result,
    origin: { ...result.origin },
    receivingStartSpot: { ...result.receivingStartSpot },
    target: { ...result.target },
  };
}
