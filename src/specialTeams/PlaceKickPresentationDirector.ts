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
import type { TeamPresentationTheme } from '../teams/TeamThemeApplier';
import type { GameplayRosterBinding } from '../roster/GameplayRosterBinding';
import type { PlayerVisualMode } from '../presentation/players/PlayerVisualMode';
import {
  updateKickAnimation,
  updateRunAnimation,
} from '../presentation/RunAnimation';
import {
  FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  createFootballPlayerVisual,
  type FootballPlayerVisualFactoryOptions,
  type FootballPlayerVisualResources,
} from '../presentation/players/FootballPlayerVisualFactory';
import {
  createPlaceKickFormation,
  validatePlaceKickFormation,
} from './PlaceKickFormation';
import {
  clonePlaceKickState,
  samplePlaceKickBallPosition,
} from './PlaceKickSimulation';
import type {
  PlaceKickFrameResult,
  PlaceKickFrameSnapshot,
  PlaceKickFormationParticipantPlacement,
  PlaceKickPresentationContext,
  PlaceKickPresentationPhase,
  PlaceKickResult,
  PlaceKickState,
} from './PlaceKickTypes';

export interface PlaceKickAudioPort {
  playOneShot(assetId: string): Promise<boolean>;
}

export interface PlaceKickPresentationDirectorOptions {
  audio?: PlaceKickAudioPort;
  ballVisualStyle: BallVisualStyle;
  footballPlayerVisual?: Pick<
    FootballPlayerVisualFactoryOptions,
    'attachHelmet' | 'helmet' | 'playerVisualOptions'
  >;
  playerVisualMode?: PlayerVisualMode;
  rosterBinding: GameplayRosterBinding;
  teamTheme: TeamPresentationTheme;
  warn?: (message: string) => void;
}

const PLACE_KICK_PRESENTATION_CONFIG = {
  cameraDistanceBehind: 16,
  cameraHeight: 8.8,
  cameraSideOffset: 7,
  fieldOfView: 40,
  formationSeconds: 0.55,
  maximumDeltaSeconds: 1 / 15,
  resultSeconds: 3.1,
  runUpSeconds: 0.52,
  setSeconds: 0.28,
  snapSeconds: 0.32,
} as const;

export const PLACE_KICK_GOOD_MESSAGE = "IT'S GOOD!";
export const PLACE_KICK_GOOD_ANNOUNCER_ASSET_ID = 'place_kick_good_01';
export const PLACE_KICK_GOOD_WHISTLE_ASSET_ID = 'referee_whistle_01';

const PLACE_KICK_KICKER_ANIMATION_CONFIG = {
  approachStopDistanceYards: 0.78,
  contactFollowThroughSeconds: 0.28,
  movingSpeedFloorYardsPerSecond: 4.5,
} as const;

export class PlaceKickPresentationDirector {
  readonly group = new THREE.Group();

  private readonly ballModel: BallModel;
  private readonly ballVisual: THREE.Group;
  private completed = false;
  private elapsedInPhaseSeconds = 0;
  private flightElapsedSeconds = 0;
  private formationValidation: string[] = [];
  private phase: PlaceKickPresentationPhase = 'idle';
  private placeKickLayout: ReturnType<typeof createPlaceKickFormation> | null = null;
  private placeKickState: PlaceKickState | null = null;
  private placeKickVisuals = new Map<string, FootballPlayerVisualResources>();
  private playedContact = false;
  private playedResultAnnouncer = false;
  private playedResultWhistle = false;
  private playedSet = false;
  private playedSnap = false;

  constructor(private options: PlaceKickPresentationDirectorOptions) {
    this.group.name = 'place-kick-presentation-root';
    this.group.userData.placeKickPresentation = true;
    this.group.visible = false;
    this.ballModel = createBallModel({ x: 0, z: 0 });
    this.ballVisual = createBallVisual({ style: options.ballVisualStyle });
    this.group.add(this.ballVisual);
  }

  applySettings(options: Pick<PlaceKickPresentationDirectorOptions, 'playerVisualMode' | 'rosterBinding' | 'teamTheme'>): void {
    this.options = {
      ...this.options,
      ...options,
    };
    this.rebuildVisuals();
  }

