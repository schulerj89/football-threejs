import type {
  BroadcastCommentaryDirector,
  BroadcastCommentarySnapshot,
} from '../audio/BroadcastCommentaryDirector';
import type { GameAudioDirector, GameAudioDirectorSnapshot } from '../audio/GameAudioDirector';
import {
  derivePresentationAudioEvents,
  type PresentationAudioEvent,
  type PresentationAudioEventType,
} from '../audio/PresentationEventBridge';
import type { GameplayCameraDebugSnapshot } from '../camera/GameplayCameraController';
import type { GameplaySnapshot } from '../playState';
import type { FramePerformanceProfiler } from '../performance/FramePerformanceProfiler';
import type {
  CrowdPresentationController,
  CrowdPresentationSnapshot,
} from './CrowdPresentationController';
import type {
  PresentationHoldDirector,
  PresentationHoldSnapshot,
} from './PresentationHoldDirector';

export const PRESENTATION_EVENT_PRECEDENCE: Record<PresentationAudioEventType, number> = {
  touchdown: 60,
  turnoverOnDowns: 50,
  sack: 40,
  firstDown: 30,
  incomplete: 20,
  outOfBounds: 20,
  tackle: 10,
  passCaught: 0,
  ballSnapped: 0,
  challengeEnding: 0,
  playPrepared: 0,
  playReset: 0,
  playStarted: 0,
} as const;

export interface GamePresentationIntegrationHistoryEntry {
  announcerClip: string | null;
  cameraShot: string | null;
  caption: string | null;
  crowdAudio: string | null;
  crowdReaction: string | null;
  emittedEventIds: string[];
  emittedEventTypes: PresentationAudioEventType[];
  gameplayResultId: string | null;
  hold: {
    active: boolean;
    reason: string | null;
    remainingSeconds: number;
  };
  resetCompleted: boolean;
}

export interface GamePresentationRuntimeSnapshot {
  eventPrecedence: Record<PresentationAudioEventType, number>;
  history: GamePresentationIntegrationHistoryEntry[];
  recentEvents: PresentationAudioEvent[];
}

interface GamePresentationRuntimeOptions {
  commentaryDirector: BroadcastCommentaryDirector;
  gameAudioDirector: GameAudioDirector;
  getCrowdController: () => CrowdPresentationController | null;
  getHoldDirector: () => PresentationHoldDirector;
  historyLimit?: number;
}

interface GamePresentationRuntimeUpdateOptions {
  active: boolean;
  commentaryActive: boolean;
  profiler?: FramePerformanceProfiler;
}

const DEFAULT_HISTORY_LIMIT = 24;

export class GamePresentationRuntime {
  private readonly commentaryDirector: BroadcastCommentaryDirector;
  private readonly gameAudioDirector: GameAudioDirector;
  private readonly getCrowdController: () => CrowdPresentationController | null;
  private readonly getHoldDirector: () => PresentationHoldDirector;
  private readonly historyLimit: number;
  private readonly history: GamePresentationIntegrationHistoryEntry[] = [];
  private previousSnapshot: GameplaySnapshot | null = null;
  private recentEvents: readonly PresentationAudioEvent[] = Object.freeze([]);

  constructor({
    commentaryDirector,
    gameAudioDirector,
    getCrowdController,
    getHoldDirector,
    historyLimit = DEFAULT_HISTORY_LIMIT,
  }: GamePresentationRuntimeOptions) {
    this.commentaryDirector = commentaryDirector;
    this.gameAudioDirector = gameAudioDirector;
    this.getCrowdController = getCrowdController;
    this.getHoldDirector = getHoldDirector;
    this.historyLimit = historyLimit;
  }

  update(
    snapshot: GameplaySnapshot,
    deltaSeconds: number,
    options: GamePresentationRuntimeUpdateOptions,
  ): readonly PresentationAudioEvent[] {
    if (!options.active) {
      this.recentEvents = Object.freeze([]);
      return this.recentEvents;
    }

    if (options.profiler?.enabled) {
      options.profiler.measure('presentationEventProcessing', () => {
        this.processPresentationFrame(snapshot, deltaSeconds, options);
      });
    } else {
      this.processPresentationFrame(snapshot, deltaSeconds, options);
    }

    this.previousSnapshot = snapshot;
    this.recordIntegrationHistory(snapshot);
    return this.recentEvents;
  }

  private processPresentationFrame(
    snapshot: GameplaySnapshot,
    deltaSeconds: number,
    options: GamePresentationRuntimeUpdateOptions,
  ): void {
    const events = selectPresentationEventsByPrecedence(
      derivePresentationAudioEvents(this.previousSnapshot, snapshot),
    );
    this.recentEvents = Object.freeze(events.map((event) => Object.freeze({ ...event })));

    if (options.profiler?.enabled) {
      options.profiler.measure('audioUpdate', () => {
        this.gameAudioDirector.processEvents(snapshot, this.recentEvents, deltaSeconds);
        if (options.commentaryActive) {
          this.commentaryDirector.processEvents(this.recentEvents, deltaSeconds);
        }
      });
      this.getHoldDirector().update(this.recentEvents, deltaSeconds);
      options.profiler.measure('crowdBehaviorUpdate', () => {
        this.getCrowdController()?.update(
          snapshot,
          this.recentEvents,
          deltaSeconds,
          options.profiler,
        );
      });
      return;
    }

    this.gameAudioDirector.processEvents(snapshot, this.recentEvents, deltaSeconds);
    this.getHoldDirector().update(this.recentEvents, deltaSeconds);
    this.getCrowdController()?.update(snapshot, this.recentEvents, deltaSeconds);

    if (options.commentaryActive) {
      this.commentaryDirector.processEvents(this.recentEvents, deltaSeconds);
    }
  }

