import {
  LOCAL_AUDIO_ASSET_MANIFEST,
  getAudioAsset,
  type LocalAudioAsset,
} from './AudioAssetManifest';

export interface DecodedAudioAsset {
  asset: LocalAudioAsset;
  buffer: AudioBuffer;
  compressedBytes: number;
  decodedBytes: number;
}

export interface StreamedAudioAsset {
  asset: LocalAudioAsset;
  element: HTMLAudioElement;
}

export interface AudioAssetLoaderSnapshot {
  decodedBufferBudgetBytes: number;
  decodedAssetIds: string[];
  decodedBufferBytes: number;
  lastEvictedAssetId: string | null;
  loadedAssetIds: string[];
  loadedCompressedBytes: number;
  longestLoadedClipSeconds: number | null;
  missingOptionalAssetIds: string[];
  streamedAssetIds: string[];
}

export interface AudioAssetLoaderOptions {
  audioContext: Pick<AudioContext, 'decodeAudioData'>;
  createAudioElement?: (url: string) => HTMLAudioElement;
  fetcher?: typeof fetch;
  knownMissingAssetIds?: readonly string[];
  manifest?: readonly LocalAudioAsset[];
  maxDecodedBufferBytes?: number;
  warn?: (message: string) => void;
}

export const DEFAULT_MAX_DECODED_AUDIO_BUFFER_BYTES = 8 * 1024 * 1024;

export class AudioAssetLoader {
  private readonly audioContext: Pick<AudioContext, 'decodeAudioData'>;
  private readonly createAudioElement: (url: string) => HTMLAudioElement;
  private readonly decodedAssets = new Map<string, DecodedAudioAsset>();
  private readonly dynamicAssets = new Map<string, LocalAudioAsset>();
  private readonly fetcher: typeof fetch;
  private readonly manifest: readonly LocalAudioAsset[];
  private readonly maxDecodedBufferBytes: number;
  private readonly missingOptionalAssetIds = new Set<string>();
  private lastEvictedAssetId: string | null = null;
  private readonly streamAssets = new Map<string, StreamedAudioAsset>();
  private readonly warnedAssetIds = new Set<string>();
  private readonly warn: (message: string) => void;

  constructor(options: AudioAssetLoaderOptions) {
    this.audioContext = options.audioContext;
    this.createAudioElement = options.createAudioElement ?? ((url) => new Audio(url));
    this.fetcher = options.fetcher ?? fetch.bind(globalThis);
    this.manifest = options.manifest ?? LOCAL_AUDIO_ASSET_MANIFEST;
    this.maxDecodedBufferBytes =
      options.maxDecodedBufferBytes ?? DEFAULT_MAX_DECODED_AUDIO_BUFFER_BYTES;
    for (const assetId of options.knownMissingAssetIds ?? []) {
      this.missingOptionalAssetIds.add(assetId);
    }
    this.warn = options.warn ?? ((message) => console.warn(message));
  }

  getAsset(assetId: string): LocalAudioAsset | null {
    return this.dynamicAssets.get(assetId) ?? getAudioAsset(this.manifest, assetId);
  }

  registerDynamicAssets(assets: readonly LocalAudioAsset[]): void {
    for (const asset of assets) {
      this.dynamicAssets.set(asset.assetId, asset);
    }
  }

