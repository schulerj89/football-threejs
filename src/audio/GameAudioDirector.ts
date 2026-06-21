import type { GameplaySnapshot } from '../playState';
import { AudioMixer, type AudioMixerSnapshot } from './AudioMixer';
import {
  derivePresentationAudioEvents,
  type PresentationAudioEvent,
  type PresentationAudioEventType,
} from './PresentationEventBridge';

export interface GameAudioEventHistoryEntry {
  assetId: string | null;
  eventId: string;
  eventType: PresentationAudioEventType;
  reason:
    | 'audioDisabled'
    | 'cooldown'
    | 'duplicateEvent'
    | 'missingAsset'
    | 'muted'
    | 'noAsset'
    | 'pageHidden'
    | 'suspended'
    | null;
  status: 'played' | 'suppressed';
  triggerTimeSeconds: number;
}

export interface GameAudioDirectorSnapshot extends AudioMixerSnapshot {
  eventHistory: GameAudioEventHistoryEntry[];
  pageActive: boolean;
  recentEvents: PresentationAudioEvent[];
}

export interface AudioPlaybackPort {
  getCurrentTime(): number;
  getLoopGain(assetId: string): number;
  getSnapshot(): AudioMixerSnapshot;
  hasActiveLoop(assetId: string): boolean;
  installUserGestureUnlock(target: Window): void;
  playOneShot(assetId: string): Promise<boolean>;
  setLoopGain(assetId: string, gain: number): boolean;
  setMuted(muted: boolean): unknown;
  startLoop(assetId: string, options?: { gain?: number }): Promise<boolean>;
  stopLoop(assetId: string): boolean;
  toggleMuted(): unknown;
}

interface AmbienceLoopState {
  assetId: string;
  currentGain: number;
  targetGain: number;
}

const GAME_AUDIO_CONFIG = {
  ambienceFadePerSecond: 1.8,
  eventHistoryLimit: 24,
  idleAmbienceGain: 0.32,
  idleLoopAssetId: 'crowd_idle_loop_01',
  pressureAmbienceGain: 0.34,
  pressureLoopAssetId: 'crowd_pressure_loop_01',
  whistleCooldownSeconds: 0.45,
} as const;

const EVENT_ASSETS: Partial<Record<PresentationAudioEventType, readonly string[]>> = {
  ballSnapped: ['snap_01'],
  firstDown: ['crowd_first_down_01', 'crowd_first_down_02'],
  incomplete: ['crowd_incomplete_01'],
  passCaught: ['ball_catch_01', 'ball_catch_02'],
  sack: ['pads_hit_01', 'pads_hit_02', 'pads_hit_03'],
  tackle: ['pads_hit_01', 'pads_hit_02', 'pads_hit_03'],
  touchdown: ['crowd_touchdown_01', 'crowd_touchdown_02'],
  turnoverOnDowns: ['crowd_turnover_01'],
};

const WHISTLE_EVENTS = new Set<PresentationAudioEventType>([
  'incomplete',
  'outOfBounds',
  'sack',
  'tackle',
  'touchdown',
  'turnoverOnDowns',
]);

export class GameAudioDirector {
  private readonly processedEventIds = new Set<string>();
  private readonly recentEvents: PresentationAudioEvent[] = [];
  private readonly eventHistory: GameAudioEventHistoryEntry[] = [];
  private readonly ambienceLoops = new Map<string, AmbienceLoopState>();
  private readonly pendingAudioTasks: Promise<void>[] = [];
  private readonly lastVariantByGroup = new Map<string, string>();
  private previousSnapshot: GameplaySnapshot | null = null;
  private lastWhistleTimeSeconds = Number.NEGATIVE_INFINITY;
  private pageActive = true;

  constructor(private readonly mixer: AudioPlaybackPort) {}

  installControls(target: Window): void {
    this.mixer.installUserGestureUnlock(target);
    target.addEventListener('keydown', this.handleMuteShortcut);
  }

  update(snapshot: GameplaySnapshot, deltaSeconds = 0): void {
    const events = derivePresentationAudioEvents(this.previousSnapshot, snapshot);
    this.processEvents(snapshot, events, deltaSeconds);
    this.previousSnapshot = snapshot;
  }

  processEvents(
    snapshot: GameplaySnapshot,
    events: readonly PresentationAudioEvent[],
    deltaSeconds = 0,
  ): void {
    this.recentEvents.length = 0;
    this.recentEvents.push(...events);
    this.updateAmbience(snapshot, deltaSeconds);

    for (const event of events) {
      this.processPresentationEvent(event);
    }
  }

  setPageActive(active: boolean): void {
    if (this.pageActive === active) {
      return;
    }

    this.pageActive = active;

    if (!active) {
      for (const loop of this.ambienceLoops.values()) {
        this.mixer.stopLoop(loop.assetId);
      }
      this.ambienceLoops.clear();
    }
  }

  async playTestOneShot(assetId = 'runtime-test-click'): Promise<boolean> {
    return this.mixer.playOneShot(assetId);
  }

  async startTestLoop(assetId = 'runtime-test-crowd-loop'): Promise<boolean> {
    return this.mixer.startLoop(assetId);
  }

  stopTestLoop(assetId = 'runtime-test-crowd-loop'): boolean {
    return this.mixer.stopLoop(assetId);
  }

  toggleMuted() {
    return this.mixer.toggleMuted();
  }

  setMuted(muted: boolean) {
    return this.mixer.setMuted(muted);
  }

  getSnapshot(): GameAudioDirectorSnapshot {
    return {
      ...this.mixer.getSnapshot(),
      eventHistory: this.eventHistory.map((entry) => ({ ...entry })),
      pageActive: this.pageActive,
      recentEvents: this.recentEvents.map((event) => ({ ...event })),
    };
  }

