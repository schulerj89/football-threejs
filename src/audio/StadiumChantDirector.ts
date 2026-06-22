import type { AudioMixerSnapshot } from './AudioMixer';
import type { BroadcastCommentarySnapshot } from './BroadcastCommentaryDirector';
import type { GameMusicDirectorSnapshot } from './GameMusicDirector';
import { STADIUM_CHANT_TRACKS } from './MusicCatalog';
import type { PresentationAudioEvent } from './PresentationEventBridge';
import type { GameplaySnapshot } from '../playState';

export interface StadiumChantAudioPort {
  getCurrentTime(): number;
  getSnapshot(): AudioMixerSnapshot;
  playOneShot(assetId: string): Promise<boolean>;
}

export interface StadiumChantDirectorOptions {
  cooldownSeconds?: number;
}

export interface StadiumChantHistoryEntry {
  assetId: string | null;
  eventId: string | null;
  reason:
    | 'announcerActive'
    | 'audioDisabled'
    | 'cooldown'
    | 'driveLimit'
    | 'livePlay'
    | 'missingAsset'
    | 'muted'
    | 'noSafeEvent'
    | 'stingerActive'
    | 'suspended'
    | null;
  status: 'played' | 'suppressed';
  triggerTimeSeconds: number;
}

export interface StadiumChantDirectorSnapshot {
  activeChantAssetId: string | null;
  cooldownRemainingSeconds: number;
  history: StadiumChantHistoryEntry[];
  lastSuppressionReason: StadiumChantHistoryEntry['reason'];
}

interface StadiumChantContext {
  commentary?: BroadcastCommentarySnapshot | null;
  gameMusic?: GameMusicDirectorSnapshot | null;
}

const STADIUM_CHANT_CONFIG = {
  cooldownSeconds: 48,
  historyLimit: 18,
} as const;

export class StadiumChantDirector {
  private readonly cooldownSeconds: number;
  private readonly history: StadiumChantHistoryEntry[] = [];
  private readonly processedEventIds = new Set<string>();
  private readonly driveKeysWithChant = new Set<string>();
  private activeChantAssetId: string | null = null;
  private activeChantEndsAtSeconds = 0;
  private lastChantTimeSeconds = Number.NEGATIVE_INFINITY;
  private lastSuppressionReason: StadiumChantHistoryEntry['reason'] = null;
  private lastVariantIndex = -1;

  constructor(
    private readonly mixer: StadiumChantAudioPort,
    options: StadiumChantDirectorOptions = {},
  ) {
    this.cooldownSeconds = options.cooldownSeconds ?? STADIUM_CHANT_CONFIG.cooldownSeconds;
  }

  processEvents(
    snapshot: GameplaySnapshot,
    events: readonly PresentationAudioEvent[],
    _deltaSeconds = 0,
    context: StadiumChantContext = {},
  ): void {
    this.clearExpiredActiveChant();

    if (snapshot.playState === 'live') {
      this.lastSuppressionReason = 'livePlay';
      return;
    }

    const safeEvent = events.find((event) =>
      (event.type === 'playPrepared' || event.type === 'playReset') &&
      !this.processedEventIds.has(event.id)
    );

    if (!safeEvent) {
      this.lastSuppressionReason = 'noSafeEvent';
      return;
    }

    this.processedEventIds.add(safeEvent.id);
    void this.tryPlayChant(snapshot, safeEvent, context);
  }

  getSnapshot(): StadiumChantDirectorSnapshot {
    this.clearExpiredActiveChant();

    return {
      activeChantAssetId: this.activeChantAssetId,
      cooldownRemainingSeconds: Math.max(
        0,
        this.cooldownSeconds - (this.mixer.getCurrentTime() - this.lastChantTimeSeconds),
      ),
      history: this.history.map((entry) => ({ ...entry })),
      lastSuppressionReason: this.lastSuppressionReason,
    };
  }

