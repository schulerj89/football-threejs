import type { GameplaySnapshot } from '../playState';
import { AudioMixer, type AudioMixerSnapshot } from './AudioMixer';
import { deriveGameAudioEvents, type GameAudioEvent } from './GameAudioEvents';

export interface GameAudioDirectorSnapshot extends AudioMixerSnapshot {
  recentEvents: GameAudioEvent[];
}

export class GameAudioDirector {
  private previousSnapshot: GameplaySnapshot | null = null;
  private recentEvents: GameAudioEvent[] = [];

  constructor(private readonly mixer: AudioMixer) {}

  installControls(target: Window): void {
    this.mixer.installUserGestureUnlock(target);
    target.addEventListener('keydown', this.handleMuteShortcut);
  }

  update(snapshot: GameplaySnapshot): void {
    this.recentEvents = deriveGameAudioEvents(this.previousSnapshot, snapshot);
    this.previousSnapshot = snapshot;
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
      recentEvents: this.recentEvents.map((event) => ({ ...event })),
    };
  }

  private readonly handleMuteShortcut = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== 'm') {
      return;
    }

    this.toggleMuted();
    event.preventDefault();
  };
}
