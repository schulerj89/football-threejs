import type {
  PresentationAudioEvent,
  PresentationAudioEventType,
} from '../audio/PresentationEventBridge';
import { CROWD_BENCHMARK_COUNTS } from './CrowdConfiguration';
import { stableHash } from './CrowdLayout';
import type { CrowdPreviewPlacement } from './CrowdTypes';

export type CrowdDensity = 'high' | 'low' | 'medium';

export type CrowdReactionState =
  | 'anticipation'
  | 'disappointment'
  | 'firstDown'
  | 'idle'
  | 'touchdown';

export interface CrowdPresentationSettings {
  crowdDensity: CrowdDensity;
  crowdReactionsEnabled: boolean;
  crowdVisualsEnabled: boolean;
}

export interface CrowdReactionHistoryEntry {
  eventId: string;
  eventType: PresentationAudioEventType;
  reason:
    | 'crowdReactionsDisabled'
    | 'duplicateEvent'
    | 'pageHidden'
    | 'supersededByTouchdown'
    | 'unsupportedEvent'
    | null;
  state: CrowdReactionState | null;
  status: 'started' | 'suppressed';
}

export interface ActiveCrowdReaction {
  durationSeconds: number;
  elapsedSeconds: number;
  eventId: string;
  participantRatio: number;
  state: Exclude<CrowdReactionState, 'anticipation' | 'idle'>;
}

export const CROWD_DENSITY_PRESETS: Record<CrowdDensity, number> = {
  high: CROWD_BENCHMARK_COUNTS[2],
  low: CROWD_BENCHMARK_COUNTS[0],
  medium: CROWD_BENCHMARK_COUNTS[1],
} as const;

export const DEFAULT_CROWD_PRESENTATION_SETTINGS: CrowdPresentationSettings = {
  crowdDensity: 'low',
  crowdReactionsEnabled: true,
  crowdVisualsEnabled: false,
};

export const CROWD_PRESENTATION_CONFIG = {
  disappointmentDurationSeconds: 2.1,
  disappointmentParticipantRatio: 0.42,
  firstDownDurationSeconds: 1.6,
  firstDownParticipantRatio: 0.34,
  maxDeltaSeconds: 0.1,
  reactionHistoryLimit: 20,
  reactionUpdateHz: 12,
  touchdownDurationSeconds: 3.5,
  touchdownParticipantRatio: 0.78,
} as const;

const REACTION_EVENT_PRIORITIES: Partial<Record<PresentationAudioEventType, number>> = {
  firstDown: 2,
  incomplete: 1,
  outOfBounds: 1,
  sack: 1,
  touchdown: 4,
  turnoverOnDowns: 3,
};

export class CrowdReactionSequencer {
  private activeReaction: ActiveCrowdReaction | null = null;
  private pageActive = true;
  private processedEventIds = new Set<string>();
  private readonly reactionHistory: CrowdReactionHistoryEntry[] = [];

  get active(): ActiveCrowdReaction | null {
    return this.activeReaction;
  }

  get isPageActive(): boolean {
    return this.pageActive;
  }

  setPageActive(active: boolean): void {
    this.pageActive = active;
  }

  skipReactionHold(): boolean {
    if (!this.activeReaction) {
      return false;
    }

    this.activeReaction = null;
    return true;
  }

  advance(deltaSeconds: number): void {
    if (!this.activeReaction) {
      return;
    }

    this.activeReaction.elapsedSeconds += deltaSeconds;
    if (this.activeReaction.elapsedSeconds >= this.activeReaction.durationSeconds) {
      this.activeReaction = null;
    }
  }

