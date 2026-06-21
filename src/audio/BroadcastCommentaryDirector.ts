import type { GameplaySnapshot } from '../playState';
import {
  COMMENTARY_CATEGORY_RULES,
  COMMENTARY_CATALOG,
  getCommentaryClipsForCategory,
  type CommentaryCategory,
  type CommentaryClip,
} from './CommentaryCatalog';
import type { AudioMixerSnapshot } from './AudioMixer';
import type { AudioPlaybackCategory } from './AudioAssetManifest';
import {
  derivePresentationAudioEvents,
  type PresentationAudioEvent,
  type PresentationAudioEventType,
} from './PresentationEventBridge';
import type { AudioSettings } from './AudioSettings';

export interface BroadcastCommentaryAudioPort {
  getCurrentTime(): number;
  getSettings(): AudioSettings;
  getSnapshot(): AudioMixerSnapshot;
  playOneShot(assetId: string): Promise<boolean>;
  setCrowdDuckingGain(gain: number): void;
  setSettings(patch: Partial<AudioSettings>): AudioSettings;
  stopOneShotsByCategory(category: AudioPlaybackCategory): number;
}

export interface BroadcastCommentaryConfig {
  activeSpeechPaddingSeconds: number;
  bigGainThresholdYards: number;
  crowdDuckGain: number;
  eventHistoryLimit: number;
  enabled: boolean;
  queueLimit: number;
}

export interface BroadcastCommentaryHistoryEntry {
  assetId: string | null;
  category: CommentaryCategory | null;
  eventId: string;
  eventType: PresentationAudioEventType;
  priority: number;
  reason:
    | 'announcerDisabled'
    | 'audioDisabled'
    | 'cancelledByHigherPriority'
    | 'cooldown'
    | 'duplicateEvent'
    | 'missingAsset'
    | 'muted'
    | 'noCandidate'
    | 'pageHidden'
    | 'playReset'
    | 'suspended'
    | null;
  status: 'cancelled' | 'played' | 'queued' | 'started' | 'stopped' | 'suppressed';
  triggerTimeSeconds: number;
}

export interface BroadcastCommentaryQueueEntry {
  assetId: string;
  caption: string;
  category: CommentaryCategory;
  eventId: string;
  eventType: PresentationAudioEventType;
  priority: number;
}

export interface BroadcastCommentaryActiveClip extends BroadcastCommentaryQueueEntry {
  endsAtSeconds: number;
  startedAtSeconds: number;
}

export interface BroadcastCommentaryPlaybackState {
  activeClipId: string | null;
  completed: boolean;
  completedEventIds: string[];
  elapsedDuration: number;
  eventId: string | null;
  expectedDuration: number;
  failed: boolean;
  failedEventIds: string[];
  playing: boolean;
  remainingDuration: number;
}

export interface BroadcastCommentaryCooldownEntry {
  category: CommentaryCategory;
  remainingSeconds: number;
}

export interface BroadcastCommentarySnapshot {
  captionsEnabled: boolean;
  crowdDuckState: {
    duckingGain: number;
    ducked: boolean;
  };
  currentClip: BroadcastCommentaryActiveClip | null;
  currentCaption: string | null;
  enabled: boolean;
  eventHistory: BroadcastCommentaryHistoryEntry[];
  lastEventSource: string | null;
  lastPriority: number | null;
  playback: BroadcastCommentaryPlaybackState;
  queue: BroadcastCommentaryQueueEntry[];
  remainingCooldowns: BroadcastCommentaryCooldownEntry[];
}

interface CommentaryQueueItem extends BroadcastCommentaryQueueEntry {
  clip: CommentaryClip;
  durationSeconds: number;
}

export const DEFAULT_BROADCAST_COMMENTARY_CONFIG: BroadcastCommentaryConfig = {
  activeSpeechPaddingSeconds: 0.16,
  bigGainThresholdYards: 15,
  crowdDuckGain: 0.42,
  enabled: true,
  eventHistoryLimit: 20,
  queueLimit: 3,
};

