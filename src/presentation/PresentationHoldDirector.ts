import type {
  BroadcastCommentarySnapshot,
} from '../audio/BroadcastCommentaryDirector';
import type {
  PresentationAudioEvent,
  PresentationAudioEventType,
} from '../audio/PresentationEventBridge';
import type { CinematicsSetting } from '../camera/PresentationCameraDirector';
import type { GameplayCameraDebugSnapshot } from '../camera/GameplayCameraController';
import type { PresentationOrbitShotName } from '../camera/CameraTypes';

export type PresentationHoldReason = 'firstDown' | 'touchdown';

export interface TouchdownPresentationStatus {
  blockedReason: TouchdownPresentationBlockReason | null;
  cameraComplete: boolean;
  commentaryClip: string | null;
  commentaryComplete: boolean;
  commentaryExpected: boolean;
  commentaryRemainingSeconds: number;
  commentaryStarted: boolean;
  commentaryUnavailable: boolean;
  crowdMinimumComplete: boolean;
  currentShot: PresentationOrbitShotName | null;
  elapsedSeconds: number;
  maximumTimeReached: boolean;
  minimumHoldSeconds: number;
  minimumTimeComplete: boolean;
  releaseReason: TouchdownPresentationReleaseReason | null;
  resultId: string;
}

export type TouchdownPresentationBlockReason =
  | 'camera'
  | 'commentary'
  | 'crowdMinimum'
  | 'minimumTime';

export type TouchdownPresentationReleaseReason =
  | 'complete'
  | 'maximumTimeReached'
  | 'skipped';

export interface PresentationHoldSnapshot {
  active: boolean;
  duplicateSuppressionCount: number;
  history: PresentationHoldHistoryEntry[];
  reason: PresentationHoldReason | null;
  remainingSeconds: number;
  skippedCount: number;
  touchdown: TouchdownPresentationStatus | null;
}

export interface PresentationHoldHistoryEntry {
  eventId: string;
  eventType: PresentationAudioEventType;
  reason:
    | 'cinematicsOff'
    | 'duplicateEvent'
    | 'notFullCinematics'
    | 'released'
    | 'skipped'
    | 'unsupportedEvent'
    | null;
  status: 'released' | 'started' | 'suppressed';
}

export interface PresentationHoldUpdateOptions {
  commentary?: BroadcastCommentarySnapshot | null;
}

export interface PresentationHoldConfig {
  firstDownHoldSeconds: number;
  historyLimit: number;
  touchdownBriefMinimumSeconds: number;
  touchdownCommentaryTailSeconds: number;
  touchdownCrowdMinimumSeconds: number;
  touchdownFullMinimumSeconds: number;
  touchdownSafetyMaximumSeconds: number;
}

interface ActivePresentationHold {
  commentaryCompletionObservedSeconds: number | null;
  currentShot: PresentationOrbitShotName | null;
  elapsedSeconds: number;
  eventId: string;
  reason: PresentationHoldReason;
  releaseReason: TouchdownPresentationReleaseReason | null;
  remainingSeconds: number;
  resultId: string;
  touchdownStatus: TouchdownPresentationStatus | null;
}

const DEFAULT_PRESENTATION_HOLD_CONFIG: PresentationHoldConfig = {
  firstDownHoldSeconds: 1.25,
  historyLimit: 20,
  touchdownBriefMinimumSeconds: 4.5,
  touchdownCommentaryTailSeconds: 0.4,
  touchdownCrowdMinimumSeconds: 3,
  touchdownFullMinimumSeconds: 5.5,
  touchdownSafetyMaximumSeconds: 10,
};

const HOLD_EVENT_PRIORITIES: Partial<Record<PresentationAudioEventType, number>> = {
  firstDown: 1,
  touchdown: 2,
};

export class PresentationHoldDirector {
  private activeHold: ActivePresentationHold | null = null;
  private duplicateSuppressionCount = 0;
  private readonly history: PresentationHoldHistoryEntry[] = [];
  private readonly processedEventIds = new Set<string>();
  private readonly config: PresentationHoldConfig;
  private skippedCount = 0;
  private lastTouchdownStatus: TouchdownPresentationStatus | null = null;

  constructor(
    private readonly cinematics: CinematicsSetting,
    config: Partial<PresentationHoldConfig> = {},
  ) {
    this.config = {
      ...DEFAULT_PRESENTATION_HOLD_CONFIG,
      ...config,
    };
  }

