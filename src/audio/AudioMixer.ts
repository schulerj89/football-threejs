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
  activeAudioNodeCount: number;
  activeBuses: AudioBusName[];
  activeLoops: string[];
  activeOneShots: number;
  activeSourceCount: number;
  announcerEnabled: boolean;
  busGains: Record<AudioBusName, number>;
  captionsEnabled: boolean;
  crowdDuckingGain: number;
  contextState: AudioContextState | 'unavailable';
  decodedAssetIds: string[];
  decodedBufferBytes: number;
  enabled: boolean;
  lastUnlockError: string | null;
  loadedAssetIds: string[];
  loadedCompressedBytes: number;
  longestLoadedClipSeconds: number | null;
  missingOptionalAssetIds: string[];
  muted: boolean;
  preparedMediaElementSourceCount: number;
  streamedAssetIds: string[];
  userGestureUnlocked: boolean;
}

export interface AudioLoopStartOptions {
  gain?: number;
  rampSeconds?: number;
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
  gainValue: number;
  source: MediaElementAudioSourceNode;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

interface ActiveOneShot {
  asset: LocalAudioAsset;
  gain: GainNode;
  source: AudioBufferSourceNode;
}

const DEFAULT_AUDIO_FLAGS: AudioFeatureFlags = {
  announcerEnabled: true,
  audioDebug: false,
  audioEnabled: true,
  crowdAudioEnabled: true,
};
const BUS_GAIN_RAMP_SECONDS = 0.035;
const LOOP_GAIN_RAMP_SECONDS = 0.08;
const ONE_SHOT_ATTACK_SECONDS = 0.005;

export class AudioMixer {
  readonly context: AudioContext;
  readonly buses: BusGainMap;

  private readonly activeLoops = new Map<string, ActiveLoop>();
  private readonly activeOneShotsByAsset = new Map<string, number>();
  private flags: AudioFeatureFlags;
  private readonly loader: AudioAssetLoader;
  private readonly preparedLoops = new Map<string, ActiveLoop>();
  private readonly reportedBusGains: Record<AudioBusName, number> = {
    announcer: 0,
    crowd: 0,
    gameplaySfx: 0,
    master: 0,
    music: 0,
    ui: 0,
  };
  private readonly activeOneShotNodes = new Set<ActiveOneShot>();
  private readonly storage: StorageLike | null;
  private crowdDuckingGain = 1;
  private lastUnlockError: string | null = null;
  private settings: AudioSettings;
  private unlockListenersInstalled = false;
  private userGestureUnlocked = false;

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
      this.userGestureUnlocked = true;
      return true;
    }

