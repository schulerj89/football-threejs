import type { PresentationAudioEvent } from '../audio/PresentationEventBridge';
import type { GameplaySnapshot, PlayState } from '../playState';
import type {
  CameraShotPolicy,
  CinematicsSetting,
  FieldPlaneBounds,
  PresentationCameraConfig,
  PresentationCameraPhase,
  PresentationCameraUpdateOptions,
  PresentationOrbitShotName,
} from './CameraTypes';
import { isPresentationShotAllowed } from './CameraShotPolicy';
import type { ActiveOrbitShot, PresentationCameraShot } from './PresentationShotDefinitions';
import { PresentationShotFactory } from './PresentationShotDefinitions';

export class PresentationShotSequencer {
  private activeOrbitShot: ActiveOrbitShot | null = null;
  private readonly completedEventShotKeys = new Set<string>();
  private completedPreviewShotName: PresentationOrbitShotName | null = null;
  private currentPreSnapAnchorKey: string | null = null;
  private lastCompletedTouchdownResultId: number | null = null;
  private phase: PresentationCameraPhase = 'preSnapEstablish';
  private phaseElapsedSeconds = 0;
  private previousPlayState: PlayState | null = null;
  private preSnapSequenceId = 0;
  private returnToPreSnapSeconds = 0;
  private transitionToGameplaySeconds = 0;

  constructor(
    private readonly config: PresentationCameraConfig,
    private readonly cinematics: CinematicsSetting,
    private readonly shotPreview: PresentationOrbitShotName | null,
    private readonly shotFactory: PresentationShotFactory,
  ) {}

  get currentPhase(): PresentationCameraPhase {
    return this.phase;
  }

  get currentPreSnapSequenceId(): number {
    return this.preSnapSequenceId;
  }

  reset(): void {
    this.activeOrbitShot = null;
    this.completedEventShotKeys.clear();
    this.completedPreviewShotName = null;
    this.currentPreSnapAnchorKey = null;
    this.lastCompletedTouchdownResultId = null;
    this.phase = 'preSnapEstablish';
    this.phaseElapsedSeconds = 0;
    this.previousPlayState = null;
    this.preSnapSequenceId = 0;
    this.returnToPreSnapSeconds = 0;
    this.transitionToGameplaySeconds = 0;
  }

  hasActiveOrbitShot(): boolean {
    return this.activeOrbitShot !== null;
  }

  skipActiveShot(): boolean {
    if (!this.activeOrbitShot) {
      return false;
    }

    this.markOrbitShotCompleted(this.activeOrbitShot);
    this.activeOrbitShot = null;
    return true;
  }

  updateTransitionTimers(snapshot: GameplaySnapshot, deltaSeconds: number): void {
    if (snapshot.playState === 'preSnap') {
      const anchorKey = createPreSnapAnchorKey(snapshot);
      if (this.previousPlayState !== 'preSnap' || anchorKey !== this.currentPreSnapAnchorKey) {
        this.preSnapSequenceId += 1;
        this.currentPreSnapAnchorKey = anchorKey;
      }
    } else {
      this.currentPreSnapAnchorKey = null;
    }

    if (this.previousPlayState === 'preSnap' && snapshot.playState === 'live') {
      this.transitionToGameplaySeconds = this.config.phases.transitionToGameplay.shotDuration;
    }

    if (this.previousPlayState === 'dead' && snapshot.playState === 'preSnap') {
      this.returnToPreSnapSeconds = this.config.phases.returnToPreSnap.shotDuration;
    }

    this.transitionToGameplaySeconds = Math.max(0, this.transitionToGameplaySeconds - deltaSeconds);
    this.returnToPreSnapSeconds = Math.max(0, this.returnToPreSnapSeconds - deltaSeconds);
  }