export class BroadcastCommentaryDirector {
  private readonly config: BroadcastCommentaryConfig;
  private readonly eventHistory: BroadcastCommentaryHistoryEntry[] = [];
  private readonly lastCategoryStartTime = new Map<CommentaryCategory, number>();
  private readonly lastVariantByCategory = new Map<CommentaryCategory, string>();
  private readonly pendingAudioTasks: Promise<void>[] = [];
  private readonly processedEventIds = new Set<string>();
  private readonly completedPlaybackEventIds = new Set<string>();
  private readonly failedPlaybackEventIds = new Set<string>();
  private currentClip: BroadcastCommentaryActiveClip | null = null;
  private hasPlayedOpeningLine = false;
  private lastCompletedEventId: string | null = null;
  private lastFailedEventId: string | null = null;
  private lastEventSource: string | null = null;
  private lastPriority: number | null = null;
  private pageActive = true;
  private previousSnapshot: GameplaySnapshot | null = null;
  private queue: CommentaryQueueItem[] = [];

  constructor(
    private readonly mixer: BroadcastCommentaryAudioPort,
    config: Partial<BroadcastCommentaryConfig> = {},
  ) {
    this.config = {
      ...DEFAULT_BROADCAST_COMMENTARY_CONFIG,
      ...config,
    };
  }

  update(snapshot: GameplaySnapshot, deltaSeconds = 0): void {
    const events = derivePresentationAudioEvents(this.previousSnapshot, snapshot);
    this.processEvents(events, deltaSeconds);
    this.previousSnapshot = snapshot;
  }

  processEvents(events: readonly PresentationAudioEvent[], _deltaSeconds = 0): void {
    this.finishExpiredSpeech();

    const suppressionReason = this.getPlaybackSuppressionReason();
    if (suppressionReason) {
      this.stopActiveSpeech(suppressionReason);
    }

    for (const event of events) {
      this.processPresentationEvent(event);
    }

    this.startNextQueuedClip();
  }

  setPageActive(active: boolean): void {
    this.pageActive = active;

    if (!active) {
      this.stopActiveSpeech('pageHidden');
      this.queue = [];
      this.restoreCrowd();
    }
  }

  setAnnouncerEnabled(enabled: boolean): AudioSettings {
    const settings = this.mixer.setSettings({ announcerEnabled: enabled });

    if (!enabled) {
      this.stopActiveSpeech('announcerDisabled');
      this.queue = [];
      this.restoreCrowd();
    }

    return settings;
  }

  setAnnouncerVolume(announcerVolume: number): AudioSettings {
    return this.mixer.setSettings({ announcerVolume });
  }

  setCaptionsEnabled(captionsEnabled: boolean): AudioSettings {
    return this.mixer.setSettings({ captionsEnabled });
  }

  getSnapshot(): BroadcastCommentarySnapshot {
    const mixerSnapshot = this.mixer.getSnapshot();
    const now = this.mixer.getCurrentTime();

    return {
      captionsEnabled: mixerSnapshot.captionsEnabled,
      crowdDuckState: {
        duckingGain: mixerSnapshot.crowdDuckingGain,
        ducked: mixerSnapshot.crowdDuckingGain < 0.999,
      },
      currentClip: this.currentClip ? { ...this.currentClip } : null,
      currentCaption:
        mixerSnapshot.announcerEnabled && mixerSnapshot.captionsEnabled
          ? this.currentClip?.caption ?? null
          : null,
      enabled: this.config.enabled && mixerSnapshot.enabled && mixerSnapshot.announcerEnabled,
      eventHistory: this.eventHistory.map((entry) => ({ ...entry })),
      lastEventSource: this.lastEventSource,
      lastPriority: this.lastPriority,
      playback: this.createPlaybackState(now),
      queue: this.queue.map((item) => serializeQueueItem(item)),
      remainingCooldowns: [...this.lastCategoryStartTime.entries()]
        .map(([category, startedAt]) => ({
          category,
          remainingSeconds: Math.max(
            0,
            COMMENTARY_CATEGORY_RULES[category].cooldownSeconds - (now - startedAt),
          ),
        }))
        .filter((entry) => entry.remainingSeconds > 0.001)
        .sort((a, b) => a.category.localeCompare(b.category)),
    };
  }

