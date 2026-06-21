import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AudioAssetLoader } from '../src/audio/AudioAssetLoader';
import type { LocalAudioAsset } from '../src/audio/AudioAssetManifest';
import { AudioMixer } from '../src/audio/AudioMixer';
import { GameAudioDirector } from '../src/audio/GameAudioDirector';
import {
  AUDIO_SETTINGS_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  resolveAudioFeatureFlags,
  type AudioFeatureFlags,
  type StorageLike,
} from '../src/audio/AudioSettings';
import { createGameplayModel, snapshotGameplayModel } from '../src/playState';
import { createFootballAudioReport } from '../tools/audio/audioReport';

const BUFFER_TEST_ASSET: LocalAudioAsset = {
  assetId: 'test-one-shot',
  category: 'gameplaySfx',
  defaultGain: 0.5,
  loadingStrategy: 'buffer',
  loop: false,
  maxSimultaneousInstances: 1,
  optional: true,
  url: '/audio/sfx/test-one-shot.wav',
};

const STREAM_TEST_ASSET: LocalAudioAsset = {
  assetId: 'test-loop',
  category: 'crowd',
  defaultGain: 0.25,
  loadingStrategy: 'stream',
  loop: true,
  maxSimultaneousInstances: 1,
  optional: true,
  url: '/audio/crowd/test-loop.wav',
};