  start(matchSnapshot: { extraPoint: PlaceKickState } | null): void {
    const extraPoint = matchSnapshot?.extraPoint ?? null;
    if (!extraPoint?.kickingTeam || !extraPoint.defendingTeam || extraPoint.completed) {
      this.reset();
      return;
    }

    this.placeKickState = clonePlaceKickState(extraPoint);
    this.completed = false;
    this.elapsedInPhaseSeconds = 0;
    this.flightElapsedSeconds = 0;
    this.phase = 'formation';
    this.playedContact = false;
    this.playedResultAnnouncer = false;
    this.playedResultWhistle = false;
    this.playedSet = false;
    this.playedSnap = false;
    this.group.visible = true;
    this.syncBallToSpot(this.placeKickState.snapSpot);
    this.rebuildVisuals();
  }

  update(context: PlaceKickPresentationContext): PlaceKickFrameResult {
    if (this.phase === 'idle' || !this.placeKickState) {
      return { completed: false, timingInput: null };
    }

    const latest = context.matchSnapshot?.extraPoint ?? null;
    if (latest && latest.sequenceIndex === this.placeKickState.sequenceIndex) {
      this.placeKickState = clonePlaceKickState(latest);
    }

    const delta = Math.min(
      Math.max(0, context.deltaSeconds),
      PLACE_KICK_PRESENTATION_CONFIG.maximumDeltaSeconds,
    );
    this.elapsedInPhaseSeconds += delta;

    if (this.phase === 'formation') {
      this.syncBallToSpot(this.placeKickState.snapSpot);
      if (this.elapsedInPhaseSeconds >= PLACE_KICK_PRESENTATION_CONFIG.formationSeconds) {
        this.transitionTo('meter');
      }
    } else if (this.phase === 'meter') {
      this.syncBallToSpot(this.placeKickState.snapSpot);
      if (this.placeKickState.result) {
        this.transitionTo('snap');
      }
    } else if (this.phase === 'snap') {
      this.syncBallToSpot(this.placeKickState.holderSpot);
      if (!this.playedSnap) {
        this.playedSnap = true;
        this.playSfx('place_kick_snap_01');
      }
      if (this.elapsedInPhaseSeconds >= PLACE_KICK_PRESENTATION_CONFIG.snapSeconds) {
        this.transitionTo('set');
      }
    } else if (this.phase === 'set') {
      this.syncBallToSpot(this.placeKickState.holderSpot);
      if (!this.playedSet) {
        this.playedSet = true;
        this.playSfx('place_kick_set_01');
      }
      if (this.elapsedInPhaseSeconds >= PLACE_KICK_PRESENTATION_CONFIG.setSeconds) {
        this.transitionTo('runUp');
      }
    } else if (this.phase === 'runUp') {
      this.syncBallToSpot(this.placeKickState.holderSpot);
      if (this.elapsedInPhaseSeconds >= PLACE_KICK_PRESENTATION_CONFIG.runUpSeconds) {
        this.transitionTo('contact');
      }
    } else if (this.phase === 'contact') {
      if (!this.playedContact) {
        this.playedContact = true;
        this.playSfx('place_kick_contact_01');
      }
      this.transitionTo('flight');
    } else if (this.phase === 'flight') {
      const result = this.placeKickState.result;
      if (result) {
        this.flightElapsedSeconds = Math.min(result.flightSeconds, this.flightElapsedSeconds + delta);
        this.syncBallToResult(result, this.flightElapsedSeconds);
        if (this.flightElapsedSeconds >= result.flightSeconds) {
          if (!result.good && result.reason !== 'short') {
            this.playSfx('kick_upright_hit_01');
          }
          this.transitionTo('result');
        }
      }
    } else if (this.phase === 'result') {
      const result = this.placeKickState.result;
      if (result) {
        if (result.good) {
          this.syncBallToGoalPlane(result);
        } else {
          this.syncBallToResult(result, result.flightSeconds);
        }
      }
      if (this.elapsedInPhaseSeconds >= PLACE_KICK_PRESENTATION_CONFIG.resultSeconds) {
        this.phase = 'completed';
        this.completed = true;
      }
    }

    this.syncAllPlaceKickVisuals(delta);

    return { completed: this.completed, timingInput: null };
  }

  isMeterActive(): boolean {
    return this.group.visible && this.phase === 'meter' && !this.placeKickState?.result;
  }