  async flushPendingAudioForTests(): Promise<void> {
    await Promise.all(this.pendingAudioTasks);
    this.pendingAudioTasks.length = 0;
  }

  private processPresentationEvent(event: PresentationAudioEvent): void {
    const candidate = this.createCandidate(event);

    if (!candidate) {
      this.recordHistory(event, null, 'suppressed', 'noCandidate', null);
      this.markPlaybackFailed(event.id);
      return;
    }

    const processedKey = `${event.id}:${candidate.category}`;
    if (this.processedEventIds.has(processedKey)) {
      this.recordHistory(event, null, 'suppressed', 'duplicateEvent', candidate.category);
      return;
    }
    this.processedEventIds.add(processedKey);

    if (event.type === 'playReset' || (event.type === 'playPrepared' && this.currentClip)) {
      this.stopActiveSpeech('playReset', event);
      this.queue = [];
    }

    const suppressionReason = this.getPlaybackSuppressionReason();
    if (suppressionReason) {
      this.recordHistory(event, candidate.clip.assetId, 'suppressed', suppressionReason, candidate.category);
      this.markPlaybackFailed(event.id);
      return;
    }

    const cooldownRemaining = this.getCooldownRemaining(candidate.category);
    if (cooldownRemaining > 0) {
      this.recordHistory(event, candidate.clip.assetId, 'suppressed', 'cooldown', candidate.category);
      return;
    }

    this.enqueue(candidate, event);
  }

  private createCandidate(event: PresentationAudioEvent): CommentaryQueueItem | null {
    const category = this.resolveCategory(event);

    if (!category) {
      return null;
    }

    const clips = getCommentaryClipsForCategory(category, COMMENTARY_CATALOG);
    const clip = this.selectVariant(category, event.id, clips);

    if (!clip) {
      return null;
    }

    return {
      assetId: clip.assetId,
      caption: clip.caption,
      category,
      clip,
      durationSeconds: clip.durationSeconds,
      eventId: event.id,
      eventType: event.type,
      priority: clip.priority,
    };
  }

  private resolveCategory(event: PresentationAudioEvent): CommentaryCategory | null {
    if (event.type === 'playPrepared') {
      if (!this.hasPlayedOpeningLine) {
        return 'gameOpening';
      }

      return 'playReady';
    }

    if (event.type === 'firstDown') {
      return 'firstDown';
    }

    if (event.type === 'touchdown') {
      return 'touchdown';
    }

    if (event.type === 'sack') {
      return 'sack';
    }

    if (event.type === 'incomplete') {
      return 'incomplete';
    }

    if (event.type === 'outOfBounds') {
      return 'outOfBounds';
    }

    if (event.type === 'turnoverOnDowns') {
      return 'turnoverOnDowns';
    }

    if (event.type === 'challengeEnding') {
      return 'challengeEnding';
    }

    if (!event.playResult || event.type !== 'tackle') {
      return null;
    }

    if (event.playResult.yardsGained <= -1) {
      return 'tackleForLoss';
    }

    if (event.playResult.yardsGained >= this.config.bigGainThresholdYards) {
      return 'bigGain';
    }

    return null;
  }