describe('runtime audio mixer', () => {
  it('creates one AudioContext and routes category buses into master', () => {
    const fakeContext = new FakeAudioContext('suspended');
    let factoryCalls = 0;

    const mixer = new AudioMixer({
      audioContextFactory: () => {
        factoryCalls += 1;
        return fakeContext.asAudioContext();
      },
      settings: DEFAULT_AUDIO_SETTINGS,
      storage: null,
    });

    expect(factoryCalls).toBe(1);
    expect(getFakeNode(mixer.buses.crowd).connections).toContain(mixer.buses.master);
    expect(getFakeNode(mixer.buses.announcer).connections).toContain(mixer.buses.master);
    expect(getFakeNode(mixer.buses.gameplaySfx).connections).toContain(mixer.buses.master);
    expect(getFakeNode(mixer.buses.ui).connections).toContain(mixer.buses.master);
    expect(getFakeNode(mixer.buses.master).connections).toContain(fakeContext.destination);
  });

  it('unlocks from the first user gesture without repeated resume calls', async () => {
    const fakeContext = new FakeAudioContext('suspended');
    const target = new EventTarget();
    const mixer = createMixer(fakeContext);

    mixer.installUserGestureUnlock(target as Window);
    target.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    target.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();

    expect(fakeContext.resumeCalls).toBe(1);
    expect(mixer.getSnapshot().contextState).toBe('running');
  });

  it('persists mute settings and maps mute to the master bus', () => {
    const storage = createMemoryStorage();
    const mixer = createMixer(new FakeAudioContext('running'), { storage });

    mixer.setMuted(true);

    expect(mixer.getSnapshot().muted).toBe(true);
    expect(mixer.getSnapshot().busGains.master).toBe(0);
    expect(JSON.parse(storage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      muted: true,
    });

    mixer.setMuted(false);

    expect(mixer.getSnapshot().muted).toBe(false);
    expect(mixer.getSnapshot().busGains.master).toBe(DEFAULT_AUDIO_SETTINGS.masterVolume);
    expect(getFakeGainNode(mixer.buses.master).gain.ramps.length).toBeGreaterThan(0);
  });

  it('loads persisted settings and resolves audio query flags', () => {
    const storage = createMemoryStorage();
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({
      crowdVolume: 0.2,
      masterVolume: 2,
      muted: true,
    }));

    expect(loadAudioSettings(storage)).toMatchObject({
      crowdVolume: 0.2,
      masterVolume: 1,
      muted: true,
    });
    expect(resolveAudioFeatureFlags(new URLSearchParams('audio=0&crowdAudio=0&announcer=0&audioDebug=1'))).toEqual({
      announcerEnabled: false,
      audioDebug: true,
      audioEnabled: false,
      crowdAudioEnabled: false,
    });
    expect(loadAudioSettings(storage).captionsEnabled).toBe(false);
  });

  it('warns once for a missing optional decoded asset and keeps startup non-fatal', async () => {
    const warnings: string[] = [];
    const loader = new AudioAssetLoader({
      audioContext: new FakeAudioContext('running').asAudioContext(),
      fetcher: async () => new Response(null, { status: 404 }) as Response,
      manifest: [BUFFER_TEST_ASSET],
      warn: (message) => warnings.push(message),
    });

    await expect(loader.loadDecodedBuffer(BUFFER_TEST_ASSET.assetId)).resolves.toBeNull();
    await expect(loader.loadDecodedBuffer(BUFFER_TEST_ASSET.assetId)).resolves.toBeNull();

    expect(warnings).toHaveLength(1);
    expect(loader.getSnapshot().missingOptionalAssetIds).toEqual([BUFFER_TEST_ASSET.assetId]);
  });

  it('skips known-missing optional decoded assets without retrying fetches', async () => {
    let fetchCalls = 0;
    const loader = new AudioAssetLoader({
      audioContext: new FakeAudioContext('running').asAudioContext(),
      fetcher: async () => {
        fetchCalls += 1;
        return new Response(null, { status: 404 }) as Response;
      },
      knownMissingAssetIds: [BUFFER_TEST_ASSET.assetId],
      manifest: [BUFFER_TEST_ASSET],
      warn: () => undefined,
    });

    await expect(loader.loadDecodedBuffer(BUFFER_TEST_ASSET.assetId)).resolves.toBeNull();

    expect(fetchCalls).toBe(0);
    expect(loader.getSnapshot().missingOptionalAssetIds).toEqual([BUFFER_TEST_ASSET.assetId]);
  });

  it('bounds decoded one-shot cache memory with least-recently-used eviction', async () => {
    const fakeContext = new FakeAudioContext('running');
    const assets = ['clip-a', 'clip-b', 'clip-c'].map((assetId) => ({
      ...BUFFER_TEST_ASSET,
      assetId,
      url: `/audio/sfx/${assetId}.mp3`,
    }));
    const loader = new AudioAssetLoader({
      audioContext: fakeContext.asAudioContext(),
      fetcher: async () => new Response(new ArrayBuffer(16)) as Response,
      manifest: assets,
      maxDecodedBufferBytes: 2048,
      warn: () => undefined,
    });

    await loader.loadDecodedBuffer('clip-a');
    await loader.loadDecodedBuffer('clip-b');
    await loader.loadDecodedBuffer('clip-a');
    await loader.loadDecodedBuffer('clip-c');

    expect(loader.getSnapshot().decodedBufferBudgetBytes).toBe(2048);
    expect(loader.getSnapshot().decodedBufferBytes).toBeLessThanOrEqual(2048);
    expect(loader.getSnapshot().decodedAssetIds).toEqual(['clip-a', 'clip-c']);
  });

  it('warns once when an optional streamed loop cannot play', async () => {
    const warnings: string[] = [];
    const fakeContext = new FakeAudioContext('running');
    const loader = new AudioAssetLoader({
      audioContext: fakeContext.asAudioContext(),
      createAudioElement: () =>
        createFakeAudioElement(STREAM_TEST_ASSET.url, async () => {
          throw new Error('missing stream');
        }),
      manifest: [STREAM_TEST_ASSET],
      warn: (message) => warnings.push(message),
    });
    const mixer = createMixer(fakeContext, { loader });
    await mixer.unlockFromUserGesture();

    await expect(mixer.startLoop(STREAM_TEST_ASSET.assetId)).resolves.toBe(false);
    await expect(mixer.startLoop(STREAM_TEST_ASSET.assetId)).resolves.toBe(false);

    expect(warnings).toHaveLength(1);
    expect(fakeContext.mediaSources).toHaveLength(1);
    expect(loader.getSnapshot().missingOptionalAssetIds).toEqual([STREAM_TEST_ASSET.assetId]);
  });

  it('enforces one-shot instance limits for decoded buffers', async () => {
    const fakeContext = new FakeAudioContext('running');
    const loader = new AudioAssetLoader({
      audioContext: fakeContext.asAudioContext(),
      fetcher: async () => new Response(new ArrayBuffer(16)) as Response,
      manifest: [BUFFER_TEST_ASSET],
      warn: () => undefined,
    });
    const mixer = createMixer(fakeContext, { loader });
    await mixer.unlockFromUserGesture();

    await expect(mixer.playOneShot(BUFFER_TEST_ASSET.assetId)).resolves.toBe(true);
    await expect(mixer.playOneShot(BUFFER_TEST_ASSET.assetId)).resolves.toBe(false);
    expect(mixer.getSnapshot().activeOneShots).toBe(1);
    expect(mixer.getSnapshot().activeSourceCount).toBe(1);
    expect(mixer.getSnapshot().activeAudioNodeCount).toBeGreaterThanOrEqual(7);

    fakeContext.bufferSources[0].finish();

    expect(mixer.getSnapshot().activeOneShots).toBe(0);
    expect(mixer.getSnapshot().activeSourceCount).toBe(0);
    await expect(mixer.playOneShot(BUFFER_TEST_ASSET.assetId)).resolves.toBe(true);
  });

  it('uses streamed media elements for long loop assets', async () => {
    const fakeContext = new FakeAudioContext('running');
    const fakeElement = createFakeAudioElement(STREAM_TEST_ASSET.url);
    const loader = new AudioAssetLoader({
      audioContext: fakeContext.asAudioContext(),
      createAudioElement: () => fakeElement,
      manifest: [STREAM_TEST_ASSET],
      warn: () => undefined,
    });
    const mixer = createMixer(fakeContext, { loader });
    await mixer.unlockFromUserGesture();

    await expect(mixer.startLoop(STREAM_TEST_ASSET.assetId)).resolves.toBe(true);

    expect(fakeContext.decodeCalls).toBe(0);
    expect(fakeContext.mediaSources).toHaveLength(1);
    expect(fakeElement.loop).toBe(true);
    expect(fakeElement.preload).toBe('metadata');
    expect(mixer.getSnapshot().activeLoops).toEqual([STREAM_TEST_ASSET.assetId]);
    expect(mixer.getSnapshot().preparedMediaElementSourceCount).toBe(1);
    expect(mixer.getSnapshot().streamedAssetIds).toEqual([STREAM_TEST_ASSET.assetId]);
  });

  it('reuses active loop instances while allowing gain updates', async () => {
    const fakeContext = new FakeAudioContext('running');
    const fakeElement = createFakeAudioElement(STREAM_TEST_ASSET.url);
    const loader = new AudioAssetLoader({
      audioContext: fakeContext.asAudioContext(),
      createAudioElement: () => fakeElement,
      manifest: [STREAM_TEST_ASSET],
      warn: () => undefined,
    });
    const mixer = createMixer(fakeContext, { loader });
    await mixer.unlockFromUserGesture();

    await expect(mixer.startLoop(STREAM_TEST_ASSET.assetId, { gain: 0 })).resolves.toBe(true);
    await expect(mixer.startLoop(STREAM_TEST_ASSET.assetId, { gain: 0.4 })).resolves.toBe(true);

    expect(fakeContext.mediaSources).toHaveLength(1);
    expect(mixer.hasActiveLoop(STREAM_TEST_ASSET.assetId)).toBe(true);
    expect(mixer.getLoopGain(STREAM_TEST_ASSET.assetId)).toBe(0.4);
    expect(getFakeGainNode(fakeContext.gains.at(-1)).gain.ramps.length).toBeGreaterThan(0);
    expect(mixer.setLoopGain(STREAM_TEST_ASSET.assetId, 0.2)).toBe(true);
    expect(mixer.getLoopGain(STREAM_TEST_ASSET.assetId)).toBe(0.2);
  });

  it('does not fetch generated audio when runtime audio is disabled', async () => {
    const fakeContext = new FakeAudioContext('running');
    let fetchCalls = 0;
    const loader = new AudioAssetLoader({
      audioContext: fakeContext.asAudioContext(),
      fetcher: async () => {
        fetchCalls += 1;
        return new Response(new ArrayBuffer(16)) as Response;
      },
      manifest: [BUFFER_TEST_ASSET, STREAM_TEST_ASSET],
      warn: () => undefined,
    });
    const mixer = createMixer(fakeContext, {
      flags: {
        announcerEnabled: true,
        audioDebug: true,
        audioEnabled: false,
        crowdAudioEnabled: true,
      },
      loader,
    });

    await expect(mixer.playOneShot(BUFFER_TEST_ASSET.assetId)).resolves.toBe(false);
    await expect(mixer.startLoop(STREAM_TEST_ASSET.assetId)).resolves.toBe(false);

    expect(fetchCalls).toBe(0);
    expect(loader.getSnapshot().loadedAssetIds).toEqual([]);
  });

  it('lets the audio director observe gameplay snapshots without mutating them', () => {
    const gameplay = createGameplayModel();
    const snapshot = snapshotGameplayModel(gameplay);
    const before = JSON.stringify(snapshot);
    const mixer = createMixer(new FakeAudioContext('running'));
    mixer.setMuted(true);
    const director = new GameAudioDirector(mixer);

    director.update(snapshot);

    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('keeps the planned starter audio pack under compressed and decoded-memory budgets', () => {
    const report = createFootballAudioReport();

    expect(report.underTarget).toBe(true);
    expect(report.totalCompressedBytes).toBeLessThanOrEqual(report.targetCompressedBytes);
    expect(report.decodedOneShotMemoryUnderBudget).toBe(true);
    expect(report.decodedOneShotMemoryBytes).toBeLessThanOrEqual(
      report.decodedOneShotMemoryBudgetBytes,
    );
    expect(report.largestDecodedBufferBytes).toBeLessThanOrEqual(
      report.decodedOneShotMemoryBudgetBytes,
    );
    expect(report.totalBufferedDecodedMemoryBytes).toBeGreaterThanOrEqual(
      report.decodedOneShotMemoryBytes,
    );
    expect(
      report.assets
        .filter((asset) => asset.kind === 'loop')
        .every((asset) => asset.runtimeLoadingStrategy === 'stream'),
    ).toBe(true);
    expect(
      report.assets
        .filter((asset) => asset.kind === 'oneShot')
        .every((asset) => asset.runtimeLoadingStrategy === 'buffer'),
    ).toBe(true);
  });

  it('keeps ElevenLabs API code out of browser-facing source', () => {
    const sourceText = readSourceTree(join(process.cwd(), 'src'));

    expect(sourceText).not.toContain('ELEVENLABS_API_KEY');
    expect(sourceText).not.toMatch(/VITE_ELEVENLABS/i);
    expect(sourceText).not.toContain('@elevenlabs/elevenlabs-js');
  });
});

function createMixer(
  fakeContext: FakeAudioContext,
  options: {
    flags?: AudioFeatureFlags;
    loader?: AudioAssetLoader;
    storage?: StorageLike | null;
  } = {},
): AudioMixer {
  return new AudioMixer({
    audioContextFactory: () => fakeContext.asAudioContext(),
    flags: options.flags,
    loader: options.loader,
    settings: DEFAULT_AUDIO_SETTINGS,
    storage: options.storage ?? null,
  });
}

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function createFakeAudioElement(
  url: string,
  play: () => Promise<void> = async () => undefined,
): HTMLAudioElement {
  return {
    loop: false,
    pause: vi.fn(),
    play: vi.fn(play),
    preload: '',
    src: url,
  } as unknown as HTMLAudioElement;
}

function readSourceTree(root: string): string {
  return readdirSync(root)
    .map((entry) => {
      const fullPath = join(root, entry);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        return readSourceTree(fullPath);
      }

      if (!/\.(ts|tsx|js|jsx|css|html)$/.test(entry)) {
        return '';
      }

      return readFileSync(fullPath, 'utf8');
    })
    .join('\n');
}