    try {
      await this.context.resume();
      this.lastUnlockError = null;
      this.userGestureUnlocked = isAudioContextRunning(this.context);
      return this.userGestureUnlocked;
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

  setFeatureFlags(patch: Partial<AudioFeatureFlags>): AudioFeatureFlags {
    this.flags = {
      ...this.flags,
      ...patch,
    };
    this.applySettings();
    return { ...this.flags };
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
    setGainNow(gain.gain, 0, this.context.currentTime);
    scheduleGain(gain.gain, asset.defaultGain, this.context.currentTime, ONE_SHOT_ATTACK_SECONDS);
    source.connect(gain);
    gain.connect(this.getBusForCategory(asset.category));
    this.activeOneShotsByAsset.set(asset.assetId, activeCount + 1);
    const oneShotNodes = { asset, gain, source };
    this.activeOneShotNodes.add(oneShotNodes);
    source.onended = (): void => {
      this.releaseOneShot(oneShotNodes);
    };
    source.start();
    return true;
  }

  stopOneShotsByCategory(category: AudioPlaybackCategory): number {
    let stoppedCount = 0;

    for (const node of [...this.activeOneShotNodes]) {
      if (node.asset.category !== category) {
        continue;
      }

      stoppedCount += 1;
      scheduleGain(node.gain.gain, 0, this.context.currentTime, ONE_SHOT_ATTACK_SECONDS);

      if (typeof node.source.stop === 'function') {
        try {
          node.source.stop(this.context.currentTime + ONE_SHOT_ATTACK_SECONDS);
        } catch {
          this.releaseOneShot(node);
        }
      } else {
        this.releaseOneShot(node);
      }
    }

    return stoppedCount;
  }

  setCrowdDuckingGain(gain: number): void {
    this.crowdDuckingGain = clampGain(gain);
    this.applySettings();
  }

  async startLoop(assetId: string, options: AudioLoopStartOptions = {}): Promise<boolean> {
    if (!this.canPlay()) {
      return false;
    }

    const activeLoop = this.activeLoops.get(assetId);

    if (activeLoop) {
      if (options.gain !== undefined) {
        this.rampLoopGain(activeLoop, options.gain, options.rampSeconds);
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
      setGainNow(gain.gain, 0, this.context.currentTime);
      source.connect(gain);
      gain.connect(this.getBusForCategory(streamedAsset.asset.category));
      loop = {
        asset: streamedAsset.asset,
        element: streamedAsset.element,
        gain,
        gainValue: 0,
        source,
        stopTimer: null,
      };
      this.preparedLoops.set(assetId, loop);
    }

    if (loop.stopTimer) {
      clearTimeout(loop.stopTimer);
      loop.stopTimer = null;
    }
    this.rampLoopGain(loop, options.gain ?? loop.asset.defaultGain, options.rampSeconds);

    try {
      await loop.element.play();
    } catch (error) {
      this.loader.reportMissingOptionalAsset(
        loop.asset.assetId,
        error instanceof Error ? error.message : String(error),
      );
      this.rampLoopGain(loop, 0);
      return false;
    }

    this.activeLoops.set(assetId, loop);
    return true;
  }

  setLoopGain(assetId: string, gain: number, rampSeconds?: number): boolean {
    const activeLoop = this.activeLoops.get(assetId);

    if (!activeLoop) {
      return false;
    }

    this.rampLoopGain(activeLoop, gain, rampSeconds);
    return true;
  }

  getLoopGain(assetId: string): number {
    return this.activeLoops.get(assetId)?.gainValue ?? 0;
  }

  hasActiveLoop(assetId: string): boolean {
    return this.activeLoops.has(assetId);
  }

  stopLoop(assetId: string): boolean {
    const activeLoop = this.activeLoops.get(assetId);

    if (!activeLoop) {
      return false;
    }

    this.rampLoopGain(activeLoop, 0);
    if (activeLoop.stopTimer) {
      clearTimeout(activeLoop.stopTimer);
    }
    activeLoop.stopTimer = setTimeout(() => {
      if (activeLoop.gainValue > 0) {
        return;
      }

      activeLoop.element.pause();
      this.activeLoops.delete(assetId);
    }, LOOP_GAIN_RAMP_SECONDS * 1000);
    return true;
  }

  getSnapshot(): AudioMixerSnapshot {
    const loaderSnapshot = this.loader.getSnapshot();

    return {
      activeAudioNodeCount: this.getActiveAudioNodeCount(),
      activeBuses: getActiveBuses(this.reportedBusGains),
      activeLoops: [...this.activeLoops.keys()].sort(),
      activeOneShots: [...this.activeOneShotsByAsset.values()].reduce(
        (sum, count) => sum + count,
        0,
      ),
      activeSourceCount: this.activeLoops.size + this.activeOneShotNodes.size,
      announcerEnabled: this.flags.announcerEnabled && this.settings.announcerEnabled,
      busGains: { ...this.reportedBusGains },
      captionsEnabled: this.settings.captionsEnabled,
      crowdDuckingGain: this.crowdDuckingGain,
      contextState: this.context.state,
      decodedAssetIds: loaderSnapshot.decodedAssetIds,
      decodedBufferBytes: loaderSnapshot.decodedBufferBytes,
      enabled: this.flags.audioEnabled,
      lastUnlockError: this.lastUnlockError,
      loadedAssetIds: loaderSnapshot.loadedAssetIds,
      loadedCompressedBytes: loaderSnapshot.loadedCompressedBytes,
      longestLoadedClipSeconds: loaderSnapshot.longestLoadedClipSeconds,
      missingOptionalAssetIds: loaderSnapshot.missingOptionalAssetIds,
      muted: this.settings.muted,
      preparedMediaElementSourceCount: this.preparedLoops.size,
      streamedAssetIds: loaderSnapshot.streamedAssetIds,
      userGestureUnlocked: this.userGestureUnlocked,
    };
  }

  getLoaderSnapshot(): AudioAssetLoaderSnapshot {
    return this.loader.getSnapshot();
  }

  getCurrentTime(): number {
    return this.context.currentTime;
  }

  private applySettings(): void {
    this.setBusGain(
      'master',
      this.flags.audioEnabled && !this.settings.muted ? this.settings.masterVolume : 0,
    );
    this.setBusGain(
      'crowd',
      this.flags.crowdAudioEnabled ? this.settings.crowdVolume * this.crowdDuckingGain : 0,
    );
    this.setBusGain(
      'announcer',
      this.flags.announcerEnabled && this.settings.announcerEnabled
        ? this.settings.announcerVolume
        : 0,
    );
    this.setBusGain('gameplaySfx', this.settings.effectsVolume);
    this.setBusGain('music', this.settings.musicVolume);
    this.setBusGain('ui', this.settings.effectsVolume);
    saveAudioSettings(this.settings, this.storage);
  }

  private setBusGain(busName: AudioBusName, gain: number): void {
    const targetGain = clampGain(gain);
    this.reportedBusGains[busName] = targetGain;
    scheduleGain(this.buses[busName].gain, targetGain, this.context.currentTime, BUS_GAIN_RAMP_SECONDS);
  }

  private rampLoopGain(loop: ActiveLoop, gain: number, rampSeconds = LOOP_GAIN_RAMP_SECONDS): void {
    const targetGain = clampGain(gain);
    loop.gainValue = targetGain;
    scheduleGain(loop.gain.gain, targetGain, this.context.currentTime, rampSeconds);
  }

  private getActiveAudioNodeCount(): number {
    return Object.keys(this.buses).length +
      (this.activeLoops.size * 2) +
      (this.activeOneShotNodes.size * 2);
  }

  private canPlay(): boolean {
    return this.flags.audioEnabled &&
      this.userGestureUnlocked &&
      !this.settings.muted &&
      this.context.state === 'running';
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
      return this.flags.announcerEnabled && this.settings.announcerEnabled;
    }

    return true;
  }

  private releaseOneShot(node: ActiveOneShot): void {
    if (!this.activeOneShotNodes.has(node)) {
      return;
    }

    const nextCount = Math.max(0, (this.activeOneShotsByAsset.get(node.asset.assetId) ?? 1) - 1);
    if (nextCount === 0) {
      this.activeOneShotsByAsset.delete(node.asset.assetId);
    } else {
      this.activeOneShotsByAsset.set(node.asset.assetId, nextCount);
    }
    node.source.disconnect();
    node.gain.disconnect();
    this.activeOneShotNodes.delete(node);
  }
}

function createBusGraph(audioContext: AudioContext): BusGainMap {
  const master = audioContext.createGain();
  const crowd = audioContext.createGain();
  const announcer = audioContext.createGain();
  const gameplaySfx = audioContext.createGain();
    const music = audioContext.createGain();
    const ui = audioContext.createGain();

    crowd.connect(master);
    announcer.connect(master);
    gameplaySfx.connect(master);
    music.connect(master);
    ui.connect(master);
  master.connect(audioContext.destination);

  return {
    announcer,
    crowd,
    gameplaySfx,
    master,
    music,
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

function getActiveBuses(busGains: Record<AudioBusName, number>): AudioBusName[] {
  return (Object.keys(busGains) as AudioBusName[]).filter((busName) => busGains[busName] > 0);
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

function setGainNow(param: AudioParam, gain: number, currentTime: number): void {
  const targetGain = clampGain(gain);

  if (typeof param.cancelScheduledValues === 'function') {
    param.cancelScheduledValues(currentTime);
  }

  if (typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(targetGain, currentTime);
  } else {
    param.value = targetGain;
  }
}

function scheduleGain(
  param: AudioParam,
  gain: number,
  currentTime: number,
  rampSeconds: number,
): void {
  const targetGain = clampGain(gain);
  const currentGain = clampGain(param.value);

  if (
    typeof param.cancelScheduledValues === 'function' &&
    typeof param.setValueAtTime === 'function' &&
    typeof param.linearRampToValueAtTime === 'function' &&
    rampSeconds > 0
  ) {
    param.cancelScheduledValues(currentTime);
    param.setValueAtTime(currentGain, currentTime);
    param.linearRampToValueAtTime(targetGain, currentTime + rampSeconds);
    return;
  }

  param.value = targetGain;
}