  private enqueue(item: CommentaryQueueItem, event: PresentationAudioEvent): void {
    const cancelledItems = this.queue.filter((queued) => queued.priority < item.priority);
    this.queue = this.queue.filter((queued) => queued.priority >= item.priority);

    for (const cancelledItem of cancelledItems) {
      this.recordHistory(
        {
          id: cancelledItem.eventId,
          playState: event.playState,
          score: event.score,
          type: cancelledItem.eventType,
        },
        cancelledItem.assetId,
        'cancelled',
        'cancelledByHigherPriority',
        cancelledItem.category,
      );
    }

    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority);
    this.queue.splice(this.config.queueLimit);
    this.recordHistory(event, item.assetId, 'queued', null, item.category);
  }

  private startNextQueuedClip(): void {
    this.finishExpiredSpeech();

    if (this.currentClip || this.queue.length === 0 || this.getPlaybackSuppressionReason()) {
      return;
    }

    const item = this.queue.shift()!;
    const now = this.mixer.getCurrentTime();
    const activeClip: BroadcastCommentaryActiveClip = {
      ...serializeQueueItem(item),
      endsAtSeconds: now + item.durationSeconds + this.config.activeSpeechPaddingSeconds,
      startedAtSeconds: now,
    };
    this.currentClip = activeClip;
    this.lastCategoryStartTime.set(item.category, now);
    this.lastVariantByCategory.set(item.category, item.assetId);
    this.lastEventSource = item.eventId;
    this.lastPriority = item.priority;

    if (item.category === 'gameOpening') {
      this.hasPlayedOpeningLine = true;
    }

    this.mixer.setCrowdDuckingGain(this.config.crowdDuckGain);
    this.recordHistory(
      {
        id: item.eventId,
        playState: 'live',
        score: 0,
        type: item.eventType,
      },
      item.assetId,
      'started',
      null,
      item.category,
      now,
    );

    const task = this.mixer.playOneShot(item.assetId)
      .then((played) => {
        if (!played && this.currentClip?.assetId === item.assetId) {
          this.recordHistory(
            {
              id: item.eventId,
              playState: 'live',
              score: 0,
              type: item.eventType,
            },
            item.assetId,
            'suppressed',
            'missingAsset',
            item.category,
          );
          this.markPlaybackFailed(item.eventId);
          this.currentClip = null;
          this.restoreCrowd();
          return;
        }

        if (played) {
          this.recordHistory(
            {
              id: item.eventId,
              playState: 'live',
              score: 0,
              type: item.eventType,
            },
            item.assetId,
            'played',
            null,
            item.category,
          );
        }
      });
    this.pendingAudioTasks.push(task);
  }

  private finishExpiredSpeech(): void {
    if (!this.currentClip) {
      return;
    }

    if (this.mixer.getCurrentTime() < this.currentClip.endsAtSeconds) {
      return;
    }

    this.markPlaybackCompleted(this.currentClip.eventId);
    this.currentClip = null;
    this.restoreCrowd();
  }

  private stopActiveSpeech(
    reason: BroadcastCommentaryHistoryEntry['reason'],
    event?: PresentationAudioEvent,
  ): void {
    if (!this.currentClip) {
      this.restoreCrowd();
      return;
    }

    const stoppedClip = this.currentClip;
    this.mixer.stopOneShotsByCategory('announcer');
    this.currentClip = null;
    this.restoreCrowd();
    this.markPlaybackFailed(stoppedClip.eventId);
    this.recordHistory(
      event ?? {
        id: stoppedClip.eventId,
        playState: 'preSnap',
        score: 0,
        type: stoppedClip.eventType,
      },
      stoppedClip.assetId,
      'stopped',
      reason,
      stoppedClip.category,
    );
  }

  private restoreCrowd(): void {
    this.mixer.setCrowdDuckingGain(1);
  }

  private createPlaybackState(now: number): BroadcastCommentaryPlaybackState {
    if (!this.currentClip) {
      return {
        activeClipId: null,
        completed: this.lastCompletedEventId !== null,
        completedEventIds: [...this.completedPlaybackEventIds],
        elapsedDuration: 0,
        eventId: this.lastCompletedEventId ?? this.lastFailedEventId,
        expectedDuration: 0,
        failed: this.lastFailedEventId !== null,
        failedEventIds: [...this.failedPlaybackEventIds],
        playing: false,
        remainingDuration: 0,
      };
    }

    const expectedDuration = Math.max(0, this.currentClip.endsAtSeconds - this.currentClip.startedAtSeconds);
    const elapsedDuration = Math.min(expectedDuration, Math.max(0, now - this.currentClip.startedAtSeconds));

    return {
      activeClipId: this.currentClip.assetId,
      completed: false,
      completedEventIds: [...this.completedPlaybackEventIds],
      elapsedDuration,
      eventId: this.currentClip.eventId,
      expectedDuration,
      failed: false,
      failedEventIds: [...this.failedPlaybackEventIds],
      playing: true,
      remainingDuration: Math.max(0, expectedDuration - elapsedDuration),
    };
  }

  private markPlaybackCompleted(eventId: string): void {
    this.completedPlaybackEventIds.add(eventId);
    this.failedPlaybackEventIds.delete(eventId);
    this.lastCompletedEventId = eventId;
    if (this.lastFailedEventId === eventId) {
      this.lastFailedEventId = null;
    }
  }

  private markPlaybackFailed(eventId: string): void {
    if (this.completedPlaybackEventIds.has(eventId)) {
      return;
    }

    this.failedPlaybackEventIds.add(eventId);
    this.lastFailedEventId = eventId;
  }

  private getCooldownRemaining(category: CommentaryCategory): number {
    const previousStart = this.lastCategoryStartTime.get(category);

    if (previousStart === undefined) {
      return 0;
    }

    const elapsed = this.mixer.getCurrentTime() - previousStart;
    return Math.max(0, COMMENTARY_CATEGORY_RULES[category].cooldownSeconds - elapsed);
  }

  private getPlaybackSuppressionReason(): BroadcastCommentaryHistoryEntry['reason'] {
    const snapshot = this.mixer.getSnapshot();

    if (!this.config.enabled || !snapshot.announcerEnabled) {
      return 'announcerDisabled';
    }

    if (!this.pageActive) {
      return 'pageHidden';
    }

    if (!snapshot.enabled) {
      return 'audioDisabled';
    }

    if (snapshot.muted) {
      return 'muted';
    }

    if (snapshot.contextState !== 'running') {
      return 'suspended';
    }

    return null;
  }

  private selectVariant(
    category: CommentaryCategory,
    eventId: string,
    clips: readonly CommentaryClip[],
  ): CommentaryClip | null {
    if (clips.length === 0) {
      return null;
    }

    if (clips.length === 1) {
      return clips[0];
    }

    const lastAssetId = this.lastVariantByCategory.get(category);
    let selectedClip = clips[stableHash(`${category}:${eventId}`) % clips.length];

    if (selectedClip.assetId === lastAssetId) {
      const selectedIndex = clips.indexOf(selectedClip);
      selectedClip = clips[(selectedIndex + 1) % clips.length];
    }

    return selectedClip;
  }

  private recordHistory(
    event: PresentationAudioEvent,
    assetId: string | null,
    status: BroadcastCommentaryHistoryEntry['status'],
    reason: BroadcastCommentaryHistoryEntry['reason'],
    category: CommentaryCategory | null,
    triggerTimeSeconds = this.mixer.getCurrentTime(),
  ): void {
    this.eventHistory.unshift({
      assetId,
      category,
      eventId: event.id,
      eventType: event.type,
      priority: category ? COMMENTARY_CATEGORY_RULES[category].priority : 0,
      reason,
      status,
      triggerTimeSeconds,
    });
    this.eventHistory.splice(this.config.eventHistoryLimit);
  }
}

function serializeQueueItem(item: CommentaryQueueItem): BroadcastCommentaryQueueEntry {
  return {
    assetId: item.assetId,
    caption: item.caption,
    category: item.category,
    eventId: item.eventId,
    eventType: item.eventType,
    priority: item.priority,
  };
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
