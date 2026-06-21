import {
  LOCAL_AUDIO_ASSET_MANIFEST,
  type AudioBusName,
  type AudioPlaybackCategory,
  type LocalAudioAsset,
} from './AudioAssetManifest';
import { AudioAssetLoader, type AudioAssetLoaderSnapshot } from './AudioAssetLoader';
import {
  DEFAULT_AUDIO_SETTINGS,
  saveAudioSettings,
  updateAudioSettings,
  type AudioFeatureFlags,
  type AudioSettings,
  type StorageLike,
} from './AudioSettings';

type BusGainMap = Record<AudioBusName, GainNode>;

export interface AudioMixerSnapshot {
  activeBuses: AudioBusName[];
  activeLoops: string[];
  activeOneShots: number;
  busGains: Record<AudioBusName, number>;
  contextState: AudioContextState | 'unavailable';
  decodedBufferBytes: number;
  enabled: boolean;
  lastUnlockError: string | null;
  loadedAssetIds: string[];
  loadedCompressedBytes: number;
  missingOptionalAssetIds: string[];
  muted: boolean;
  streamedAssetIds: string[];
}

export interface AudioLoopStartOptions {
  gain?: number;
}

export interface AudioMixerOptions {
  audioContextFactory?: () => AudioContext;
  flags?: AudioFeatureFlags;
  loader?: AudioAssetLoader;
  manifest?: readonly LocalAudioAsset[];
  settings?: AudioSettings;
  storage?: StorageLike | null;
  warn?: (message: string) => void;
}

interface ActiveLoop {
  asset: LocalAudioAsset;
  element: HTMLAudioElement;
  gain: GainNode;
  source: MediaElementAudioSourceNode;
}

const DEFAULT_AUDIO_FLAGS: AudioFeatureFlags = {
  announcerEnabled: true,
  audioDebug: false,
  audioEnabled: true,
  crowdAudioEnabled: true,
};

export class AudioMixer {
  readonly context: AudioContext;
  readonly buses: BusGainMap;

  private readonly activeLoops = new Map<string, ActiveLoop>();
  private readonly activeOneShotsByAsset = new Map<string, number>();
  private readonly flags: AudioFeatureFlags;
  private readonly loader: AudioAssetLoader;
  private readonly preparedLoops = new Map<string, ActiveLoop>();
  private readonly storage: StorageLike | null;
  private lastUnlockError: string | null = null;
  private settings: AudioSettings;
  private unlockListenersInstalled = false;

  constructor(options: AudioMixerOptions = {}) {
    this.flags = options.flags ?? DEFAULT_AUDIO_FLAGS;
    this.settings = options.settings ?? DEFAULT_AUDIO_SETTINGS;
    this.storage = options.storage ?? null;
    this.context = (options.audioContextFactory ?? createBrowserAudioContext)();
    this.buses = createBusGraph(this.context);
    this.loader = options.loader ?? new AudioAssetLoader({
      audioContext: this.context,
      manifest: options.manifest ?? LOCAL_AUDIO_ASSET_MANIFEST,
      warn: options.warn,
    });
    this.applySettings();
  }

  installUserGestureUnlock(target: Window): void {
    if (this.unlockListenersInstalled) {
      return;
    }

    this.unlockListenersInstalled = true;
    const unlock = (): void => {
      void this.unlockFromUserGesture();
      target.removeEventListener('pointerdown', unlock);
      target.removeEventListener('keydown', unlock);
    };

    target.addEventListener('pointerdown', unlock);
    target.addEventListener('keydown', unlock);
  }