  update(
    events: readonly PresentationAudioEvent[],
    deltaSeconds: number,
    options: PresentationHoldUpdateOptions = {},
  ): void {
    this.advanceActiveHold(deltaSeconds, options);

    const event = selectHighestPriorityHoldEvent(events);
    if (!event) {
      return;
    }

    if (this.processedEventIds.has(event.id)) {
      this.duplicateSuppressionCount += 1;
      this.recordHistory(event, 'suppressed', 'duplicateEvent');
      return;
    }

    this.processedEventIds.add(event.id);

    if (event.type === 'firstDown') {
      this.startFirstDownHold(event);
      return;
    }

    if (event.type === 'touchdown') {
      this.startTouchdownHold(event, options.commentary ?? null);
      return;
    }

    this.recordHistory(event, 'suppressed', 'unsupportedEvent');
  }

  updateCameraState(camera: GameplayCameraDebugSnapshot): void {
    if (!this.activeHold || this.activeHold.reason !== 'touchdown') {
      return;
    }

    this.activeHold.currentShot = isTouchdownCameraShot(camera.activeShotName ?? null)
      ? camera.activeShotName ?? null
      : null;
    if (this.activeHold.touchdownStatus) {
      const nextStatus = {
        ...this.activeHold.touchdownStatus,
        cameraComplete: this.activeHold.currentShot === null,
        currentShot: this.activeHold.currentShot,
      };
      this.activeHold.touchdownStatus = {
        ...nextStatus,
        blockedReason: resolveTouchdownBlockReason(nextStatus),
      };
      this.lastTouchdownStatus = this.activeHold.touchdownStatus;
    }
  }

  skip(): boolean {
    if (!this.activeHold) {
      return false;
    }

    this.activeHold.releaseReason = 'skipped';
    this.recordHistoryForActiveHold('suppressed', 'skipped');
    this.lastTouchdownStatus = this.activeHold.touchdownStatus
      ? {
        ...this.activeHold.touchdownStatus,
        blockedReason: null,
        releaseReason: 'skipped',
      }
      : this.lastTouchdownStatus;
    this.activeHold = null;
    this.skippedCount += 1;
    return true;
  }

  shouldHoldDeadPlayReset(): boolean {
    return this.activeHold !== null && (
      this.activeHold.reason === 'touchdown' ||
      this.activeHold.remainingSeconds > 0
    );
  }

  getSnapshot(): PresentationHoldSnapshot {
    return {
      active: this.shouldHoldDeadPlayReset(),
      duplicateSuppressionCount: this.duplicateSuppressionCount,
      history: this.history.map((entry) => ({ ...entry })),
      reason: this.activeHold?.reason ?? null,
      remainingSeconds: this.activeHold ? this.calculateRemainingSeconds(this.activeHold) : 0,
      skippedCount: this.skippedCount,
      touchdown: this.activeHold?.touchdownStatus
        ? { ...this.activeHold.touchdownStatus }
        : this.lastTouchdownStatus
          ? { ...this.lastTouchdownStatus }
          : null,
    };
  }

  private startFirstDownHold(event: PresentationAudioEvent): void {
    if (this.cinematics === 'off') {
      this.recordHistory(event, 'suppressed', 'cinematicsOff');
      return;
    }

    if (this.cinematics !== 'full') {
      this.recordHistory(event, 'suppressed', 'notFullCinematics');
      return;
    }

    this.activeHold = {
      currentShot: null,
      commentaryCompletionObservedSeconds: null,
      elapsedSeconds: 0,
      eventId: event.id,
      reason: 'firstDown',
      releaseReason: null,
      remainingSeconds: this.config.firstDownHoldSeconds,
      resultId: String(event.playResult?.id ?? event.id),
      touchdownStatus: null,
    };
    this.recordHistory(event, 'started', null);
  }

  private startTouchdownHold(
    event: PresentationAudioEvent,
    commentary: BroadcastCommentarySnapshot | null,
  ): void {
    const hold: ActivePresentationHold = {
      currentShot: null,
      commentaryCompletionObservedSeconds: null,
      elapsedSeconds: 0,
      eventId: event.id,
      reason: 'touchdown',
      releaseReason: null,
      remainingSeconds: this.getTouchdownMinimumSeconds(),
      resultId: String(event.playResult?.id ?? event.id),
      touchdownStatus: null,
    };
    hold.touchdownStatus = this.createTouchdownStatus(hold, commentary);
    this.activeHold = hold;
    this.lastTouchdownStatus = hold.touchdownStatus;
    this.recordHistory(event, 'started', null);
  }