function getFakeNode(node: unknown): FakeAudioNode {
  return node as FakeAudioNode;
}

function getFakeGainNode(node: unknown): FakeGainNode {
  return node as FakeGainNode;
}

class FakeAudioNode {
  readonly connections: unknown[] = [];

  connect(node: unknown): unknown {
    this.connections.push(node);
    return node;
  }

  disconnect(): void {
    this.connections.length = 0;
  }
}

class FakeAudioParam {
  readonly ramps: Array<{ time: number; value: number }> = [];
  value = 1;

  cancelScheduledValues(): void {}

  setValueAtTime(value: number): void {
    this.value = value;
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.ramps.push({ time, value });
  }
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam();
}

class FakeBufferSourceNode extends FakeAudioNode {
  buffer: AudioBuffer | null = null;
  onended: ((this: AudioScheduledSourceNode, ev: Event) => unknown) | null = null;
  startCalls = 0;

  start(): void {
    this.startCalls += 1;
  }

  finish(): void {
    this.onended?.call(this as unknown as AudioScheduledSourceNode, new Event('ended'));
  }
}

class FakeMediaElementSourceNode extends FakeAudioNode {}

class FakeAudioContext {
  readonly bufferSources: FakeBufferSourceNode[] = [];
  readonly destination = new FakeAudioNode();
  readonly gains: FakeGainNode[] = [];
  readonly mediaSources: FakeMediaElementSourceNode[] = [];
  decodeCalls = 0;
  currentTime = 0;
  resumeCalls = 0;
  state: AudioContextState;

  constructor(initialState: AudioContextState) {
    this.state = initialState;
  }

  asAudioContext(): AudioContext {
    return this as unknown as AudioContext;
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSourceNode();
    this.bufferSources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createMediaElementSource(): MediaElementAudioSourceNode {
    const source = new FakeMediaElementSourceNode();
    this.mediaSources.push(source);
    return source as unknown as MediaElementAudioSourceNode;
  }

  async decodeAudioData(): Promise<AudioBuffer> {
    this.decodeCalls += 1;
    return {
      duration: 1,
      length: 128,
      numberOfChannels: 2,
    } as AudioBuffer;
  }

  async resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = 'running';
  }
}