  async unlockFromUserGesture(): Promise<boolean> {
    if (!this.flags.audioEnabled) {
      return false;
    }

    if (isAudioContextRunning(this.context)) {
      return true;
    }

    try {
      await this.context.resume();
      this.lastUnlockError = null;
      return isAudioContextRunning(this.context);
    } catch (error) {
      this.lastUnlockError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  setSettings(patch: Partial<AudioSettings>): AudioSettings {
    this.settings = updateAudioSettings(this.settings, patch, this.storage);
    this.applySettings();
    return this.getSettings();
  }

  setMuted(muted: boolean): AudioSettings {
    return this.setSettings({ muted });
  }

  toggleMuted(): AudioSettings {
    return this.setMuted(!this.settings.muted);
  }

  async playOneShot(assetId: string): Promise<boolean> {
    if (!this.canPlay()) {
      return false;
    }

    const asset = this.loader.getAsset(assetId);

    if (!asset || asset.loadingStrategy !== 'buffer' || !this.isCategoryEnabled(asset.category)) {
      return false;
    }

    const activeCount = this.activeOneShotsByAsset.get(asset.assetId) ?? 0;

    if (activeCount >= asset.maxSimultaneousInstances) {
      return false;
    }

    const decodedAsset = await this.loader.loadDecodedBuffer(asset.assetId);

    if (!decodedAsset) {
      return false;
    }

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = decodedAsset.buffer;
    gain.gain.value = asset.defaultGain;
    source.connect(gain);
    gain.connect(this.getBusForCategory(asset.category));
    this.activeOneShotsByAsset.set(asset.assetId, activeCount + 1);
    source.onended = (): void => {
      const nextCount = Math.max(0, (this.activeOneShotsByAsset.get(asset.assetId) ?? 1) - 1);
      if (nextCount === 0) {
        this.activeOneShotsByAsset.delete(asset.assetId);
      } else {
        this.activeOneShotsByAsset.set(asset.assetId, nextCount);
      }
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    return true;
  }

  async startLoop(assetId: string, options: AudioLoopStartOptions = {}): Promise<boolean> {
    if (!this.canPlay()) {
      return false;
    }

    const activeLoop = this.activeLoops.get(assetId);

    if (activeLoop) {
      if (options.gain !== undefined) {
        activeLoop.gain.gain.value = clampGain(options.gain);
      }
      return true;
    }

    if (this.loader.isMissingOptionalAsset(assetId)) {
      return false;
    }

    let loop = this.preparedLoops.get(assetId);

    if (!loop) {
      const streamedAsset = this.loader.loadStream(assetId);

      if (!streamedAsset || !this.isCategoryEnabled(streamedAsset.asset.category)) {
        return false;
      }

      const source = this.context.createMediaElementSource(streamedAsset.element);
      const gain = this.context.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.getBusForCategory(streamedAsset.asset.category));
      loop = {
        asset: streamedAsset.asset,
        element: streamedAsset.element,
        gain,
        source,
      };
      this.preparedLoops.set(assetId, loop);
    }

    loop.gain.gain.value = clampGain(options.gain ?? loop.asset.defaultGain);

    try {
      await loop.element.play();
    } catch (error) {
      this.loader.reportMissingOptionalAsset(
        loop.asset.assetId,
        error instanceof Error ? error.message : String(error),
      );
      loop.gain.gain.value = 0;
      return false;
    }

    this.activeLoops.set(assetId, loop);
    return true;
  }

  setLoopGain(assetId: string, gain: number): boolean {
    const activeLoop = this.activeLoops.get(assetId);

    if (!activeLoop) {
      return false;
    }

    activeLoop.gain.gain.value = clampGain(gain);
    return true;
  }

  getLoopGain(assetId: string): number {
    return this.activeLoops.get(assetId)?.gain.gain.value ?? 0;
  }

  hasActiveLoop(assetId: string): boolean {
    return this.activeLoops.has(assetId);
  }

  stopLoop(assetId: string): boolean {
    const activeLoop = this.activeLoops.get(assetId);

    if (!activeLoop) {
      return false;
    }

    activeLoop.element.pause();
    activeLoop.gain.gain.value = 0;
    this.activeLoops.delete(assetId);
    return true;
  }

  getSnapshot(): AudioMixerSnapshot {
    const loaderSnapshot = this.loader.getSnapshot();

    return {
      activeBuses: getActiveBuses(this.buses),
      activeLoops: [...this.activeLoops.keys()].sort(),
      activeOneShots: [...this.activeOneShotsByAsset.values()].reduce(
        (sum, count) => sum + count,
        0,
      ),
      busGains: Object.fromEntries(
        Object.entries(this.buses).map(([busName, bus]) => [busName, bus.gain.value]),
      ) as Record<AudioBusName, number>,
      contextState: this.context.state,
      decodedBufferBytes: loaderSnapshot.decodedBufferBytes,
      enabled: this.flags.audioEnabled,
      lastUnlockError: this.lastUnlockError,
      loadedAssetIds: loaderSnapshot.loadedAssetIds,
      loadedCompressedBytes: loaderSnapshot.loadedCompressedBytes,
      missingOptionalAssetIds: loaderSnapshot.missingOptionalAssetIds,
      muted: this.settings.muted,
      streamedAssetIds: loaderSnapshot.streamedAssetIds,
    };
  }

  getLoaderSnapshot(): AudioAssetLoaderSnapshot {
    return this.loader.getSnapshot();
  }

  getCurrentTime(): number {
    return this.context.currentTime;
  }

  private applySettings(): void {
    this.buses.master.gain.value =
      this.flags.audioEnabled && !this.settings.muted ? this.settings.masterVolume : 0;
    this.buses.crowd.gain.value =
      this.flags.crowdAudioEnabled ? this.settings.crowdVolume : 0;
    this.buses.announcer.gain.value =
      this.flags.announcerEnabled ? this.settings.announcerVolume : 0;
    this.buses.gameplaySfx.gain.value = this.settings.effectsVolume;
    this.buses.ui.gain.value = this.settings.effectsVolume;
    saveAudioSettings(this.settings, this.storage);
  }

  private canPlay(): boolean {
    return this.flags.audioEnabled && !this.settings.muted && this.context.state === 'running';
  }

  private getBusForCategory(category: AudioPlaybackCategory): GainNode {
    if (category === 'gameplaySfx') {
      return this.buses.gameplaySfx;
    }

    return this.buses[category];
  }

  private isCategoryEnabled(category: AudioPlaybackCategory): boolean {
    if (category === 'crowd') {
      return this.flags.crowdAudioEnabled;
    }

    if (category === 'announcer') {
      return this.flags.announcerEnabled;
    }

    return true;
  }
}

function createBusGraph(audioContext: AudioContext): BusGainMap {
  const master = audioContext.createGain();
  const crowd = audioContext.createGain();
  const announcer = audioContext.createGain();
  const gameplaySfx = audioContext.createGain();
  const ui = audioContext.createGain();

  crowd.connect(master);
  announcer.connect(master);
  gameplaySfx.connect(master);
  ui.connect(master);
  master.connect(audioContext.destination);

  return {
    announcer,
    crowd,
    gameplaySfx,
    master,
    ui,
  };
}

function createBrowserAudioContext(): AudioContext {
  const AudioContextConstructor =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error('AudioContext is not available in this browser');
  }

  return new AudioContextConstructor();
}

function getActiveBuses(buses: BusGainMap): AudioBusName[] {
  return (Object.keys(buses) as AudioBusName[]).filter((busName) => buses[busName].gain.value > 0);
}

function isAudioContextRunning(context: AudioContext): boolean {
  return context.state === 'running';
}

function clampGain(gain: number): number {
  if (!Number.isFinite(gain)) {
    return 0;
  }

  return Math.min(1, Math.max(0, gain));
}