  private advanceActiveHold(
    deltaSeconds: number,
    options: PresentationHoldUpdateOptions,
  ): void {
    if (!this.activeHold) {
      return;
    }

    const delta = Math.max(0, deltaSeconds);
    this.activeHold.elapsedSeconds += delta;

    if (this.activeHold.reason === 'firstDown') {
      this.activeHold.remainingSeconds = Math.max(0, this.activeHold.remainingSeconds - delta);
      if (this.activeHold.remainingSeconds === 0) {
        this.recordHistoryForActiveHold('released', 'released');
        this.activeHold = null;
      }
      return;
    }

    const status = this.createTouchdownStatus(this.activeHold, options.commentary ?? null);
    this.activeHold.touchdownStatus = status;
    this.lastTouchdownStatus = status;

    if (status.maximumTimeReached || status.blockedReason === null) {
      const releaseReason = status.maximumTimeReached ? 'maximumTimeReached' : 'complete';
      this.activeHold.releaseReason = releaseReason;
      this.lastTouchdownStatus = {
        ...status,
        releaseReason,
      };
      this.recordHistoryForActiveHold('released', 'released');
      this.activeHold = null;
    }
  }

  private createTouchdownStatus(
    hold: ActivePresentationHold,
    commentary: BroadcastCommentarySnapshot | null,
  ): TouchdownPresentationStatus {
    const elapsed = hold.elapsedSeconds;
    const minimumHoldSeconds = this.getTouchdownMinimumSeconds();
    const commentaryState = resolveTouchdownCommentaryState(
      hold.eventId,
      commentary,
      this.config.touchdownCommentaryTailSeconds,
    );
    if (
      commentaryState.complete &&
      commentaryState.expected &&
      !commentaryState.unavailable &&
      hold.commentaryCompletionObservedSeconds === null
    ) {
      hold.commentaryCompletionObservedSeconds = elapsed;
    }
    const commentaryTailRemainingSeconds =
      commentaryState.complete &&
      commentaryState.expected &&
      !commentaryState.unavailable &&
      hold.commentaryCompletionObservedSeconds !== null
        ? Math.max(
          0,
          this.config.touchdownCommentaryTailSeconds -
            (elapsed - hold.commentaryCompletionObservedSeconds),
        )
        : commentaryState.remainingSeconds;
    const commentaryComplete = commentaryState.unavailable ||
      !commentaryState.expected ||
      (commentaryState.complete && commentaryTailRemainingSeconds === 0);
    const statusWithoutBlock: Omit<TouchdownPresentationStatus, 'blockedReason'> = {
      cameraComplete: hold.currentShot === null,
      commentaryClip: commentaryState.clipId,
      commentaryComplete,
      commentaryExpected: commentaryState.expected,
      commentaryRemainingSeconds: commentaryTailRemainingSeconds,
      commentaryStarted: commentaryState.started,
      commentaryUnavailable: commentaryState.unavailable,
      crowdMinimumComplete: elapsed >= this.config.touchdownCrowdMinimumSeconds,
      currentShot: hold.currentShot,
      elapsedSeconds: elapsed,
      maximumTimeReached: elapsed >= this.config.touchdownSafetyMaximumSeconds,
      minimumHoldSeconds,
      minimumTimeComplete: elapsed >= minimumHoldSeconds,
      releaseReason: hold.releaseReason,
      resultId: hold.resultId,
    };

    return {
      ...statusWithoutBlock,
      blockedReason: resolveTouchdownBlockReason(statusWithoutBlock),
    };
  }

  private getTouchdownMinimumSeconds(): number {
    return this.cinematics === 'full'
      ? this.config.touchdownFullMinimumSeconds
      : this.config.touchdownBriefMinimumSeconds;
  }

  private calculateRemainingSeconds(hold: ActivePresentationHold): number {
    if (hold.reason === 'firstDown') {
      return hold.remainingSeconds;
    }

    const status = hold.touchdownStatus;
    if (!status) {
      return this.getTouchdownMinimumSeconds();
    }

    if (status.maximumTimeReached || status.blockedReason === null) {
      return 0;
    }

    return Math.max(
      0,
      status.minimumHoldSeconds - status.elapsedSeconds,
      this.config.touchdownCrowdMinimumSeconds - status.elapsedSeconds,
      status.commentaryRemainingSeconds,
    );
  }