  private async tryPlayChant(
    snapshot: GameplaySnapshot,
    event: PresentationAudioEvent,
    context: StadiumChantContext,
  ): Promise<boolean> {
    const triggerTimeSeconds = this.mixer.getCurrentTime();
    const suppressionReason = this.getSuppressionReason(snapshot, context, triggerTimeSeconds);
    const assetId = this.selectVariant(event.id);

    if (suppressionReason) {
      this.lastSuppressionReason = suppressionReason;
      this.recordHistory(event.id, assetId, 'suppressed', suppressionReason, triggerTimeSeconds);
      return false;
    }

    const played = await this.mixer.playOneShot(assetId);
    if (!played) {
      this.lastSuppressionReason = 'missingAsset';
      this.recordHistory(event.id, assetId, 'suppressed', 'missingAsset', triggerTimeSeconds);
      return false;
    }

    this.activeChantAssetId = assetId;
    this.activeChantEndsAtSeconds = triggerTimeSeconds + getChantDurationSeconds(assetId);
    this.lastChantTimeSeconds = triggerTimeSeconds;
    this.driveKeysWithChant.add(createDriveChantKey(snapshot));
    this.lastSuppressionReason = null;
    this.recordHistory(event.id, assetId, 'played', null, triggerTimeSeconds);
    return true;
  }

  private getSuppressionReason(
    snapshot: GameplaySnapshot,
    context: StadiumChantContext,
    triggerTimeSeconds: number,
  ): StadiumChantHistoryEntry['reason'] {
    if (snapshot.playState === 'live') {
      return 'livePlay';
    }

    if (context.commentary?.currentClip || context.commentary?.playback.playing) {
      return 'announcerActive';
    }

    if (context.gameMusic?.activeStinger) {
      return 'stingerActive';
    }

    if (triggerTimeSeconds - this.lastChantTimeSeconds < this.cooldownSeconds) {
      return 'cooldown';
    }

    if (this.driveKeysWithChant.has(createDriveChantKey(snapshot))) {
      return 'driveLimit';
    }

    const mixerSnapshot = this.mixer.getSnapshot();
    if (!mixerSnapshot.enabled) {
      return 'audioDisabled';
    }

    if (mixerSnapshot.muted) {
      return 'muted';
    }

    if (mixerSnapshot.contextState !== 'running') {
      return 'suspended';
    }

    return null;
  }

  private selectVariant(eventId: string): string {
    if (STADIUM_CHANT_TRACKS.length === 0) {
      return '';
    }

    let index = stableHash(eventId) % STADIUM_CHANT_TRACKS.length;
    if (STADIUM_CHANT_TRACKS.length > 1 && index === this.lastVariantIndex) {
      index = (index + 1) % STADIUM_CHANT_TRACKS.length;
    }
    this.lastVariantIndex = index;
    return STADIUM_CHANT_TRACKS[index].assetId;
  }

  private recordHistory(
    eventId: string | null,
    assetId: string | null,
    status: StadiumChantHistoryEntry['status'],
    reason: StadiumChantHistoryEntry['reason'],
    triggerTimeSeconds: number,
  ): void {
    this.history.unshift({
      assetId,
      eventId,
      reason,
      status,
      triggerTimeSeconds,
    });
    this.history.splice(STADIUM_CHANT_CONFIG.historyLimit);
  }

  private clearExpiredActiveChant(): void {
    if (!this.activeChantAssetId) {
      return;
    }

    if (this.mixer.getCurrentTime() < this.activeChantEndsAtSeconds) {
      return;
    }

    this.activeChantAssetId = null;
    this.activeChantEndsAtSeconds = 0;
  }
}

function createDriveChantKey(snapshot: GameplaySnapshot): string {
  return [
    snapshot.playbookId,
    snapshot.score,
    snapshot.drive.firstDownMarker.z.toFixed(2),
    snapshot.drive.state,
  ].join(':');
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getChantDurationSeconds(assetId: string): number {
  return STADIUM_CHANT_TRACKS.find((track) => track.assetId === assetId)?.durationSeconds ?? 8;
}