  createCameraShot(): PresentationCameraShot {
    const direction = this.placeKickState?.direction ?? 1;
    const focus = this.createFocus();
    const position = new THREE.Vector3(
      focus.x - PLACE_KICK_PRESENTATION_CONFIG.cameraSideOffset,
      PLACE_KICK_PRESENTATION_CONFIG.cameraHeight,
      focus.z - direction * PLACE_KICK_PRESENTATION_CONFIG.cameraDistanceBehind,
    );
    const lookTarget = new THREE.Vector3(
      focus.x,
      focus.y,
      focus.z + direction * (this.phase === 'flight' ? 5 : 1.5),
    );

    return {
      activeShotName: null,
      fieldOfView: PLACE_KICK_PRESENTATION_CONFIG.fieldOfView,
      focus,
      lookTarget,
      orbitCenter: null,
      orbitRadius: null,
      phase: this.phase === 'flight' ? 'passFlight' : 'preSnapEstablish',
      position,
      restoreCamera: 'placeKick',
      shotProgress: this.getAnimationProgress(),
    };
  }

  finish(): void {
    this.phase = 'completed';
    this.completed = true;
    this.group.visible = false;
    this.disposeVisualResources();
    this.ballVisual.visible = false;
    this.placeKickLayout = null;
    this.formationValidation = [];
  }

  reset(): void {
    this.completed = false;
    this.elapsedInPhaseSeconds = 0;
    this.flightElapsedSeconds = 0;
    this.formationValidation = [];
    this.phase = 'idle';
    this.placeKickLayout = null;
    this.placeKickState = null;
    this.playedContact = false;
    this.playedResultAnnouncer = false;
    this.playedResultWhistle = false;
    this.playedSet = false;
    this.playedSnap = false;
    this.group.visible = false;
    this.ballVisual.visible = false;
    this.disposeVisualResources();
  }

  getSnapshot(): PlaceKickFrameSnapshot {
    const result = this.placeKickState?.result ?? null;
    const visualReadiness = [...this.placeKickVisuals.values()].map((resource) => resource.getReadiness());
    const kickerVisual = this.findKickerVisualResource();
    const rosterBindings = (this.placeKickLayout?.participants ?? []).map((participant) => ({
      rosterPlayerId: participant.rosterPlayerId,
      slotId: participant.slotId,
      team: participant.team,
      visualId: participant.visualId,
    }));

    return {
      animationProgress: this.getAnimationProgress(),
      ballPosition: this.ballVisual.visible ? { ...this.ballModel.position } : null,
      completed: this.completed,
      defendingParticipantCount: this.placeKickLayout?.participants
        .filter((participant) => participant.phase === 'defense').length ?? 0,
      defendingTeam: this.placeKickState?.defendingTeam ?? null,
      direction: this.placeKickState?.direction ?? null,
      formationBounds: this.placeKickLayout?.bounds ? { ...this.placeKickLayout.bounds } : null,
      formationFamily: this.placeKickLayout?.family ?? null,
      formationValidation: [...this.formationValidation],
      good: result?.good ?? null,
      helmetReadyCount: visualReadiness.filter((readiness) => readiness.helmetReady).length,
      holderRosterId: this.placeKickState?.holderRosterId ?? null,
      kickerVisualPosition: kickerVisual && kickerVisual.root.visible
        ? {
            x: kickerVisual.root.position.x,
            y: kickerVisual.root.position.y,
            z: kickerVisual.root.position.z,
          }
        : null,
      kickerRosterId: this.placeKickState?.kickerRosterId ?? null,
      kickingParticipantCount: this.placeKickLayout?.participants
        .filter((participant) => participant.phase === 'protection').length ?? 0,
      kickingTeam: this.placeKickState?.kickingTeam ?? null,
      meterActive: this.isMeterActive(),
      nextStage: this.completed ? 'kickoff' : null,
      participantCount: this.placeKickLayout?.participants.length ?? 0,
      phase: this.phase,
      result: result ? cloneResult(result) : null,
      resultAnnouncerAssetId: result?.good ? PLACE_KICK_GOOD_ANNOUNCER_ASSET_ID : null,
      resultMessage: result?.good ? PLACE_KICK_GOOD_MESSAGE : result ? 'NO GOOD' : null,
      resultWhistleAssetId: result?.good ? PLACE_KICK_GOOD_WHISTLE_ASSET_ID : null,
      rosterBindings,
      sequenceIndex: this.placeKickState?.sequenceIndex ?? null,
      playedResultAnnouncer: this.playedResultAnnouncer,
      playedResultWhistle: this.playedResultWhistle,
      stageVisibility: {
        officialsVisible: false,
        placeKickParticipantsVisible: this.group.visible && this.placeKickVisuals.size > 0,
        scrimmagePlayersVisible: false,
      },
      visualProfile: {
        bareHeadCount: [...this.placeKickVisuals.values()]
          .filter((resource) => resource.root.visible && !resource.getReadiness().helmetReady).length,
        fullFootballPlayerVisualCount: [...this.placeKickVisuals.values()]
          .filter((resource) => resource.root.userData.fullFootballPlayerVisual === true).length,
        presentationOnlyCount: [...this.placeKickVisuals.values()]
          .filter((resource) => resource.getSnapshot().presentationOnly).length,
        profileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
        profileMatchCount: [...this.placeKickVisuals.values()]
          .filter((resource) => resource.root.userData.visualProfileId === FOOTBALL_PLAYER_VISUAL_PROFILE_ID).length,
      },
    };
  }

