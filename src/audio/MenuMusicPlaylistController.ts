import type { AudioMixerSnapshot, AudioLoopStartOptions } from './AudioMixer';
import type { AudioSettings } from './AudioSettings';
import {
  MENU_MUSIC_TRACKS,
  type MenuMusicTrack,
  type MenuPlaylistOrder,
} from './MusicCatalog';
import type {
  TitleMusicControllerSnapshot,
  TitleMusicPlaybackPort,
  TitleMusicState,
} from './TitleMusicController';

export interface MenuMusicPlaylistControllerOptions {
  fadeInSeconds?: number;
  gain?: number;
  tracks?: readonly MenuMusicTrack[];
}

export interface MenuMusicPlaylistSnapshot extends TitleMusicControllerSnapshot {
  composerDisplay: string | null;
  currentIndex: number;
  nextAssetId: string | null;
  nextTitle: string | null;
  playbackSeconds: number;
  playlistOrder: MenuPlaylistOrder;
  trackCount: number;
  trackTitle: string | null;
}

export interface MenuMusicPlaybackPort extends TitleMusicPlaybackPort {
  getSettings(): AudioSettings;
}

const DEFAULT_MENU_MUSIC_CONFIG = {
  fadeInSeconds: 1.2,
  gain: 0.72,
} as const;

export class MenuMusicPlaylistController {
  private readonly fadeInSeconds: number;
  private readonly gain: number;
  private readonly tracks: readonly MenuMusicTrack[];
  private attempted = false;
  private currentIndex = 0;
  private handoffRequested = false;
  private pendingStart: Promise<boolean> | null = null;
  private playbackSeconds = 0;
  private pregameDucked = false;
  private shuffleStep = 0;
  private state: TitleMusicState = 'idle';

  constructor(
    private readonly mixer: MenuMusicPlaybackPort,
    options: MenuMusicPlaylistControllerOptions = {},
  ) {
    this.fadeInSeconds = options.fadeInSeconds ?? DEFAULT_MENU_MUSIC_CONFIG.fadeInSeconds;
    this.gain = options.gain ?? DEFAULT_MENU_MUSIC_CONFIG.gain;
    this.tracks = options.tracks ?? MENU_MUSIC_TRACKS;
  }

  startFromUserGesture(): Promise<boolean> {
    this.attempted = true;

    if (this.tracks.length === 0) {
      this.state = 'unavailable';
      return Promise.resolve(false);
    }

    const snapshot = this.mixer.getSnapshot();
    const settings = this.mixer.getSettings();

    if (!snapshot.enabled || !settings.musicEnabled) {
      this.state = 'disabled';
      return Promise.resolve(false);
    }

    const assetId = this.currentTrack.assetId;
    if (this.mixer.hasActiveLoop(assetId)) {
      this.state = this.handoffRequested ? 'handoff' : 'playing';
      return Promise.resolve(true);
    }

    if (this.pendingStart) {
      return this.pendingStart;
    }

    this.state = 'starting';
    this.pendingStart = this.startCurrentTrack(this.fadeInSeconds)
      .finally(() => {
        this.pendingStart = null;
      });
    return this.pendingStart;
  }

  update(deltaSeconds: number): void {
    const safeDelta = clampDelta(deltaSeconds);
    const settings = this.mixer.getSettings();

    if (!settings.musicEnabled) {
      this.fadeOutForGameplay(0.2);
      this.state = 'disabled';
      return;
    }

    if (!this.isCurrentTrackActive()) {
      return;
    }

    this.playbackSeconds += safeDelta;
    if (this.playbackSeconds < this.currentTrack.durationSeconds) {
      return;
    }

    void this.nextTrack('auto');
  }

  handoffToPregame(): MenuMusicPlaylistSnapshot {
    this.handoffRequested = true;
    if (this.isCurrentTrackActive()) {
      this.state = 'handoff';
    }
    return this.getSnapshot();
  }

  setPregameDucking(ducked: boolean, duckGain = 0.34, rampSeconds = 0.25): void {
    if (this.pregameDucked === ducked) {
      return;
    }

    this.pregameDucked = ducked;
    if (!this.isCurrentTrackActive()) {
      return;
    }

    this.mixer.setLoopGain(this.currentTrack.assetId, ducked ? duckGain : this.gain, rampSeconds);
    if (this.state !== 'fadingOut') {
      this.state = this.handoffRequested ? 'handoff' : 'playing';
    }
  }

