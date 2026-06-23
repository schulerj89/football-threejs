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
import type { PlayerVisualMode } from '../presentation/players/PlayerVisualMode';
import { createKickLandingReticle } from '../presentation/KickLandingReticle';
import { updateRunAnimation } from '../presentation/RunAnimation';
import {
  FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  createFootballPlayerVisual,
  type FootballPlayerVisualFactoryOptions,
  type FootballPlayerVisualResources,
} from '../presentation/players/FootballPlayerVisualFactory';
import type { PregameAudioCoordinator } from '../presentation/pregame/PregameAudioCoordinator';
import {
  classifyKickoffCommentaryResult,
} from './KickoffSimulation';
import {
  createKickoffReturnState,
  startKickoffRunUp,
  updateKickoffReturnState,
  type KickoffReturnState,
} from './KickoffReturnSimulation';
import {
  createKickoffFormation,
  type KickoffFormationLayout,
  type KickoffFormationParticipantPlacement,
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
  footballPlayerVisual?: Pick<
    FootballPlayerVisualFactoryOptions,
    'attachHelmet' | 'helmet' | 'playerVisualOptions'
  >;
  playerVisualMode?: PlayerVisualMode;
  rosterBinding: GameplayRosterBinding;
  sfxAudio?: {
    playOneShot(assetId: string): Promise<boolean>;
  };
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
  returnCameraDistanceBehind: 17,
  returnCameraHeight: 9.5,
  returnLookAhead: 7,
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
  private matchSeed: number | string = 'kickoff';
  private returnState: KickoffReturnState | null = null;
  private kickoffLayout: KickoffFormationLayout | null = null;
  private kickoffVisuals = new Map<string, FootballPlayerVisualResources>();
  private formationValidation: string[] = [];
  private stageEntryConstructionMs = 0;

  constructor(private options: KickoffPresentationDirectorOptions) {
    this.group.name = 'kickoff-presentation-root';
    this.group.userData.kickoffPresentation = true;
    this.group.visible = false;
    this.ballModel = createBallModel({ x: 0, z: -15 });
    this.ballVisual = createBallVisual({ style: options.ballVisualStyle });
    this.group.add(this.ballVisual, this.reticle.group);
  }

  applySettings(options: Pick<KickoffPresentationDirectorOptions, 'playerVisualMode' | 'rosterBinding' | 'teamTheme'>): void {
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
    this.matchSeed = matchSnapshot?.deterministicSeed ?? 'kickoff';
    this.returnState = null;
    this.completed = false;
    this.flightElapsedSeconds = 0;
    this.phase = 'ready';
    this.readyElapsedSeconds = 0;
    this.requestedInFlightLine = false;
    this.requestedReadyLine = false;
    this.requestedResultLine = false;
    this.resultElapsedSeconds = 0;
    this.group.visible = true;
    this.reticle.sync(kickoff.result, false);
    this.rebuildVisuals();
    this.syncBallFromReturnState();
    this.options.audioCoordinator.reset();
    this.startReadyLine(matchSnapshot?.deterministicSeed ?? 'kickoff');
  }

  update(context: KickoffPresentationContext): KickoffFrameResult {
    if (this.phase === 'idle' || !this.kickoffState?.result || !this.returnState) {
      return { clockRunning: false, completed: false, returnResult: null };
    }

    const delta = Math.min(
      Math.max(0, context.deltaSeconds),
      KICKOFF_PRESENTATION_CONFIG.maximumDeltaSeconds,
    );
    this.options.audioCoordinator.updateAmbience(context.gameplaySnapshot, delta);

    if (this.phase === 'ready') {
      this.readyElapsedSeconds += delta;
      this.syncBallFromReturnState();
      this.reticle.sync(this.kickoffState.result, false);
      if (
        this.readyElapsedSeconds >= KICKOFF_PRESENTATION_CONFIG.minimumReadySeconds &&
        this.options.audioCoordinator.isLineComplete('kickoffReady')
      ) {
        startKickoffRunUp(this.returnState);
        this.phase = 'runUp';
        void this.options.sfxAudio?.playOneShot('kickoff_runup_01');
      }
    } else if (this.phase === 'runUp') {
      const events = updateKickoffReturnState(this.returnState, {
        deltaSeconds: delta,
        userInput: context.userInput,
      });
      this.phase = normalizeReturnPhase(this.returnState.phase);
      if (this.returnState.phase === 'complete') {
        this.phase = 'result';
      }
      this.syncBallFromReturnState();
      this.syncDynamicKickoffVisuals(delta);
      this.reticle.sync(this.kickoffState.result, false);
      if (events.contact) {
        void this.options.sfxAudio?.playOneShot('kickoff_contact_01');
        this.startInFlightLine(context.matchSnapshot?.deterministicSeed ?? 'kickoff');
      }
    } else if (this.phase === 'flight') {
      const events = updateKickoffReturnState(this.returnState, {
        deltaSeconds: delta,
        userInput: context.userInput,
      });
      this.flightElapsedSeconds = this.returnState.flightElapsedSeconds;
      this.phase = normalizeReturnPhase(this.returnState.phase);
      this.syncBallFromReturnState();
      this.syncDynamicKickoffVisuals(delta);
      this.reticle.sync(
        this.kickoffState.result,
        !events.catch && !events.touchback && this.returnState.phase === 'flight',
      );
      if (events.catch) {
        void this.options.sfxAudio?.playOneShot('kickoff_catch_01');
      }
      if (events.touchback) {
        this.startResultLine(context.matchSnapshot?.deterministicSeed ?? 'kickoff');
      }
    } else if (this.phase === 'fielding' || this.phase === 'returnLive') {
      const events = updateKickoffReturnState(this.returnState, {
        deltaSeconds: delta,
        userInput: context.userInput,
      });
      this.phase = normalizeReturnPhase(this.returnState.phase);
      this.syncBallFromReturnState();
      this.syncDynamicKickoffVisuals(delta);
      this.reticle.sync(this.kickoffState.result, false);
      if (events.clockStarted) {
        this.options.audioCoordinator.fadeTitleMusicToGameplay(0.8);
      }
      if (events.dead) {
        this.resultElapsedSeconds = 0;
        this.startResultLine(context.matchSnapshot?.deterministicSeed ?? 'kickoff');
      }
    } else if (this.phase === 'touchback' || this.phase === 'dead') {
      this.resultElapsedSeconds += delta;
      updateKickoffReturnState(this.returnState, {
        deltaSeconds: delta,
        userInput: context.userInput,
      });
      this.phase = this.returnState.phase === 'complete'
        ? 'result'
        : normalizeReturnPhase(this.returnState.phase);
      this.syncBallFromReturnState();
      this.syncDynamicKickoffVisuals(delta);
      this.reticle.sync(this.kickoffState.result, false);
    } else if (this.phase === 'result') {
      this.resultElapsedSeconds += delta;
      this.syncBallFromReturnState();
      this.reticle.sync(this.kickoffState.result, false);
      if (
        this.resultElapsedSeconds >= KICKOFF_PRESENTATION_CONFIG.minimumResultSeconds &&
        this.options.audioCoordinator.isLineComplete('kickoffResult')
      ) {
        this.completed = true;
        this.phase = 'completed';
      }
    }

    return {
      clockRunning: this.returnState.clockRunning,
      completed: this.completed,
      returnResult: this.returnState.outcome ? { ...this.returnState.outcome } : null,
    };
  }

  createCameraShot(): PresentationCameraShot {
    const result = this.kickoffState?.result ?? null;
    const direction = this.kickoffState?.direction ?? 1;
    const cameraDirection = this.getCameraDirection(direction);
    const focus = result
      ? this.createFocusForPhase(result)
      : new THREE.Vector3(0, 1.4, 0);
    const sidelineOffset = KICKOFF_PRESENTATION_CONFIG.sidelineCameraOffset;
    const distanceBehind = this.phase === 'result'
      ? KICKOFF_PRESENTATION_CONFIG.resultCameraDistanceBehind
      : this.isReturnCameraPhase()
        ? KICKOFF_PRESENTATION_CONFIG.returnCameraDistanceBehind
      : this.phase === 'flight'
        ? KICKOFF_PRESENTATION_CONFIG.flightCameraDistanceBehind
        : KICKOFF_PRESENTATION_CONFIG.readyCameraDistanceBehind;
    const height = this.phase === 'result'
      ? KICKOFF_PRESENTATION_CONFIG.resultCameraHeight
      : this.isReturnCameraPhase()
        ? KICKOFF_PRESENTATION_CONFIG.returnCameraHeight
      : this.phase === 'flight'
        ? KICKOFF_PRESENTATION_CONFIG.flightCameraHeight
        : KICKOFF_PRESENTATION_CONFIG.readyCameraHeight;
    const position = new THREE.Vector3(
      focus.x - sidelineOffset,
      height,
      focus.z - cameraDirection * distanceBehind,
    );
    const lookAhead = this.phase === 'flight'
      ? KICKOFF_PRESENTATION_CONFIG.flightLookAhead
      : this.isReturnCameraPhase()
        ? KICKOFF_PRESENTATION_CONFIG.returnLookAhead
      : 0;
    const lookTarget = new THREE.Vector3(
      focus.x,
      focus.y,
      focus.z + cameraDirection * lookAhead,
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
    this.kickoffLayout = null;
    this.formationValidation = [];
    this.options.audioCoordinator.fadeTitleMusicToGameplay(1.2);
  }

  reset(): void {
    this.completed = false;
    this.flightElapsedSeconds = 0;
    this.kickoffState = null;
    this.matchSeed = 'kickoff';
    this.returnState = null;
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
    this.kickoffLayout = null;
    this.formationValidation = [];
    this.stageEntryConstructionMs = 0;
  }

  getSnapshot(): KickoffFrameSnapshot {
    const audioSnapshot = this.options.audioCoordinator.getSnapshot();
    const result = this.kickoffState?.result ?? null;
    const visualReadiness = [...this.kickoffVisuals.values()].map((resource) => resource.getReadiness());
    const rosterBindings = (this.kickoffLayout?.participants ?? []).map((participant) => ({
      rosterPlayerId: participant.rosterPlayerId,
      slotId: participant.slotId,
      team: participant.team,
      visualId: participant.visualId,
    }));
    return {
      activeCommentary: audioSnapshot.activeLine?.lineId ?? null,
      assignedReturner: this.returnState?.assignedReturner
        ? {
            ...this.returnState.assignedReturner,
            landingSpot: { ...this.returnState.assignedReturner.landingSpot },
          }
        : null,
      animationProgress: this.getAnimationProgress(),
      ballPosition: this.ballVisual.visible
        ? { ...this.ballModel.position }
        : null,
      blockerAssignments: this.returnState?.blockerAssignments.map((assignment) => ({ ...assignment })) ?? [],
      carrierRosterId: this.returnState?.outcome?.carrierRosterId ??
        (this.returnState?.carrierVisualId
          ? this.returnState.participants.find((participant) =>
              participant.visualId === this.returnState?.carrierVisualId)?.rosterPlayerId ?? null
          : null),
      carrierVisualId: this.returnState?.carrierVisualId ?? null,
      clockRunning: this.returnState?.clockRunning ?? false,
      clockStartReason: this.returnState?.clockStartReason ?? null,
      completed: this.completed,
      direction: this.kickoffState?.direction ?? null,
      formationBounds: this.kickoffLayout?.bounds ? { ...this.kickoffLayout.bounds } : null,
      formationFamily: this.kickoffLayout?.family ?? null,
      formationValidation: [...this.formationValidation],
      helmetReadyCount: visualReadiness.filter((readiness) => readiness.helmetReady).length,
      kickerRosterId: this.kickoffState?.kickerRosterId ?? null,
      kickingParticipantCount: this.kickoffLayout?.participants
        .filter((participant) => participant.phase === 'kicking').length ?? 0,
      kickingTeam: this.kickoffState?.kickingTeam ?? null,
      landingType: result?.landingType ?? null,
      nextStage: this.completed ? 'scrimmage' : null,
      participantCount: this.kickoffLayout?.participants.length ?? 0,
      phase: this.phase,
      receivingStartPosition: this.returnState?.outcome
        ? { ...this.returnState.outcome.receivingStartPosition }
        : result
          ? { ...result.receivingStartPosition }
          : null,
      receivingParticipantCount: this.kickoffLayout?.participants
        .filter((participant) => participant.phase === 'receiving').length ?? 0,
      receivingTeam: this.kickoffState?.receivingTeam ?? null,
      result: result ? cloneKickoffResultForPresentation(result) : null,
      returnLane: this.returnState?.returnLane ?? null,
      returnResult: this.returnState?.outcome
        ? {
            ...this.returnState.outcome,
            deadBallSpot: { ...this.returnState.outcome.deadBallSpot },
            receivingStartPosition: { ...this.returnState.outcome.receivingStartPosition },
          }
        : null,
      reticleVisible: this.reticle.group.visible,
      rosterBindings,
      sequenceIndex: this.kickoffState?.sequenceIndex ?? null,
      stageEntryConstructionMs: this.stageEntryConstructionMs,
      stageVisibility: {
        kickoffParticipantsVisible: this.group.visible && this.kickoffVisuals.size > 0,
        officialsVisible: false,
        scrimmagePlayersVisible: false,
      },
      visualProfile: {
        bareHeadCount: [...this.kickoffVisuals.values()]
          .filter((resource) => resource.root.visible && !resource.getReadiness().helmetReady).length,
        fullFootballPlayerVisualCount: [...this.kickoffVisuals.values()]
          .filter((resource) => resource.root.userData.fullFootballPlayerVisual === true).length,
        presentationOnlyCount: [...this.kickoffVisuals.values()]
          .filter((resource) => resource.getSnapshot().presentationOnly).length,
        profileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
        profileMatchCount: [...this.kickoffVisuals.values()]
          .filter((resource) => resource.root.userData.visualProfileId === FOOTBALL_PLAYER_VISUAL_PROFILE_ID).length,
      },
    };
  }

  dispose(): void {
    this.reset();
    this.group.clear();
    this.reticle.dispose();
  }

  private rebuildVisuals(): void {
    this.disposeVisualResources();
    this.kickoffLayout = null;
    this.formationValidation = [];
    this.stageEntryConstructionMs = 0;
    if (!this.group.visible || !this.kickoffState) {
      return;
    }

    const startedAt = nowMs();
    const layout = createKickoffFormation(this.kickoffState, this.options.rosterBinding);
    this.kickoffLayout = layout;
    this.returnState = createKickoffReturnState({
      kickoff: this.kickoffState,
      layout,
      matchSeed: this.matchSeed,
    });
    const issues = validateKickoffFormation(layout);
    this.formationValidation = issues;
    if (issues.length > 0) {
      this.options.warn?.(`Kickoff formation issues: ${issues.join('; ')}`);
    }

    for (const placement of layout.participants) {
      const uniform = this.options.teamTheme.uniforms[placement.gameplayTeam];
      const resource = createFootballPlayerVisual(
        {
          appearanceId: placement.appearanceId,
          footballPosition: placement.footballPosition,
          gameplayTeam: placement.gameplayTeam,
          presentationOnly: true,
          role: placement.role,
          jerseyNumber: placement.jerseyNumber,
          rosterPlayerId: placement.rosterPlayerId,
          teamSide: placement.teamSide,
          uniform,
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
      resource.root.userData.kickoffPresentation = true;
      resource.root.userData.kickoffParticipant = true;
      resource.root.userData.kickoffSlotId = placement.slotId;
      resource.root.name = `kickoff-participant-${placement.visualId}`;
      this.kickoffVisuals.set(placement.visualId, resource);
      this.group.add(resource.root);
      this.syncKickoffVisual(placement, resource);
      void resource.ready
        .then(() => {
          if (this.kickoffVisuals.get(placement.visualId) === resource) {
            this.syncDynamicKickoffVisuals(0);
          }
        })
        .catch(() => {
          if (this.kickoffVisuals.get(placement.visualId) === resource) {
            this.syncDynamicKickoffVisuals(0);
          }
        });
    }
    this.stageEntryConstructionMs = nowMs() - startedAt;
  }

  private disposeVisualResources(): void {
    for (const resource of this.kickoffVisuals.values()) {
      resource.dispose();
    }
    this.kickoffVisuals.clear();
  }

  private syncKickoffVisual(
    placement: KickoffFormationParticipantPlacement,
    resource: FootballPlayerVisualResources,
  ): void {
    resource.syncTransform(placement.position, placement.facingRadians);
    resource.syncUniform(
      this.options.teamTheme.uniforms[placement.gameplayTeam],
      this.options.teamTheme.uniforms,
    );
    resource.setPose(placement.phase === 'kicking' ? 'readyOffense' : 'readyDefense');
    resource.root.scale.setScalar(placement.scale);
    resource.setVisible(this.group.visible && resource.getReadiness().subjectReady);
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
        resultType: this.returnState?.outcome
          ? this.returnState.outcome.type === 'touchback'
            ? 'touchback'
            : 'returnedKick'
          : classifyKickoffCommentaryResult(this.kickoffState.result),
      }),
    );
  }

  private syncBallFromReturnState(): void {
    if (!this.returnState) {
      this.ballVisual.visible = false;
      return;
    }

    const previous = { ...this.ballModel.position };
    this.ballModel.previousPosition = previous;
    this.ballModel.position = { ...this.returnState.ballPosition };
    this.ballModel.possession = this.returnState.carrierVisualId
      ? { kind: 'player', playerId: this.returnState.carrierVisualId }
      : { kind: 'none' };
    this.ballModel.state = this.returnState.carrierVisualId
      ? { kind: 'possessed', playerId: this.returnState.carrierVisualId }
      : {
          durationSeconds: this.returnState.result.flightSeconds,
          elapsedSeconds: this.returnState.flightElapsedSeconds,
          kind: 'inFlight',
          maxFlightTimeSeconds: this.returnState.result.flightSeconds,
          peakHeight: this.returnState.result.apexHeight,
          start: { x: this.returnState.result.origin.x, y: 0.24, z: this.returnState.result.origin.z },
          target: { x: this.returnState.result.target.x, y: 0.18, z: this.returnState.result.target.z },
        };
    this.ballVisual.visible = this.group.visible;
    syncBallVisual(this.ballVisual, this.ballModel);
  }

  private syncDynamicKickoffVisuals(deltaSeconds: number): void {
    if (!this.returnState) {
      return;
    }

    for (const participant of this.returnState.participants) {
      const resource = this.kickoffVisuals.get(participant.visualId);
      const placement = this.kickoffLayout?.participants.find((candidate) =>
        candidate.visualId === participant.visualId);
      if (!resource || !placement) {
        continue;
      }

      resource.syncTransform(participant.position, participant.facingRadians);
      resource.syncUniform(
        this.options.teamTheme.uniforms[placement.gameplayTeam],
        this.options.teamTheme.uniforms,
      );
      const poseIntent = resolveKickoffParticipantPose(
        this.phase,
        participant.visualId,
        this.returnState.carrierVisualId,
        participant.velocity,
      );
      resource.setPose(poseIntent);
      syncKickoffParticipantRunAnimation(resource.root, participant.velocity, deltaSeconds);
      resource.root.scale.setScalar(placement.scale);
      resource.setVisible(this.group.visible && resource.getReadiness().subjectReady);
    }
  }

  private createFocusForPhase(result: KickoffResult): THREE.Vector3 {
    if (this.phase === 'runUp') {
      const kicker = this.returnState?.participants.find((participant) => participant.slotId === 'kicker');
      return new THREE.Vector3(
        kicker?.position.x ?? this.ballModel.position.x,
        1.35,
        kicker?.position.z ?? this.ballModel.position.z,
      );
    }

    if (this.phase === 'flight') {
      return new THREE.Vector3(
        this.ballModel.position.x,
        Math.max(1.4, this.ballModel.position.y * 0.72),
        this.ballModel.position.z,
      );
    }

    if (
      this.phase === 'fielding' ||
      this.phase === 'returnLive' ||
      this.phase === 'dead' ||
      this.phase === 'touchback' ||
      this.phase === 'result'
    ) {
      const focusSpot = this.returnState?.outcome?.deadBallSpot ??
        this.returnState?.participants.find((participant) =>
          participant.visualId === this.returnState?.carrierVisualId)?.position ??
        result.target;
      return new THREE.Vector3(focusSpot.x, 1.2, focusSpot.z);
    }

    return new THREE.Vector3(result.origin.x, 1.2, result.origin.z);
  }

  private getCameraDirection(kickDirection: KickoffState['direction']): KickoffState['direction'] {
    return this.isReturnCameraPhase()
      ? kickDirection > 0 ? -1 : 1
      : kickDirection;
  }

  private isReturnCameraPhase(): boolean {
    return (
      this.phase === 'fielding' ||
      this.phase === 'returnLive' ||
      this.phase === 'dead' ||
      (this.phase === 'result' && this.returnState?.outcome?.type !== 'touchback')
    );
  }

  private getAnimationProgress(): number {
    const result = this.kickoffState?.result;
    if (this.phase === 'ready') {
      return Math.min(1, this.readyElapsedSeconds / KICKOFF_PRESENTATION_CONFIG.minimumReadySeconds);
    }
    if (this.phase === 'flight' && result) {
      return Math.min(1, this.flightElapsedSeconds / Math.max(0.001, result.flightSeconds));
    }
    if (this.phase === 'runUp' && this.returnState) {
      return Math.min(1, this.returnState.runUpElapsedSeconds / 0.5);
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
    returnResult: state.returnResult ? {
      ...state.returnResult,
      deadBallSpot: { ...state.returnResult.deadBallSpot },
      receivingStartPosition: { ...state.returnResult.receivingStartPosition },
    } : null,
  };
}

function cloneKickoffResultForPresentation(result: KickoffResult): KickoffResult {
  return {
    ...result,
    origin: { ...result.origin },
    receivingStartPosition: { ...result.receivingStartPosition },
    target: { ...result.target },
  };
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function normalizeReturnPhase(phase: KickoffReturnState['phase']): KickoffPresentationPhase {
  return phase === 'complete' ? 'completed' : phase;
}

function resolveKickoffParticipantPose(
  phase: KickoffPresentationPhase,
  visualId: string,
  carrierVisualId: string | null,
  velocity: { x: number; z: number } = { x: 0, z: 0 },
): 'locomotion' | 'neutral' | 'readyDefense' | 'readyOffense' {
  if (
    calculatePlanarSpeed(velocity) > 0.12 ||
    visualId === carrierVisualId ||
    phase === 'returnLive' ||
    phase === 'flight'
  ) {
    return 'locomotion';
  }
  if (phase === 'ready' || phase === 'runUp') {
    return 'readyOffense';
  }
  return 'neutral';
}

function syncKickoffParticipantRunAnimation(
  root: THREE.Object3D,
  velocity: { x: number; z: number },
  deltaSeconds: number,
): void {
  const speed = calculatePlanarSpeed(velocity);
  if (speed > 0.12 || root.userData.runAnimationInitialized === true) {
    updateRunAnimation(root, deltaSeconds, speed);
  }
}

function calculatePlanarSpeed(velocity: { x: number; z: number }): number {
  return Math.hypot(velocity.x, velocity.z);
}