  dispose(): void {
    this.reset();
    this.group.clear();
  }

  private rebuildVisuals(): void {
    this.disposeVisualResources();
    this.placeKickLayout = null;
    this.formationValidation = [];
    if (!this.group.visible || !this.placeKickState) {
      return;
    }

    const layout = createPlaceKickFormation(this.placeKickState, this.options.rosterBinding);
    this.placeKickLayout = layout;
    const issues = validatePlaceKickFormation(layout);
    this.formationValidation = issues;
    if (issues.length > 0) {
      this.options.warn?.(`Place-kick formation issues: ${issues.join('; ')}`);
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
      resource.root.userData.placeKickPresentation = true;
      resource.root.userData.placeKickParticipant = true;
      resource.root.userData.placeKickSlotId = placement.slotId;
      resource.root.name = `place-kick-participant-${placement.visualId}`;
      this.placeKickVisuals.set(placement.visualId, resource);
      this.group.add(resource.root);
      this.syncPlaceKickVisual(placement, resource);
      void resource.ready
        .then(() => {
          if (this.placeKickVisuals.get(placement.visualId) === resource) {
            this.syncPlaceKickVisual(placement, resource);
          }
        })
        .catch(() => {
          if (this.placeKickVisuals.get(placement.visualId) === resource) {
            this.syncPlaceKickVisual(placement, resource);
          }
        });
    }
  }

  private disposeVisualResources(): void {
    for (const resource of this.placeKickVisuals.values()) {
      resource.dispose();
    }
    this.placeKickVisuals.clear();
  }

  private syncPlaceKickVisual(
    placement: PlaceKickFormationParticipantPlacement,
    resource: FootballPlayerVisualResources,
    deltaSeconds = 0,
  ): void {
    const transform = this.resolvePlaceKickVisualTransform(placement);
    resource.syncTransform(transform.position, transform.facingRadians);
    resource.syncUniform(
      this.options.teamTheme.uniforms[placement.gameplayTeam],
      this.options.teamTheme.uniforms,
    );
    const moving = transform.animationSpeedYardsPerSecond > 0;
    resource.setPose(moving ? 'locomotion' : placement.phase === 'protection' ? 'readyOffense' : 'readyDefense');
    const kickProgress = this.resolveKickerKickAnimationProgress(placement);
    if (kickProgress !== null) {
      updateKickAnimation(resource.root, kickProgress);
    } else if (moving || resource.root.userData.runAnimationInitialized) {
      updateRunAnimation(resource.root, deltaSeconds, transform.animationSpeedYardsPerSecond);
    }
    resource.root.scale.setScalar(placement.scale);
    resource.setVisible(this.group.visible && resource.getReadiness().subjectReady);
  }

  private transitionTo(phase: PlaceKickPresentationPhase): void {
    this.phase = phase;
    this.elapsedInPhaseSeconds = 0;
    if (phase === 'result') {
      const result = this.placeKickState?.result ?? null;
      if (result?.good) {
        this.syncBallToGoalPlane(result);
      }
      this.playResultFeedback();
    }
  }