  processEvents(events: readonly PresentationAudioEvent[], reactionsEnabled: boolean): void {
    const event = selectHighestPriorityReactionEvent(events);

    if (!event) {
      return;
    }

    if (this.processedEventIds.has(event.id)) {
      this.recordHistory(event, null, 'suppressed', 'duplicateEvent');
      return;
    }

    this.processedEventIds.add(event.id);

    if (!this.pageActive) {
      this.recordHistory(event, null, 'suppressed', 'pageHidden');
      return;
    }

    if (!reactionsEnabled) {
      this.recordHistory(event, null, 'suppressed', 'crowdReactionsDisabled');
      return;
    }

    const reaction = createReactionForEvent(event);

    if (!reaction) {
      this.recordHistory(event, null, 'suppressed', 'unsupportedEvent');
      return;
    }

    if (event.type === 'touchdown' && this.activeReaction?.state === 'firstDown') {
      this.recordHistory(event, this.activeReaction.state, 'suppressed', 'supersededByTouchdown');
    }

    this.activeReaction = reaction;
    this.recordHistory(event, reaction.state, 'started', null);
  }

  resolveDisplayState(playState: 'dead' | 'live' | 'preSnap' | 'ready' | string): CrowdReactionState {
    if (this.activeReaction) {
      return this.activeReaction.state;
    }

    return playState === 'live' ? 'anticipation' : 'idle';
  }

  getHistory(): CrowdReactionHistoryEntry[] {
    return this.reactionHistory.map((entry) => ({ ...entry }));
  }

  private recordHistory(
    event: PresentationAudioEvent,
    state: CrowdReactionState | null,
    status: CrowdReactionHistoryEntry['status'],
    reason: CrowdReactionHistoryEntry['reason'],
  ): void {
    this.reactionHistory.unshift({
      eventId: event.id,
      eventType: event.type,
      reason,
      state,
      status,
    });
    this.reactionHistory.splice(CROWD_PRESENTATION_CONFIG.reactionHistoryLimit);
  }
}

export function normalizeCrowdPresentationSettings(
  settings: Partial<CrowdPresentationSettings>,
): CrowdPresentationSettings {
  return {
    crowdDensity: isCrowdDensity(settings.crowdDensity)
      ? settings.crowdDensity
      : DEFAULT_CROWD_PRESENTATION_SETTINGS.crowdDensity,
    crowdReactionsEnabled:
      settings.crowdReactionsEnabled ??
      DEFAULT_CROWD_PRESENTATION_SETTINGS.crowdReactionsEnabled,
    crowdVisualsEnabled:
      settings.crowdVisualsEnabled ??
      DEFAULT_CROWD_PRESENTATION_SETTINGS.crowdVisualsEnabled,
  };
}

export function applyCrowdPresentationQuerySettings(
  settings: CrowdPresentationSettings,
  searchParams: URLSearchParams,
): CrowdPresentationSettings {
  const crowdVisualsQuery = searchParams.get('crowdVisuals');
  const crowdReactionsQuery = searchParams.get('crowdReactions');
  const densityQuery = searchParams.get('crowdDensity');

  return normalizeCrowdPresentationSettings({
    ...settings,
    crowdDensity: isCrowdDensity(densityQuery) ? densityQuery : settings.crowdDensity,
    crowdReactionsEnabled:
      crowdReactionsQuery === '0'
        ? false
        : crowdReactionsQuery === '1'
          ? true
          : settings.crowdReactionsEnabled,
    crowdVisualsEnabled:
      crowdVisualsQuery === '0'
        ? false
        : crowdVisualsQuery === '1'
          ? true
          : settings.crowdVisualsEnabled,
  });
}

