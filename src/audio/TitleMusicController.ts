import { GAME_BRAND } from '../config/GameBrand';
import type { AudioMixerSnapshot, AudioLoopStartOptions } from './AudioMixer';

export type TitleMusicState =
  | 'disabled'
  | 'handoff'
  | 'idle'
  | 'playing'
  | 'starting'
  | 'unavailable';

export interface TitleMusicControllerSnapshot {
  assetId: string;
  attempted: boolean;
  handoffRequested: boolean;
  loopActive: boolean;
  state: TitleMusicState;
}

export interface TitleMusicPlaybackPort {
  getSnapshot(): AudioMixerSnapshot;
  hasActiveLoop(assetId: string): boolean;
  startLoop(assetId: string, options?: AudioLoopStartOptions): Promise<boolean>;
  unlockFromUserGesture(): Promise<boolean>;
}

export interface TitleMusicControllerOptions {
  assetId?: string;
  fadeInSeconds?: number;
  gain?: number;
}

const DEFAULT_TITLE_MUSIC_CONFIG = {
  fadeInSeconds: 1.2,
  gain: 0.72,
} as const;

export class TitleMusicController {
  private readonly assetId: string;
  private readonly fadeInSeconds: number;
  private readonly gain: number;
  private attempted = false;
  private handoffRequested = false;
  private pendingStart: Promise<boolean> | null = null;
  private state: TitleMusicState = 'idle';

  constructor(
    private readonly mixer: TitleMusicPlaybackPort,
    options: TitleMusicControllerOptions = {},
  ) {
    this.assetId = options.assetId ?? GAME_BRAND.titleMusicId;
    this.fadeInSeconds = options.fadeInSeconds ?? DEFAULT_TITLE_MUSIC_CONFIG.fadeInSeconds;
    this.gain = options.gain ?? DEFAULT_TITLE_MUSIC_CONFIG.gain;
  }

  startFromUserGesture(): Promise<boolean> {
    this.attempted = true;

    if (!this.assetId) {
      this.state = 'unavailable';
      return Promise.resolve(false);
    }

    const snapshot = this.mixer.getSnapshot();

    if (!snapshot.enabled) {
      this.state = 'disabled';
      return Promise.resolve(false);
    }

    if (this.mixer.hasActiveLoop(this.assetId)) {
      this.state = this.handoffRequested ? 'handoff' : 'playing';
      return Promise.resolve(true);
    }

    if (this.pendingStart) {
      return this.pendingStart;
    }

    this.state = 'starting';
    this.pendingStart = this.start()
      .finally(() => {
        this.pendingStart = null;
      });
    return this.pendingStart;
  }

  handoffToPregame(): TitleMusicControllerSnapshot {
    this.handoffRequested = true;
    if (this.mixer.hasActiveLoop(this.assetId)) {
      this.state = 'handoff';
    }
    return this.getSnapshot();
  }

  getSnapshot(): TitleMusicControllerSnapshot {
    return {
      assetId: this.assetId,
      attempted: this.attempted,
      handoffRequested: this.handoffRequested,
      loopActive: this.assetId ? this.mixer.hasActiveLoop(this.assetId) : false,
      state: this.state,
    };
  }

  private async start(): Promise<boolean> {
    const unlocked = await this.mixer.unlockFromUserGesture();

    if (!unlocked) {
      const snapshot = this.mixer.getSnapshot();
      this.state = snapshot.enabled ? 'idle' : 'disabled';
      return false;
    }

    const started = await this.mixer.startLoop(this.assetId, {
      gain: this.gain,
      rampSeconds: this.fadeInSeconds,
    });
    this.state = started
      ? this.handoffRequested
        ? 'handoff'
        : 'playing'
      : 'unavailable';
    return started;
  }
}