  updateOrbitShot(
    snapshot: GameplaySnapshot,
    formationBounds: FieldPlaneBounds,
    deltaSeconds: number,
    options: PresentationCameraUpdateOptions,
  ): PresentationCameraShot | null {
    const policy = this.resolveShotPolicy(options);

    if (
      this.activeOrbitShot &&
      !this.activeOrbitShot.preview &&
      !isPresentationShotAllowed(this.activeOrbitShot.name, policy)
    ) {
      this.activeOrbitShot = null;
    }

    if (this.activeOrbitShot?.name === 'prePlayOrbit180' && snapshot.playState !== 'preSnap') {
      this.markOrbitShotCompleted(this.activeOrbitShot);
      this.activeOrbitShot = null;
    }

    if (!this.activeOrbitShot) {
      this.maybeStartOrbitShot(snapshot, formationBounds, options, policy);
    }

    if (!this.activeOrbitShot) {
      return null;
    }

    this.activeOrbitShot.elapsedSeconds += deltaSeconds;
    return this.shotFactory.createOrbitShot(
      snapshot,
      formationBounds,
      this.activeOrbitShot,
      options.aspectRatio ?? 16 / 9,
      options.restoreCameraMode ?? null,
    );
  }

  useOrbitPhase(phase: PresentationCameraPhase): void {
    this.phase = phase;
  }

  selectNextPhase(snapshot: GameplaySnapshot): PresentationCameraPhase {
    const nextPhase = this.selectPhase(snapshot);

    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      this.phaseElapsedSeconds = 0;
    } else {
      this.phaseElapsedSeconds += 0;
    }