  private recordHistoryForActiveHold(
    status: PresentationHoldHistoryEntry['status'],
    reason: PresentationHoldHistoryEntry['reason'],
  ): void {
    if (!this.activeHold) {
      return;
    }

    this.history.unshift({
      eventId: this.activeHold.eventId,
      eventType: this.activeHold.reason,
      reason,
      status,
    });
    this.history.splice(this.config.historyLimit);
  }

  private recordHistory(
    event: PresentationAudioEvent,
    status: PresentationHoldHistoryEntry['status'],
    reason: PresentationHoldHistoryEntry['reason'],
  ): void {
    this.history.unshift({
      eventId: event.id,
      eventType: event.type,
      reason,
      status,
    });
    this.history.splice(this.config.historyLimit);
  }
}

function resolveTouchdownCommentaryState(
  eventId: string,
  commentary: BroadcastCommentarySnapshot | null,
  tailSeconds: number,
): {
  clipId: string | null;
  complete: boolean;
  expected: boolean;
  remainingSeconds: number;
  started: boolean;
  unavailable: boolean;
} {
  if (!commentary?.enabled) {
    return {
      clipId: null,
      complete: true,
      expected: false,
      remainingSeconds: 0,
      started: false,
      unavailable: true,
    };
  }

  const currentClip = commentary.currentClip?.eventId === eventId
    ? commentary.currentClip
    : null;
  const queuedClip = commentary.queue.find((entry) => entry.eventId === eventId) ?? null;
  const completed = commentary.playback.completedEventIds.includes(eventId);
  const failed = commentary.playback.failedEventIds.includes(eventId) ||
    commentary.eventHistory.some((entry) =>
      entry.eventId === eventId &&
      entry.status === 'suppressed' &&
      (
        entry.reason === 'audioDisabled' ||
        entry.reason === 'announcerDisabled' ||
        entry.reason === 'missingAsset' ||
        entry.reason === 'muted' ||
        entry.reason === 'noCandidate' ||
        entry.reason === 'pageHidden' ||
        entry.reason === 'suspended'
      ),
    );
  const started = !!currentClip || completed ||
    commentary.eventHistory.some((entry) =>
      entry.eventId === eventId &&
      (entry.status === 'started' || entry.status === 'played'),
    );

  if (failed) {
    return {
      clipId: currentClip?.assetId ?? queuedClip?.assetId ?? null,
      complete: true,
      expected: true,
      remainingSeconds: 0,
      started,
      unavailable: true,
    };
  }

  if (currentClip) {
    return {
      clipId: currentClip.assetId,
      complete: false,
      expected: true,
      remainingSeconds: commentary.playback.remainingDuration + tailSeconds,
      started: true,
      unavailable: false,
    };
  }

  if (queuedClip) {
    return {
      clipId: queuedClip.assetId,
      complete: false,
      expected: true,
      remainingSeconds: queuedClip.eventType === 'touchdown' ? tailSeconds : 0,
      started,
      unavailable: false,
    };
  }

  if (completed) {
    return {
      clipId: null,
      complete: true,
      expected: true,
      remainingSeconds: tailSeconds,
      started: true,
      unavailable: false,
    };
  }

  return {
    clipId: null,
    complete: false,
    expected: true,
    remainingSeconds: tailSeconds,
    started,
    unavailable: false,
  };
}

function resolveTouchdownBlockReason(
  status: Omit<TouchdownPresentationStatus, 'blockedReason'>,
): TouchdownPresentationBlockReason | null {
  if (status.maximumTimeReached) {
    return null;
  }

  if (!status.minimumTimeComplete) {
    return 'minimumTime';
  }

  if (!status.cameraComplete) {
    return 'camera';
  }

  if (status.commentaryExpected && !status.commentaryComplete && !status.commentaryUnavailable) {
    return 'commentary';
  }

  if (!status.crowdMinimumComplete) {
    return 'crowdMinimum';
  }

  return null;
}

function isTouchdownCameraShot(
  activeShotName: PresentationOrbitShotName | null,
): activeShotName is 'touchdownCrowdCutaway' | 'touchdownOrbit360' {
  return activeShotName === 'touchdownCrowdCutaway' || activeShotName === 'touchdownOrbit360';
}

function selectHighestPriorityHoldEvent(
  events: readonly PresentationAudioEvent[],
): PresentationAudioEvent | null {
  let selected: PresentationAudioEvent | null = null;
  let selectedPriority = 0;

  for (const event of events) {
    const priority = HOLD_EVENT_PRIORITIES[event.type] ?? 0;
    if (priority > selectedPriority) {
      selected = event;
      selectedPriority = priority;
    }
  }

  return selected;
}