  fadeOutForGameplay(rampSeconds = 1.35): void {
    for (const track of this.tracks) {
      if (this.mixer.hasActiveLoop(track.assetId)) {
        this.mixer.stopLoop(track.assetId, rampSeconds);
      }
    }

    this.pregameDucked = false;
    this.handoffRequested = false;
    this.state = this.attempted ? 'fadingOut' : 'idle';
  }

  async nextTrack(reason: 'auto' | 'manual' = 'manual'): Promise<boolean> {
    if (this.tracks.length <= 1) {
      return this.startFromUserGesture();
    }

    const previousTrack = this.currentTrack;
    this.currentIndex = this.resolveNextIndex(1);
    this.playbackSeconds = 0;
    this.pregameDucked = false;
    if (this.mixer.hasActiveLoop(previousTrack.assetId)) {
      this.mixer.stopLoop(previousTrack.assetId, reason === 'auto' ? 0.45 : 0.16);
    }
    return this.startCurrentTrack(reason === 'auto' ? 0.45 : 0.16);
  }

  async previousTrack(): Promise<boolean> {
    if (this.tracks.length <= 1) {
      return this.startFromUserGesture();
    }

    const previousTrack = this.currentTrack;
    this.currentIndex = this.resolveNextIndex(-1);
    this.playbackSeconds = 0;
    this.pregameDucked = false;
    if (this.mixer.hasActiveLoop(previousTrack.assetId)) {
      this.mixer.stopLoop(previousTrack.assetId, 0.16);
    }
    return this.startCurrentTrack(0.16);
  }

  getSnapshot(): MenuMusicPlaylistSnapshot {
    const currentTrack = this.tracks[this.currentIndex] ?? null;
    const nextTrack = this.tracks[this.resolveNextIndex(1)] ?? null;

    return {
      assetId: currentTrack?.assetId ?? '',
      attempted: this.attempted,
      composerDisplay: currentTrack?.composerDisplay ?? null,
      currentIndex: this.tracks.length === 0 ? -1 : this.currentIndex,
      handoffRequested: this.handoffRequested,
      loopActive: currentTrack ? this.mixer.hasActiveLoop(currentTrack.assetId) : false,
      loopGain: currentTrack ? this.mixer.getLoopGain(currentTrack.assetId) : 0,
      nextAssetId: nextTrack?.assetId ?? null,
      nextTitle: nextTrack?.displayTitle ?? null,
      playbackSeconds: this.playbackSeconds,
      playlistOrder: this.mixer.getSettings().menuPlaylistOrder,
      state: this.state,
      trackCount: this.tracks.length,
      trackTitle: currentTrack?.displayTitle ?? null,
    };
  }

  private get currentTrack(): MenuMusicTrack {
    const track = this.tracks[this.currentIndex];
    if (!track) {
      throw new Error('Menu music playlist has no tracks');
    }
    return track;
  }

  private isCurrentTrackActive(): boolean {
    return this.tracks.length > 0 && this.mixer.hasActiveLoop(this.currentTrack.assetId);
  }

  private async startCurrentTrack(rampSeconds: number): Promise<boolean> {
    if (this.tracks.length === 0) {
      this.state = 'unavailable';
      return false;
    }

    const settings = this.mixer.getSettings();
    if (!settings.musicEnabled) {
      this.state = 'disabled';
      return false;
    }

    const unlocked = await this.mixer.unlockFromUserGesture();
    if (!unlocked) {
      const snapshot = this.mixer.getSnapshot();
      this.state = snapshot.enabled ? 'idle' : 'disabled';
      return false;
    }

    const started = await this.mixer.startLoop(this.currentTrack.assetId, {
      gain: this.pregameDucked ? Math.min(0.34, this.gain) : this.gain,
      rampSeconds,
    } satisfies AudioLoopStartOptions);
    this.state = started
      ? this.handoffRequested
        ? 'handoff'
        : 'playing'
      : 'unavailable';
    if (started) {
      this.playbackSeconds = 0;
    }
    return started;
  }

  private resolveNextIndex(direction: 1 | -1): number {
    const count = this.tracks.length;
    if (count === 0) {
      return -1;
    }

    if (this.mixer.getSettings().menuPlaylistOrder === 'shuffle') {
      this.shuffleStep += direction;
      const jump = Math.abs(stableHash(`${this.currentTrack.assetId}:${this.shuffleStep}`)) %
        (count - 1 || 1);
      const offset = direction === 1 ? jump + 1 : -(jump + 1);
      return wrapIndex(this.currentIndex + offset, count);
    }

    return wrapIndex(this.currentIndex + direction, count);
  }
}

function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

function clampDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return 0;
  }

  return Math.min(deltaSeconds, 0.5);
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