    return this.phase;
  }

  advancePhaseElapsed(deltaSeconds: number): void {
    this.phaseElapsedSeconds += deltaSeconds;
  }

  completeOrbitShotIfFinished(shot: PresentationCameraShot): void {
    if (!this.activeOrbitShot || shot.shotProgress === null || shot.shotProgress < 1) {
      return;
    }

    const completedShot = this.activeOrbitShot;
    this.markOrbitShotCompleted(completedShot);

    if (completedShot.preview) {
      this.activeOrbitShot = null;
      return;
    }

    if (
      completedShot.name === 'touchdownCrowdCutaway' &&
      completedShot.resultId !== undefined &&
      !this.completedEventShotKeys.has(`touchdownOrbit360:${completedShot.resultId}`)
    ) {
      this.activeOrbitShot = {
        elapsedSeconds: 0,
        key: String(completedShot.resultId),
        lockedCenter: completedShot.resultCenter,
        name: 'touchdownOrbit360',
        preview: false,
        resultId: completedShot.resultId,
      };
      return;
    }

    this.activeOrbitShot = null;
  }

  finishUpdate(playState: PlayState): void {
    this.previousPlayState = playState;
  }

  private selectPhase(snapshot: GameplaySnapshot): PresentationCameraPhase {
    if (snapshot.playState === 'preSnap') {
      if (this.returnToPreSnapSeconds > 0) {
        return 'returnToPreSnap';
      }

      if (this.config.holdPreSnapEstablish) {
        return 'preSnapEstablish';
      }

      if (
        this.phase === 'preSnapEstablish' &&
        this.phaseElapsedSeconds < this.config.phases.preSnapEstablish.shotDuration
      ) {
        return 'preSnapEstablish';
      }

      return 'transitionToGameplay';
    }

    if (snapshot.playState === 'live') {
      if (snapshot.ball.state.kind === 'inFlight') {
        return 'passFlight';
      }

      if (this.transitionToGameplaySeconds > 0) {
        return 'transitionToGameplay';
      }

      return 'liveCarrier';
    }

    if (snapshot.lastPlayResult?.type === 'touchdown') {
      return 'touchdownResult';
    }

    return 'deadBallResult';
  }

  private maybeStartOrbitShot(
    snapshot: GameplaySnapshot,
    _formationBounds: FieldPlaneBounds,
    options: PresentationCameraUpdateOptions,
    policy: CameraShotPolicy,
  ): void {
    if (this.shotPreview) {
      if (this.completedPreviewShotName === this.shotPreview) {
        return;
      }

      this.activeOrbitShot = {
        elapsedSeconds: 0,
        key: `preview:${this.shotPreview}`,
        name: this.shotPreview,
        preview: true,
      };
      return;
    }

    const cutawayEvent = selectHighestPriorityCutawayEvent(options.presentationEvents ?? []);
    if (
      cutawayEvent &&
      snapshot.playState === 'dead' &&
      this.cinematics === 'full' &&
      options.crowdCutawaysEnabled !== false &&
      policy.allowCrowdCutaway
    ) {
      const cutawayName = cutawayEvent.type === 'touchdown'
        ? 'touchdownCrowdCutaway'
        : 'firstDownCrowdCutaway';
      const cutawayKey = `${cutawayName}:${cutawayEvent.id}`;

      if (!this.completedEventShotKeys.has(cutawayKey)) {
        this.activeOrbitShot = {
          elapsedSeconds: 0,
          key: cutawayKey,
          lockedCenter: this.shotFactory.createCrowdCutawayCenter(cutawayEvent, snapshot),
          name: cutawayName,
          preview: false,
          resultCenter: this.shotFactory.createResultSpotCenter(cutawayEvent, snapshot),
          resultId: cutawayEvent.playResult?.id,
        };
        return;
      }
    }

    if (this.cinematics === 'off') {
      return;
    }

    if (snapshot.playState === 'preSnap') {
      if (!policy.allowPrePlayOrbit) {
        return;
      }

      const prePlayKey = `prePlayOrbit180:${createPreSnapAnchorKey(snapshot)}`;
      if (!this.completedEventShotKeys.has(prePlayKey)) {
        this.activeOrbitShot = {
          elapsedSeconds: 0,
          key: prePlayKey,
          lockedCenter: this.shotFactory.createPrePlayOrbitCenter(snapshot),
          name: 'prePlayOrbit180',
          preview: false,
        };
      }
      return;
    }

    const touchdownResultId = snapshot.lastPlayResult?.type === 'touchdown'
      ? snapshot.lastPlayResult.id
      : null;
    if (
      snapshot.playState === 'dead' &&
      policy.allowPostPlayOrbit &&
      touchdownResultId !== null &&
      touchdownResultId !== this.lastCompletedTouchdownResultId
    ) {
      this.activeOrbitShot = {
        elapsedSeconds: 0,
        key: String(touchdownResultId),
        lockedCenter: this.shotFactory.createTouchdownOrbitCenter(snapshot),
        name: 'touchdownOrbit360',
        preview: false,
        resultId: touchdownResultId,
      };
    }
  }

  private resolveShotPolicy(options: PresentationCameraUpdateOptions): CameraShotPolicy {
    return options.cameraShotPolicy ?? {
      allowCrowdCutaway: this.cinematics === 'full',
      allowPerspectiveOverride: this.cinematics !== 'off',
      allowPostPlayOrbit: this.cinematics !== 'off',
      allowPrePlayOrbit: false,
      allowSubtleSettle: true,
    };
  }

  private markOrbitShotCompleted(activeShot: ActiveOrbitShot): void {
    if (activeShot.preview) {
      this.completedPreviewShotName = activeShot.name;
      return;
    }

    if (
      activeShot.name === 'firstDownCrowdCutaway' ||
      activeShot.name === 'touchdownCrowdCutaway'
    ) {
      this.completedEventShotKeys.add(activeShot.key);
      return;
    }

    if (activeShot.name === 'prePlayOrbit180') {
      this.completedEventShotKeys.add(activeShot.key);
      return;
    }

    this.completedEventShotKeys.add(`${activeShot.name}:${activeShot.resultId ?? activeShot.key}`);
    this.lastCompletedTouchdownResultId = activeShot.resultId ?? Number(activeShot.key);
  }
}

function createPreSnapAnchorKey(snapshot: GameplaySnapshot): string {
  return [
    snapshot.playbookId,
    snapshot.snapLane,
    snapshot.nextSnapSpot.x.toFixed(2),
    snapshot.nextSnapSpot.z.toFixed(2),
    snapshot.drive.currentDown,
    snapshot.drive.yardsToFirstDown.toFixed(2),
    snapshot.score,
  ].join('|');
}

function selectHighestPriorityCutawayEvent(
  events: readonly PresentationAudioEvent[],
): PresentationAudioEvent | null {
  let selected: PresentationAudioEvent | null = null;
  let selectedPriority = 0;

  for (const event of events) {
    const priority = event.type === 'touchdown'
      ? 2
      : event.type === 'firstDown'
        ? 1
        : 0;

    if (priority > selectedPriority) {
      selected = event;
      selectedPriority = priority;
    }
  }

  return selected;
}