  async flushPendingAudioForTests(): Promise<void> {
    await Promise.all(this.pendingAudioTasks);
    this.pendingAudioTasks.length = 0;
  }

  private processPresentationEvent(event: PresentationAudioEvent): void {
    if (this.processedEventIds.has(event.id)) {
      this.recordHistory(event, null, 'suppressed', 'duplicateEvent');
      return;
    }

    this.processedEventIds.add(event.id);
    this.triggerMappedAsset(event);
    this.triggerWhistleIfNeeded(event);
  }

  private triggerMappedAsset(event: PresentationAudioEvent): void {
    const assetIds = EVENT_ASSETS[event.type];

    if (!assetIds) {
      return;
    }

    const assetId = this.selectVariant(event.type, event.id, assetIds);
    this.playOneShotForEvent(event, assetId);
  }

  private triggerWhistleIfNeeded(event: PresentationAudioEvent): void {
    if (!WHISTLE_EVENTS.has(event.type)) {
      return;
    }

    const now = this.getTriggerTime();
    const whistleEvent = {
      ...event,
      id: `${event.id}:whistle`,
    };

    if (now - this.lastWhistleTimeSeconds < GAME_AUDIO_CONFIG.whistleCooldownSeconds) {
      this.recordHistory(whistleEvent, 'referee_whistle_01', 'suppressed', 'cooldown', now);
      return;
    }

    this.lastWhistleTimeSeconds = now;
    this.playOneShotForEvent(whistleEvent, 'referee_whistle_01', now);
  }

  private playOneShotForEvent(
    event: PresentationAudioEvent,
    assetId: string,
    triggerTimeSeconds = this.getTriggerTime(),
  ): void {
    const suppressionReason = this.getPlaybackSuppressionReason();

    if (suppressionReason) {
      this.recordHistory(event, assetId, 'suppressed', suppressionReason, triggerTimeSeconds);
      return;
    }

    const task = this.mixer.playOneShot(assetId)
      .then((played) => {
        this.recordHistory(
          event,
          assetId,
          played ? 'played' : 'suppressed',
          played ? null : 'missingAsset',
          triggerTimeSeconds,
        );
      });
    this.pendingAudioTasks.push(task);
  }

  private updateAmbience(snapshot: GameplaySnapshot, deltaSeconds: number): void {
    const suppressionReason = this.getPlaybackSuppressionReason();

    if (suppressionReason) {
      return;
    }

    const live = snapshot.playState === 'live';
    this.setAmbienceTarget(GAME_AUDIO_CONFIG.idleLoopAssetId, live ? 0 : GAME_AUDIO_CONFIG.idleAmbienceGain);
    this.setAmbienceTarget(
      GAME_AUDIO_CONFIG.pressureLoopAssetId,
      live ? GAME_AUDIO_CONFIG.pressureAmbienceGain : 0,
    );
    const fadeStep = Math.max(0, deltaSeconds) * GAME_AUDIO_CONFIG.ambienceFadePerSecond;

    for (const loop of this.ambienceLoops.values()) {
      const nextGain = moveToward(loop.currentGain, loop.targetGain, fadeStep);
      loop.currentGain = nextGain;
      this.mixer.setLoopGain(loop.assetId, nextGain);

      if (loop.targetGain === 0 && nextGain <= 0.001) {
        this.mixer.stopLoop(loop.assetId);
        this.ambienceLoops.delete(loop.assetId);
      }
    }
  }

  private setAmbienceTarget(assetId: string, targetGain: number): void {
    const existing = this.ambienceLoops.get(assetId);

    if (existing) {
      existing.targetGain = targetGain;
      return;
    }

    if (targetGain <= 0 || this.ambienceLoops.size >= 2) {
      return;
    }

    const task = this.mixer.startLoop(assetId, { gain: 0 })
      .then((started) => {
        if (!started) {
          return;
        }

        this.ambienceLoops.set(assetId, {
          assetId,
          currentGain: this.mixer.getLoopGain(assetId),
          targetGain,
        });
      });
    this.pendingAudioTasks.push(task);
  }

  private selectVariant(
    groupId: string,
    eventId: string,
    assetIds: readonly string[],
  ): string {
    if (assetIds.length === 1) {
      return assetIds[0];
    }

    const lastAssetId = this.lastVariantByGroup.get(groupId);
    let selectedAssetId = assetIds[stableHash(eventId) % assetIds.length];

    if (selectedAssetId === lastAssetId) {
      const selectedIndex = assetIds.indexOf(selectedAssetId);
      selectedAssetId = assetIds[(selectedIndex + 1) % assetIds.length];
    }

    this.lastVariantByGroup.set(groupId, selectedAssetId);
    return selectedAssetId;
  }

  private getPlaybackSuppressionReason(): GameAudioEventHistoryEntry['reason'] {
    const snapshot = this.mixer.getSnapshot();

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

  private recordHistory(
    event: PresentationAudioEvent,
    assetId: string | null,
    status: GameAudioEventHistoryEntry['status'],
    reason: GameAudioEventHistoryEntry['reason'],
    triggerTimeSeconds = this.getTriggerTime(),
  ): void {
    this.eventHistory.unshift({
      assetId,
      eventId: event.id,
      eventType: event.type,
      reason,
      status,
      triggerTimeSeconds,
    });
    this.eventHistory.splice(GAME_AUDIO_CONFIG.eventHistoryLimit);
  }

  private getTriggerTime(): number {
    return this.mixer.getCurrentTime();
  }

  private readonly handleMuteShortcut = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== 'm') {
      return;
    }

    this.toggleMuted();
    event.preventDefault();
  };
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (current < target) {
    return Math.min(target, current + maxDelta);
  }

  return Math.max(target, current - maxDelta);
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
