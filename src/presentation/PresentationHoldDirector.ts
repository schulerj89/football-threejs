import type {
  PresentationAudioEvent,
  PresentationAudioEventType,
} from '../audio/PresentationEventBridge';
import type { CinematicsSetting } from '../camera/PresentationCameraDirector';

export type PresentationHoldReason = 'firstDown' | 'touchdown';

export interface PresentationHoldSnapshot {
  active: boolean;
  duplicateSuppressionCount: number;
  history: PresentationHoldHistoryEntry[];
  reason: PresentationHoldReason | null;
  remainingSeconds: number;
  skippedCount: number;
}

export interface PresentationHoldHistoryEntry {
  eventId: string;
  eventType: PresentationAudioEventType;
  reason:
    | 'cinematicsOff'
    | 'duplicateEvent'
    | 'notFullCinematics'
    | 'skipped'
    | 'unsupportedEvent'
    | null;
  status: 'started' | 'suppressed';
}

interface ActivePresentationHold {
  eventId: string;
  reason: PresentationHoldReason;
  remainingSeconds: number;
}

const PRESENTATION_HOLD_CONFIG = {
  firstDownHoldSeconds: 1.25,
  historyLimit: 20,
  touchdownHoldSeconds: 3,
} as const;

const HOLD_EVENT_PRIORITIES: Partial<Record<PresentationAudioEventType, number>> = {
  firstDown: 1,
  touchdown: 2,
};

export class PresentationHoldDirector {
  private activeHold: ActivePresentationHold | null = null;
  private duplicateSuppressionCount = 0;
  private readonly history: PresentationHoldHistoryEntry[] = [];
  private readonly processedEventIds = new Set<string>();
  private skippedCount = 0;

  constructor(private readonly cinematics: CinematicsSetting) {}

  update(events: readonly PresentationAudioEvent[], deltaSeconds: number): void {
    if (this.activeHold) {
      this.activeHold.remainingSeconds = Math.max(
        0,
        this.activeHold.remainingSeconds - Math.max(0, deltaSeconds),
      );

      if (this.activeHold.remainingSeconds === 0) {
        this.activeHold = null;
      }
    }

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

    if (this.cinematics === 'off') {
      this.recordHistory(event, 'suppressed', 'cinematicsOff');
      return;
    }

    if (this.cinematics !== 'full') {
      this.recordHistory(event, 'suppressed', 'notFullCinematics');
      return;
    }

    if (event.type === 'firstDown') {
      this.activeHold = {
        eventId: event.id,
        reason: 'firstDown',
        remainingSeconds: PRESENTATION_HOLD_CONFIG.firstDownHoldSeconds,
      };
      this.recordHistory(event, 'started', null);
      return;
    }

    if (event.type === 'touchdown') {
      this.activeHold = {
        eventId: event.id,
        reason: 'touchdown',
        remainingSeconds: PRESENTATION_HOLD_CONFIG.touchdownHoldSeconds,
      };
      this.recordHistory(event, 'started', null);
      return;
    }

    this.recordHistory(event, 'suppressed', 'unsupportedEvent');
  }

  skip(): boolean {
    if (!this.activeHold) {
      return false;
    }

    this.history.unshift({
      eventId: this.activeHold.eventId,
      eventType: this.activeHold.reason,
      reason: 'skipped',
      status: 'suppressed',
    });
    this.history.splice(PRESENTATION_HOLD_CONFIG.historyLimit);
    this.activeHold = null;
    this.skippedCount += 1;
    return true;
  }

  shouldHoldDeadPlayReset(): boolean {
    return this.activeHold !== null && this.activeHold.remainingSeconds > 0;
  }

  getSnapshot(): PresentationHoldSnapshot {
    return {
      active: this.shouldHoldDeadPlayReset(),
      duplicateSuppressionCount: this.duplicateSuppressionCount,
      history: this.history.map((entry) => ({ ...entry })),
      reason: this.activeHold?.reason ?? null,
      remainingSeconds: this.activeHold?.remainingSeconds ?? 0,
      skippedCount: this.skippedCount,
    };
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
    this.history.splice(PRESENTATION_HOLD_CONFIG.historyLimit);
  }
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