  private syncBallToSpot(spot: { x: number; z: number }): void {
    const previous = { ...this.ballModel.position };
    this.ballModel.previousPosition = previous;
    this.ballModel.position = {
      x: spot.x,
      y: 0.2,
      z: spot.z,
    };
    this.ballModel.possession = { kind: 'none' };
    this.ballModel.state = { kind: 'dead' };
    syncBallVisual(this.ballVisual, this.ballModel);
  }

  private syncBallToResult(result: PlaceKickResult, elapsedSeconds: number): void {
    const previous = { ...this.ballModel.position };
    const position = samplePlaceKickBallPosition(result, elapsedSeconds);
    this.ballModel.previousPosition = previous;
    this.ballModel.position = position;
    this.ballModel.possession = { kind: 'none' };
    this.ballModel.state = {
      durationSeconds: result.flightSeconds,
      elapsedSeconds,
      kind: 'inFlight',
      maxFlightTimeSeconds: result.flightSeconds,
      peakHeight: result.apexHeight,
      start: { x: result.origin.x, y: 0.2, z: result.origin.z },
      target: { x: result.target.x, y: 0.18, z: result.target.z },
    };
    syncBallVisual(this.ballVisual, this.ballModel);
  }

  private syncBallToGoalPlane(result: PlaceKickResult): void {
    const previous = { ...this.ballModel.position };
    this.ballModel.previousPosition = previous;
    this.ballModel.position = { ...result.goalPlanePosition };
    this.ballModel.possession = { kind: 'none' };
    this.ballModel.state = {
      durationSeconds: result.flightSeconds,
      elapsedSeconds: result.flightSeconds,
      kind: 'inFlight',
      maxFlightTimeSeconds: result.flightSeconds,
      peakHeight: result.apexHeight,
      start: { x: result.origin.x, y: 0.2, z: result.origin.z },
      target: { x: result.target.x, y: 0.18, z: result.target.z },
    };
    syncBallVisual(this.ballVisual, this.ballModel);
  }

  private createFocus(): THREE.Vector3 {
    const result = this.placeKickState?.result ?? null;
    if (this.phase === 'flight') {
      return new THREE.Vector3(
        this.ballModel.position.x,
        Math.max(1.5, this.ballModel.position.y * 0.68),
        this.ballModel.position.z,
      );
    }

    if (this.phase === 'result' && result) {
      return new THREE.Vector3(result.goalPlanePosition.x, 1.8, result.goalPlanePosition.z);
    }

    const holderSpot = this.placeKickState?.holderSpot ?? { x: 0, z: 0 };
    return new THREE.Vector3(holderSpot.x, 1.2, holderSpot.z);
  }

  private getAnimationProgress(): number {
    if (this.phase === 'formation') {
      return Math.min(1, this.elapsedInPhaseSeconds / PLACE_KICK_PRESENTATION_CONFIG.formationSeconds);
    }
    if (this.phase === 'meter') {
      return 0;
    }
    if (this.phase === 'snap') {
      return Math.min(1, this.elapsedInPhaseSeconds / PLACE_KICK_PRESENTATION_CONFIG.snapSeconds);
    }
    if (this.phase === 'set') {
      return Math.min(1, this.elapsedInPhaseSeconds / PLACE_KICK_PRESENTATION_CONFIG.setSeconds);
    }
    if (this.phase === 'runUp') {
      return Math.min(1, this.elapsedInPhaseSeconds / PLACE_KICK_PRESENTATION_CONFIG.runUpSeconds);
    }
    if (this.phase === 'flight' && this.placeKickState?.result) {
      return Math.min(1, this.flightElapsedSeconds / Math.max(0.001, this.placeKickState.result.flightSeconds));
    }
    if (this.phase === 'result') {
      return Math.min(1, this.elapsedInPhaseSeconds / PLACE_KICK_PRESENTATION_CONFIG.resultSeconds);
    }
    return this.completed ? 1 : 0;
  }

  private playSfx(assetId: string): void {
    void this.options.audio?.playOneShot(assetId).catch(() => undefined);
  }

  private playResultFeedback(): void {
    const result = this.placeKickState?.result ?? null;
    if (!result?.good) {
      return;
    }

    if (!this.playedResultWhistle) {
      this.playedResultWhistle = true;
      this.playSfx(PLACE_KICK_GOOD_WHISTLE_ASSET_ID);
    }
    if (!this.playedResultAnnouncer) {
      this.playedResultAnnouncer = true;
      this.playSfx(PLACE_KICK_GOOD_ANNOUNCER_ASSET_ID);
    }
  }

