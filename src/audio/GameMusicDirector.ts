import type {
  AudioMixerSnapshot,
  AudioPlaybackHandle,
} from './AudioMixer';
import type { GameplaySnapshot } from '../playState';
import type { PresentationAudioEvent } from './PresentationEventBridge';
import {
  getTransitionStinger,
  type TransitionStingerPurpose,
} from './MusicCatalog';

export interface GameMusicAudioPort {
  getCurrentTime(): number;
  getSnapshot(): AudioMixerSnapshot;
  playOneShotTracked?(assetId: string): Promise<AudioPlaybackHandle | null>;
  playOneShot(assetId: string): Promise<boolean>;
}

export interface GameMusicHistoryEntry {
  assetId: string | null;
  purpose: TransitionStingerPurpose;
  reason:
    | 'activeStinger'
    | 'audioDisabled'
    | 'livePlay'
    | 'missingAsset'
    | 'muted'
    | 'suspended'
    | null;
  status: 'ended' | 'played' | 'requested' | 'suppressed';
  triggerTimeSeconds: number;
}

export interface GameMusicDirectorSnapshot {
  activeStinger: {
    assetId: string;
    purpose: TransitionStingerPurpose;
    startedAtSeconds: number;
  } | null;
  history: GameMusicHistoryEntry[];
  suppressionReason: GameMusicHistoryEntry['reason'];
}

const GAME_MUSIC_CONFIG = {
  historyLimit: 18,
} as const;

export class GameMusicDirector {
  private activeStinger: {
    assetId: string;
    handle: AudioPlaybackHandle | null;
    purpose: TransitionStingerPurpose;
    startedAtSeconds: number;
  } | null = null;
  private readonly history: GameMusicHistoryEntry[] = [];
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly mixer: GameMusicAudioPort) {}

  processEvents(
    snapshot: GameplaySnapshot,
    events: readonly PresentationAudioEvent[],
    _deltaSeconds = 0,
  ): void {
    this.clearCompletedStinger();

    for (const event of events) {
      if (this.processedEventIds.has(event.id)) {
        continue;
      }
      this.processedEventIds.add(event.id);

      if (event.type === 'challengeEnding') {
        void this.requestStinger(snapshot.score > 0 ? 'victory' : 'defeat', snapshot);
      }
    }
  }

  async requestStinger(
    purpose: TransitionStingerPurpose,
    snapshot?: Pick<GameplaySnapshot, 'playState'>,
  ): Promise<boolean> {
    this.clearCompletedStinger();
    const triggerTimeSeconds = this.mixer.getCurrentTime();

    if (snapshot?.playState === 'live') {
      this.recordHistory(purpose, null, 'suppressed', 'livePlay', triggerTimeSeconds);
      return false;
    }

    if (this.activeStinger) {
      this.recordHistory(purpose, this.activeStinger.assetId, 'suppressed', 'activeStinger', triggerTimeSeconds);
      return false;
    }

    const track = getTransitionStinger(purpose);
    if (!track) {
      this.recordHistory(purpose, null, 'suppressed', 'missingAsset', triggerTimeSeconds);
      return false;
    }

    const suppressionReason = this.getPlaybackSuppressionReason();
    if (suppressionReason) {
      this.recordHistory(purpose, track.assetId, 'suppressed', suppressionReason, triggerTimeSeconds);
      return false;
    }

    this.recordHistory(purpose, track.assetId, 'requested', null, triggerTimeSeconds);
    const handle = await this.playTracked(track.assetId);
    if (!handle) {
      this.recordHistory(purpose, track.assetId, 'suppressed', 'missingAsset', triggerTimeSeconds);
      return false;
    }

    this.activeStinger = {
      assetId: track.assetId,
      handle,
      purpose,
      startedAtSeconds: handle.startedAt,
    };
    this.recordHistory(purpose, track.assetId, 'played', null, handle.startedAt);
    void handle.ended.then(() => {
      if (this.activeStinger?.handle === handle) {
        this.recordHistory(purpose, track.assetId, 'ended', null, this.mixer.getCurrentTime());
        this.activeStinger = null;
      }
    });
    return true;
  }

  getSnapshot(): GameMusicDirectorSnapshot {
    this.clearCompletedStinger();
    return {
      activeStinger: this.activeStinger
        ? {
            assetId: this.activeStinger.assetId,
            purpose: this.activeStinger.purpose,
            startedAtSeconds: this.activeStinger.startedAtSeconds,
          }
        : null,
      history: this.history.map((entry) => ({ ...entry })),
      suppressionReason: this.getPlaybackSuppressionReason(),
    };
  }

  private async playTracked(assetId: string): Promise<AudioPlaybackHandle | null> {
    if (this.mixer.playOneShotTracked) {
      return this.mixer.playOneShotTracked(assetId);
    }

    const played = await this.mixer.playOneShot(assetId);
    if (!played) {
      return null;
    }

    const startedAt = this.mixer.getCurrentTime();
    return {
      assetId,
      category: 'music',
      ended: Promise.resolve({
        assetId,
        category: 'music',
        endedAt: startedAt,
        reason: 'ended',
        startedAt,
        stopped: false,
      }),
      startedAt,
      stop: () => undefined,
    };
  }

  private clearCompletedStinger(): void {
    if (!this.activeStinger) {
      return;
    }

    const snapshot = this.mixer.getSnapshot();
    if (!snapshot.activeOneShots && this.activeStinger.handle === null) {
      this.activeStinger = null;
    }
  }

  private getPlaybackSuppressionReason(): GameMusicHistoryEntry['reason'] {
    const snapshot = this.mixer.getSnapshot();

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
    purpose: TransitionStingerPurpose,
    assetId: string | null,
    status: GameMusicHistoryEntry['status'],
    reason: GameMusicHistoryEntry['reason'],
    triggerTimeSeconds: number,
  ): void {
    this.history.unshift({
      assetId,
      purpose,
      reason,
      status,
      triggerTimeSeconds,
    });
    this.history.splice(GAME_MUSIC_CONFIG.historyLimit);
  }
}
