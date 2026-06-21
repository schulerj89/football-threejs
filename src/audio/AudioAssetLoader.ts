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
  decodedBufferBytes: number;
  loadedAssetIds: string[];
  loadedCompressedBytes: number;
  missingOptionalAssetIds: string[];
  streamedAssetIds: string[];
}

export interface AudioAssetLoaderOptions {
  audioContext: Pick<AudioContext, 'decodeAudioData'>;
  createAudioElement?: (url: string) => HTMLAudioElement;
  fetcher?: typeof fetch;
  manifest?: readonly LocalAudioAsset[];
  warn?: (message: string) => void;
}

export class AudioAssetLoader {
  private readonly audioContext: Pick<AudioContext, 'decodeAudioData'>;
  private readonly createAudioElement: (url: string) => HTMLAudioElement;
  private readonly decodedAssets = new Map<string, DecodedAudioAsset>();
  private readonly fetcher: typeof fetch;
  private readonly manifest: readonly LocalAudioAsset[];
  private readonly missingOptionalAssetIds = new Set<string>();
  private readonly streamAssets = new Map<string, StreamedAudioAsset>();
  private readonly warnedAssetIds = new Set<string>();
  private readonly warn: (message: string) => void;

  constructor(options: AudioAssetLoaderOptions) {
    this.audioContext = options.audioContext;
    this.createAudioElement = options.createAudioElement ?? ((url) => new Audio(url));
    this.fetcher = options.fetcher ?? fetch.bind(globalThis);
    this.manifest = options.manifest ?? LOCAL_AUDIO_ASSET_MANIFEST;
    this.warn = options.warn ?? ((message) => console.warn(message));
  }

  getAsset(assetId: string): LocalAudioAsset | null {
    return getAudioAsset(this.manifest, assetId);
  }

  async loadDecodedBuffer(assetId: string): Promise<DecodedAudioAsset | null> {
    const cached = this.decodedAssets.get(assetId);

    if (cached) {
      return cached;
    }

    const asset = this.getAsset(assetId);

    if (!asset || asset.loadingStrategy !== 'buffer') {
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

  getSnapshot(): AudioAssetLoaderSnapshot {
    return {
      decodedBufferBytes: [...this.decodedAssets.values()].reduce(
        (sum, asset) => sum + asset.decodedBytes,
        0,
      ),
      loadedAssetIds: [
        ...this.decodedAssets.keys(),
        ...this.streamAssets.keys(),
      ].sort(),
      loadedCompressedBytes: [...this.decodedAssets.values()].reduce(
        (sum, asset) => sum + asset.compressedBytes,
        0,
      ),
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
}

function estimateDecodedBytes(buffer: AudioBuffer): number {
  return buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
}