  private syncAllPlaceKickVisuals(deltaSeconds: number): void {
    for (const placement of this.placeKickLayout?.participants ?? []) {
      const resource = this.placeKickVisuals.get(placement.visualId);
      if (resource) {
        this.syncPlaceKickVisual(placement, resource, deltaSeconds);
      }
    }
  }

  private resolvePlaceKickVisualTransform(
    placement: PlaceKickFormationParticipantPlacement,
  ): {
    animationSpeedYardsPerSecond: number;
    facingRadians: number;
    position: { x: number; z: number };
  } {
    if (placement.slotId !== 'kicker' || !this.placeKickState) {
      return {
        animationSpeedYardsPerSecond: 0,
        facingRadians: placement.facingRadians,
        position: placement.position,
      };
    }

    const progress = this.getKickerApproachProgress();
    if (progress <= 0) {
      return {
        animationSpeedYardsPerSecond: 0,
        facingRadians: placement.facingRadians,
        position: placement.position,
      };
    }

    const holderSpot = this.placeKickState.holderSpot;
    const dx = holderSpot.x - placement.position.x;
    const dz = holderSpot.z - placement.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0.001) {
      return {
        animationSpeedYardsPerSecond: 0,
        facingRadians: placement.facingRadians,
        position: placement.position,
      };
    }

    const stopDistance = Math.max(0, distance - PLACE_KICK_KICKER_ANIMATION_CONFIG.approachStopDistanceYards);
    const travelScale = stopDistance / distance;
    const easedProgress = easeOutCubic(progress);
    const x = placement.position.x + dx * travelScale * easedProgress;
    const z = placement.position.z + dz * travelScale * easedProgress;
    const moving =
      this.phase === 'runUp' &&
      this.elapsedInPhaseSeconds < PLACE_KICK_PRESENTATION_CONFIG.runUpSeconds;

    return {
      animationSpeedYardsPerSecond: moving
        ? Math.max(
            PLACE_KICK_KICKER_ANIMATION_CONFIG.movingSpeedFloorYardsPerSecond,
            stopDistance / PLACE_KICK_PRESENTATION_CONFIG.runUpSeconds,
          )
        : 0,
      facingRadians: Math.atan2(dx, dz),
      position: { x, z },
    };
  }

  private getKickerApproachProgress(): number {
    if (
      this.phase === 'contact' ||
      this.phase === 'flight' ||
      this.phase === 'result' ||
      this.phase === 'completed'
    ) {
      return 1;
    }

    if (this.phase !== 'runUp') {
      return 0;
    }

    return Math.min(1, this.elapsedInPhaseSeconds / PLACE_KICK_PRESENTATION_CONFIG.runUpSeconds);
  }

  private resolveKickerKickAnimationProgress(
    placement: PlaceKickFormationParticipantPlacement,
  ): number | null {
    if (placement.slotId !== 'kicker') {
      return null;
    }

    if (this.phase === 'runUp') {
      return Math.min(
        0.86,
        this.elapsedInPhaseSeconds / PLACE_KICK_PRESENTATION_CONFIG.runUpSeconds,
      );
    }

    if (this.phase === 'contact') {
      return 0.92;
    }

    if (
      this.phase === 'flight' &&
      this.flightElapsedSeconds <= PLACE_KICK_KICKER_ANIMATION_CONFIG.contactFollowThroughSeconds
    ) {
      const followThroughProgress =
        this.flightElapsedSeconds /
        PLACE_KICK_KICKER_ANIMATION_CONFIG.contactFollowThroughSeconds;
      return Math.min(1, 0.92 + followThroughProgress * 0.08);
    }

    return null;
  }

  private findKickerVisualResource(): FootballPlayerVisualResources | null {
    const kickerPlacement = this.placeKickLayout?.participants.find((participant) => participant.slotId === 'kicker');
    return kickerPlacement ? this.placeKickVisuals.get(kickerPlacement.visualId) ?? null : null;
  }
}

function easeOutCubic(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return 1 - Math.pow(1 - t, 3);
}

function cloneResult(result: PlaceKickResult): PlaceKickResult {
  return {
    ...result,
    goalPlanePosition: { ...result.goalPlanePosition },
    origin: { ...result.origin },
    target: { ...result.target },
    timingInput: { ...result.timingInput },
  };
}