  skipPresentation(): boolean {
    const holdSkipped = this.getHoldDirector().skip();
    const crowdSkipped = this.getCrowdController()?.skipReactionHold() ?? false;
    return holdSkipped || crowdSkipped;
  }

  setPageActive(active: boolean): void {
    this.gameAudioDirector.setPageActive(active);
    this.commentaryDirector.setPageActive(active);
    this.getCrowdController()?.setPageActive(active);
  }

  recordCameraSnapshot(camera: GameplayCameraDebugSnapshot): void {
    if (this.history.length === 0) {
      return;
    }

    this.history[0] = {
      ...this.history[0],
      cameraShot: camera.activeShotName ?? camera.presentationPhase ?? camera.state,
    };
  }

  getRecentEvents(): readonly PresentationAudioEvent[] {
    return this.recentEvents.map((event) => ({ ...event }));
  }

  getSnapshot(): GamePresentationRuntimeSnapshot {
    return {
      eventPrecedence: { ...PRESENTATION_EVENT_PRECEDENCE },
      history: this.history.map((entry) => ({
        ...entry,
        emittedEventIds: [...entry.emittedEventIds],
        emittedEventTypes: [...entry.emittedEventTypes],
        hold: { ...entry.hold },
      })),
      recentEvents: this.getRecentEvents() as PresentationAudioEvent[],
    };
  }

  private recordIntegrationHistory(snapshot: GameplaySnapshot): void {
    if (this.recentEvents.length === 0) {
      return;
    }

    const eventIds = new Set(this.recentEvents.map((event) => event.id));
    const audioSnapshot = this.gameAudioDirector.getSnapshot();
    const commentarySnapshot = this.commentaryDirector.getSnapshot();
    const crowdSnapshot = this.getCrowdController()?.getSnapshot() ?? null;
    const holdSnapshot = this.getHoldDirector().getSnapshot();
    const gameplayResultId = findGameplayResultId(this.recentEvents, snapshot);

    this.history.unshift({
      announcerClip: resolveAnnouncerClip(commentarySnapshot, eventIds),
      cameraShot: null,
      caption: commentarySnapshot.currentCaption,
      crowdAudio: resolveCrowdAudio(audioSnapshot, eventIds),
      crowdReaction: resolveCrowdReaction(crowdSnapshot),
      emittedEventIds: [...eventIds],
      emittedEventTypes: this.recentEvents.map((event) => event.type),
      gameplayResultId,
      hold: {
        active: holdSnapshot.active,
        reason: holdSnapshot.reason,
        remainingSeconds: holdSnapshot.remainingSeconds,
      },
      resetCompleted: this.recentEvents.some((event) => event.type === 'playReset'),
    });
    this.history.splice(this.historyLimit);
  }
}

export function selectPresentationEventsByPrecedence(
  events: readonly PresentationAudioEvent[],
): PresentationAudioEvent[] {
  const highestPriorityByResultId = new Map<string, number>();

  for (const event of events) {
    const resultId = event.playResult ? String(event.playResult.id) : null;
    if (!resultId) {
      continue;
    }

    const priority = PRESENTATION_EVENT_PRECEDENCE[event.type] ?? 0;
    highestPriorityByResultId.set(
      resultId,
      Math.max(priority, highestPriorityByResultId.get(resultId) ?? 0),
    );
  }

  return events.filter((event) => {
    const resultId = event.playResult ? String(event.playResult.id) : null;
    if (!resultId) {
      return true;
    }

    const priority = PRESENTATION_EVENT_PRECEDENCE[event.type] ?? 0;
    return priority >= (highestPriorityByResultId.get(resultId) ?? 0);
  });
}

function findGameplayResultId(
  events: readonly PresentationAudioEvent[],
  snapshot: GameplaySnapshot,
): string | null {
  const eventResultId = events.find((event) => event.playResult)?.playResult?.id;
  if (eventResultId !== undefined) {
    return String(eventResultId);
  }

  if (events.some((event) => event.type === 'playReset')) {
    return snapshot.lastPlayResult ? String(snapshot.lastPlayResult.id) : null;
  }

  return null;
}

function resolveCrowdAudio(
  audioSnapshot: GameAudioDirectorSnapshot,
  eventIds: ReadonlySet<string>,
): string | null {
  const entry = audioSnapshot.eventHistory.find(
    (candidate) =>
      eventIds.has(candidate.eventId) &&
      candidate.status === 'played' &&
      candidate.assetId?.startsWith('crowd_'),
  );

  return entry?.assetId ?? null;
}

function resolveAnnouncerClip(
  commentarySnapshot: BroadcastCommentarySnapshot,
  eventIds: ReadonlySet<string>,
): string | null {
  if (commentarySnapshot.currentClip && eventIds.has(commentarySnapshot.currentClip.eventId)) {
    return commentarySnapshot.currentClip.assetId;
  }

  const queued = commentarySnapshot.queue.find((entry) => eventIds.has(entry.eventId));
  return queued?.assetId ?? null;
}

function resolveCrowdReaction(snapshot: CrowdPresentationSnapshot | null): string | null {
  if (!snapshot || !snapshot.reactionsEnabled || !snapshot.visualsEnabled) {
    return null;
  }

  return snapshot.reactionState;
}