export function calculateCrowdPose(options: {
  activeReaction: ActiveCrowdReaction | null;
  index: number;
  placement: CrowdPreviewPlacement;
  state: CrowdReactionState;
  timeSeconds: number;
}): {
  headTilt: number;
  leftArmLift: number;
  rightArmLift: number;
  torsoLean: number;
  verticalOffset: number;
} {
  const participant = isReactionParticipant(options);
  const phase = hashToUnit(`${options.placement.colorSeed}:${options.index}:phase`) * Math.PI * 2;

  if (!participant || options.state === 'idle') {
    return {
      headTilt: 0,
      leftArmLift: 0,
      rightArmLift: 0,
      torsoLean: 0,
      verticalOffset: 0,
    };
  }

  const wave = Math.sin(options.timeSeconds * reactionFrequency(options.state) + phase);
  const envelope = calculateReactionEnvelope(options.activeReaction);

  if (options.state === 'anticipation') {
    return {
      headTilt: 0.03 * wave,
      leftArmLift: 0.08 * wave,
      rightArmLift: -0.08 * wave,
      torsoLean: 0.02 * wave,
      verticalOffset: 0.018 * wave,
    };
  }

  if (options.state === 'disappointment') {
    return {
      headTilt: -0.12 * envelope,
      leftArmLift: -0.18 * envelope,
      rightArmLift: -0.18 * envelope,
      torsoLean: -0.04 * envelope,
      verticalOffset: -0.012 * envelope,
    };
  }

  const touchdownScale = options.state === 'touchdown' ? 1.45 : 1;
  const alternatingWave = Math.max(0, wave);

  return {
    headTilt: 0.08 * wave * envelope,
    leftArmLift: 0.55 * touchdownScale * envelope * (0.65 + alternatingWave * 0.35),
    rightArmLift: 0.5 * touchdownScale * envelope * (0.65 + Math.max(0, -wave) * 0.35),
    torsoLean: 0.045 * wave * envelope,
    verticalOffset: 0.07 * touchdownScale * alternatingWave * envelope,
  };
}

function createReactionForEvent(event: PresentationAudioEvent): ActiveCrowdReaction | null {
  if (event.type === 'firstDown') {
    return {
      durationSeconds: CROWD_PRESENTATION_CONFIG.firstDownDurationSeconds,
      elapsedSeconds: 0,
      eventId: event.id,
      participantRatio: CROWD_PRESENTATION_CONFIG.firstDownParticipantRatio,
      state: 'firstDown',
    };
  }

  if (event.type === 'touchdown') {
    return {
      durationSeconds: CROWD_PRESENTATION_CONFIG.touchdownDurationSeconds,
      elapsedSeconds: 0,
      eventId: event.id,
      participantRatio: CROWD_PRESENTATION_CONFIG.touchdownParticipantRatio,
      state: 'touchdown',
    };
  }

  if (
    event.type === 'incomplete' ||
    event.type === 'outOfBounds' ||
    event.type === 'sack' ||
    event.type === 'turnoverOnDowns'
  ) {
    return {
      durationSeconds: CROWD_PRESENTATION_CONFIG.disappointmentDurationSeconds,
      elapsedSeconds: 0,
      eventId: event.id,
      participantRatio: CROWD_PRESENTATION_CONFIG.disappointmentParticipantRatio,
      state: 'disappointment',
    };
  }

  return null;
}

function selectHighestPriorityReactionEvent(
  events: readonly PresentationAudioEvent[],
): PresentationAudioEvent | null {
  let selected: PresentationAudioEvent | null = null;
  let selectedPriority = 0;

  for (const event of events) {
    const priority = REACTION_EVENT_PRIORITIES[event.type] ?? 0;
    if (priority > selectedPriority) {
      selected = event;
      selectedPriority = priority;
    }
  }

  return selected;
}

function isReactionParticipant(options: {
  activeReaction: ActiveCrowdReaction | null;
  index: number;
  placement: CrowdPreviewPlacement;
  state: CrowdReactionState;
}): boolean {
  if (options.state === 'anticipation') {
    return hashToUnit(`anticipation:${options.placement.colorSeed}:${options.index}`) < 0.22;
  }

  if (!options.activeReaction) {
    return false;
  }

  return hashToUnit(`${options.activeReaction.eventId}:${options.index}`) < options.activeReaction.participantRatio;
}

function calculateReactionEnvelope(activeReaction: ActiveCrowdReaction | null): number {
  if (!activeReaction) {
    return 1;
  }

  const progress = activeReaction.elapsedSeconds / Math.max(0.001, activeReaction.durationSeconds);
  return Math.sin(Math.PI * Math.min(1, Math.max(0, progress)));
}

function reactionFrequency(state: CrowdReactionState): number {
  if (state === 'touchdown') {
    return 18;
  }

  if (state === 'firstDown') {
    return 13;
  }

  return 6;
}

function isCrowdDensity(value: unknown): value is CrowdDensity {
  return value === 'low' || value === 'medium' || value === 'high';
}

function hashToUnit(value: string): number {
  return (stableHash(value) % 10_000) / 10_000;
}