  async loadDecodedBuffer(assetId: string): Promise<DecodedAudioAsset | null> {
    const cached = this.decodedAssets.get(assetId);

    if (cached) {
      this.decodedAssets.delete(assetId);
      this.decodedAssets.set(assetId, cached);
      return cached;
    }

    const asset = this.getAsset(assetId);

    if (!asset || asset.loadingStrategy !== 'buffer') {
      return null;
    }
    if (this.missingOptionalAssetIds.has(asset.assetId)) {
      return null;
    }

    try {
      const response = await this.fetcher(asset.url);

      if (!response.ok) {
        this.warnMissingOptionalAsset(asset, `HTTP ${response.status}`);
        return null;
      }

      const compressedAudio = await response.arrayBuffer();
      const buffer = await this.audioContext.decodeAudioData(compressedAudio.slice(0));
      const decodedAsset = {
        asset,
        buffer,
        compressedBytes: compressedAudio.byteLength,
        decodedBytes: estimateDecodedBytes(buffer),
      };
      this.decodedAssets.set(assetId, decodedAsset);
      this.enforceDecodedBufferBudget(assetId);
      return decodedAsset;
    } catch (error) {
      this.warnMissingOptionalAsset(
        asset,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  loadStream(assetId: string): StreamedAudioAsset | null {
    const cached = this.streamAssets.get(assetId);

    if (cached) {
      return cached;
    }

    const asset = this.getAsset(assetId);

    if (!asset || asset.loadingStrategy !== 'stream') {
      return null;
    }
    if (this.missingOptionalAssetIds.has(asset.assetId)) {
      return null;
    }

    const element = this.createAudioElement(asset.url);
    element.loop = asset.loop;
    element.preload = 'metadata';
    const streamedAsset = { asset, element };
    this.streamAssets.set(assetId, streamedAsset);
    return streamedAsset;
  }

  reportMissingOptionalAsset(assetId: string, reason: string): void {
    const asset = this.getAsset(assetId);

    if (asset) {
      this.warnMissingOptionalAsset(asset, reason);
    }
  }

  isMissingOptionalAsset(assetId: string): boolean {
    return this.missingOptionalAssetIds.has(assetId);
  }

  getSnapshot(): AudioAssetLoaderSnapshot {
    const decodedAssets = [...this.decodedAssets.values()];
    const streamedAssets = [...this.streamAssets.values()];
    const loadedDurations = [
      ...decodedAssets.map((asset) => asset.buffer.duration),
      ...streamedAssets
        .map((asset) => asset.element.duration)
        .filter((duration) => Number.isFinite(duration)),
    ];

    return {
      decodedBufferBudgetBytes: this.maxDecodedBufferBytes,
      decodedAssetIds: [...this.decodedAssets.keys()].sort(),
      decodedBufferBytes: decodedAssets.reduce(
        (sum, asset) => sum + asset.decodedBytes,
        0,
      ),
      lastEvictedAssetId: this.lastEvictedAssetId,
      loadedAssetIds: [
        ...this.decodedAssets.keys(),
        ...this.streamAssets.keys(),
      ].sort(),
      loadedCompressedBytes: decodedAssets.reduce(
        (sum, asset) => sum + asset.compressedBytes,
        0,
      ),
      longestLoadedClipSeconds: loadedDurations.length > 0 ? Math.max(...loadedDurations) : null,
      missingOptionalAssetIds: [...this.missingOptionalAssetIds].sort(),
      streamedAssetIds: [...this.streamAssets.keys()].sort(),
    };
  }

  private warnMissingOptionalAsset(asset: LocalAudioAsset, reason: string): void {
    if (!asset.optional) {
      this.warn(`Audio asset ${asset.assetId} failed to load: ${reason}`);
      return;
    }

    this.missingOptionalAssetIds.add(asset.assetId);

    if (this.warnedAssetIds.has(asset.assetId)) {
      return;
    }

    this.warnedAssetIds.add(asset.assetId);
    this.warn(`Optional audio asset ${asset.assetId} is unavailable at ${asset.url}: ${reason}`);
  }

  private enforceDecodedBufferBudget(protectedAssetId: string): void {
    while (this.getDecodedBufferBytes() > this.maxDecodedBufferBytes) {
      const oldestAssetId = [...this.decodedAssets.keys()].find(
        (assetId) => assetId !== protectedAssetId,
      );

      if (!oldestAssetId) {
        break;
      }

      this.decodedAssets.delete(oldestAssetId);
      this.lastEvictedAssetId = oldestAssetId;
    }
  }

  private getDecodedBufferBytes(): number {
    return [...this.decodedAssets.values()].reduce(
      (sum, asset) => sum + asset.decodedBytes,
      0,
    );
  }
}

function estimateDecodedBytes(buffer: AudioBuffer): number {
  return buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
}
