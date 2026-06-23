import type { LocalAudioAsset } from '../AudioAssetManifest';
import {
  DEFAULT_VOICE_PACK_ID,
  getVoicePackMetadata,
  VOICE_PACK_DECODED_CACHE_LIMIT_BYTES,
} from './VoicePackRegistry';
import {
  selectVoicePack,
} from './VoicePackSelector';
import type {
  AnnouncerVoiceSetting,
  BroadcastScriptId,
  VoicePackAssetResolverSnapshot,
  VoicePackId,
  VoicePackManifest,
  VoicePackResolvedClip,
  VoicePackSelection,
  VoicePackSelectionInput,
} from './VoicePackTypes';

export interface VoicePackAssetResolverOptions {
  fetcher?: typeof fetch;
  initialSelection?: VoicePackSelectionInput;
  registerAudioAssets?: (assets: readonly LocalAudioAsset[]) => void;
  warn?: (message: string) => void;
}

export class VoicePackAssetResolver {
  private readonly fetcher: typeof fetch;
  private readonly manifests = new Map<VoicePackId, VoicePackManifest | null>();
  private readonly registerAudioAssets: (assets: readonly LocalAudioAsset[]) => void;
  private readonly registeredAssetIds = new Set<string>();
  private readonly warn: (message: string) => void;
  private lastFallbackSource: string | null = null;
  private selection: VoicePackSelection;

  constructor(options: VoicePackAssetResolverOptions = {}) {
    this.fetcher = options.fetcher ?? fetch.bind(globalThis);
    this.registerAudioAssets = options.registerAudioAssets ?? (() => undefined);
    this.warn = options.warn ?? (() => undefined);
    this.selection = selectVoicePack(options.initialSelection ?? {
      matchSeed: 'match',
      opponentTeamId: null,
      setting: 'auto',
      userTeamId: null,
    });
  }

  select(input: VoicePackSelectionInput): VoicePackSelection {
    this.selection = selectVoicePack(input);
    this.lastFallbackSource = null;
    return this.selection;
  }

  setAnnouncerVoiceSetting(
    setting: AnnouncerVoiceSetting,
    context: Omit<VoicePackSelectionInput, 'setting'>,
  ): VoicePackSelection {
    return this.select({ ...context, setting });
  }

  getSelectedPackId(): VoicePackId {
    return this.selection.packId;
  }

  async resolveClip(scriptId: BroadcastScriptId): Promise<VoicePackResolvedClip | null> {
    const selected = await this.resolveFromPack(this.selection.packId, scriptId, 'selectedPack');

    if (selected) {
      this.lastFallbackSource = null;
      return selected;
    }

    if (this.selection.packId !== DEFAULT_VOICE_PACK_ID) {
      const fallback = await this.resolveFromPack(DEFAULT_VOICE_PACK_ID, scriptId, 'defaultPack');
      if (fallback) {
        this.lastFallbackSource = DEFAULT_VOICE_PACK_ID;
        return fallback;
      }
    }

    this.lastFallbackSource = null;
    return null;
  }

  getSnapshot(decodedBytes = 0, lastEviction: string | null = null): VoicePackAssetResolverSnapshot {
    const manifest = this.manifests.get(this.selection.packId) ?? null;

    return {
      cacheLimitBytes: VOICE_PACK_DECODED_CACHE_LIMIT_BYTES,
      decodedBytes,
      fallbackSource: this.lastFallbackSource,
      lastEviction,
      loadedClipCount: manifest ? Object.keys(manifest.clips).length : 0,
      loadedManifest: manifest?.id ?? null,
      selectedPack: this.selection.packId,
      selectionReason: this.selection.reason,
    };
  }

  private async resolveFromPack(
    packId: VoicePackId,
    scriptId: BroadcastScriptId,
    fallbackSource: VoicePackResolvedClip['fallbackSource'],
  ): Promise<VoicePackResolvedClip | null> {
    const manifest = await this.loadManifest(packId);
    const clip = manifest?.clips[scriptId] ?? null;

    if (
      !manifest ||
      !clip ||
      (clip.compressedBytes !== undefined && clip.compressedBytes <= 0)
    ) {
      return null;
    }

    const asset: LocalAudioAsset = {
      assetId: clip.assetId,
      category: 'announcer',
      defaultGain: 1,
      loadingStrategy: 'buffer',
      loop: false,
      maxSimultaneousInstances: 1,
      optional: true,
      url: clip.url,
    };

    if (!this.registeredAssetIds.has(asset.assetId)) {
      this.registerAudioAssets([asset]);
      this.registeredAssetIds.add(asset.assetId);
    }

    return {
      asset,
      caption: clip.caption,
      clip,
      fallbackSource,
      packId,
    };
  }

  private async loadManifest(packId: VoicePackId): Promise<VoicePackManifest | null> {
    if (this.manifests.has(packId)) {
      return this.manifests.get(packId) ?? null;
    }

    const metadata = getVoicePackMetadata(packId);
    try {
      const response = await this.fetcher(metadata.manifestUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const manifest = await response.json() as VoicePackManifest;
      if (manifest.id !== packId || !manifest.clips || manifest.schemaVersion < 1) {
        throw new Error('invalid voice-pack manifest');
      }
      this.manifests.set(packId, manifest);
      return manifest;
    } catch (error) {
      this.warn(
        `Optional voice pack ${packId} is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.manifests.set(packId, null);
      return null;
    }
  }
}
