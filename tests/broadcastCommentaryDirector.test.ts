import { describe, expect, it } from 'vitest';
import {
  BroadcastCommentaryDirector,
  type BroadcastCommentaryAudioPort,
} from '../src/audio/BroadcastCommentaryDirector';
import { COMMENTARY_CATALOG } from '../src/audio/CommentaryCatalog';
import type { AudioPlaybackCategory } from '../src/audio/AudioAssetManifest';
import type { AudioMixerSnapshot } from '../src/audio/AudioMixer';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../src/audio/AudioSettings';
import type { PresentationAudioEvent } from '../src/audio/PresentationEventBridge';
import { createGameplayModel, snapshotGameplayModel } from '../src/playState';
import { ANNOUNCER_SCRIPT_CATALOG } from '../tools/audio/announcerScriptCatalog';

describe('broadcast commentary director', () => {
  it('lets touchdown commentary suppress queued first-down speech', async () => {
    const mixer = new FakeCommentaryAudioPort();
    const director = new BroadcastCommentaryDirector(mixer);

    director.processEvents([event('playPrepared', 'opening')]);
    await director.flushPendingAudioForTests();
    mixer.currentTime = 0.1;
    director.processEvents([event('firstDown', 'first')]);
    mixer.currentTime = 0.2;
    director.processEvents([event('touchdown', 'score')]);
    mixer.currentTime = 4;
    director.processEvents([]);
    await director.flushPendingAudioForTests();

    expect(mixer.playedOneShots.some((assetId) => assetId.startsWith('ann_first_down'))).toBe(false);
    expect(mixer.playedOneShots.some((assetId) => assetId.startsWith('ann_touchdown'))).toBe(true);
    expect(
      director.getSnapshot().eventHistory.some((entry) => entry.reason === 'cancelledByHigherPriority'),
    ).toBe(true);
  });

  it('does not overlap speech clips and plays queued higher-priority clips after the active line', async () => {
    const mixer = new FakeCommentaryAudioPort();
    const director = new BroadcastCommentaryDirector(mixer);

    director.processEvents([event('firstDown', 'first')]);
    await director.flushPendingAudioForTests();
    director.processEvents([event('sack', 'sack')]);
    await director.flushPendingAudioForTests();

    expect(mixer.playedOneShots).toHaveLength(1);
    expect(director.getSnapshot().queue).toHaveLength(1);

    mixer.currentTime = 4;
    director.processEvents([]);
    await director.flushPendingAudioForTests();

    expect(mixer.playedOneShots).toHaveLength(2);
    expect(mixer.playedOneShots[0]).not.toBe(mixer.playedOneShots[1]);
  });

  it('avoids immediate variant repetition for the same category', async () => {
    const mixer = new FakeCommentaryAudioPort();
    const director = new BroadcastCommentaryDirector(mixer);

    director.processEvents([event('firstDown', 'first')]);
    await director.flushPendingAudioForTests();
    mixer.currentTime = 10;
    director.processEvents([]);
    director.processEvents([event('firstDown', 'second')]);
    await director.flushPendingAudioForTests();

    const firstDownClips = mixer.playedOneShots.filter((assetId) =>
      assetId.startsWith('ann_first_down'),
    );
    expect(firstDownClips).toHaveLength(2);
    expect(firstDownClips[0]).not.toBe(firstDownClips[1]);
  });

  it('applies per-category cooldowns', async () => {
    const mixer = new FakeCommentaryAudioPort();
    const director = new BroadcastCommentaryDirector(mixer);

    director.processEvents([event('firstDown', 'first')]);
    await director.flushPendingAudioForTests();
    mixer.currentTime = 4;
    director.processEvents([]);
    director.processEvents([event('firstDown', 'second')]);
    await director.flushPendingAudioForTests();

    expect(mixer.playedOneShots.filter((assetId) => assetId.startsWith('ann_first_down'))).toHaveLength(1);
    expect(director.getSnapshot().eventHistory.some((entry) => entry.reason === 'cooldown')).toBe(true);
  });

  it('ducks the crowd while speech is active and restores afterward', async () => {
    const mixer = new FakeCommentaryAudioPort();
    const director = new BroadcastCommentaryDirector(mixer, { crowdDuckGain: 0.35 });

    director.processEvents([event('sack', 'sack')]);
    await director.flushPendingAudioForTests();

    expect(mixer.crowdDuckingGain).toBe(0.35);
    expect(director.getSnapshot().crowdDuckState.ducked).toBe(true);

    mixer.currentTime = 5;
    director.processEvents([]);

    expect(mixer.crowdDuckingGain).toBe(1);
    expect(director.getSnapshot().crowdDuckState.ducked).toBe(false);
  });

  it('restores a safe mixer state when muted during speech', async () => {
    const mixer = new FakeCommentaryAudioPort();
    const director = new BroadcastCommentaryDirector(mixer);

    director.processEvents([event('sack', 'sack')]);
    await director.flushPendingAudioForTests();
    mixer.snapshot.muted = true;
    director.processEvents([]);

    expect(mixer.crowdDuckingGain).toBe(1);
    expect(mixer.stoppedCategories).toEqual(['announcer']);
    expect(director.getSnapshot().currentClip).toBeNull();
  });

  it('keeps runtime captions matched to the script catalog', () => {
    const toolCatalogById = new Map(
      ANNOUNCER_SCRIPT_CATALOG.map((script) => [script.scriptId, script.caption]),
    );

    expect(COMMENTARY_CATALOG).toHaveLength(ANNOUNCER_SCRIPT_CATALOG.length);
    for (const clip of COMMENTARY_CATALOG) {
      expect(clip.caption).toBe(toolCatalogById.get(clip.scriptId));
    }
  });

  it('does not load speech when audio is disabled', async () => {
    const mixer = new FakeCommentaryAudioPort();
    mixer.snapshot.enabled = false;
    const director = new BroadcastCommentaryDirector(mixer);

    director.processEvents([event('touchdown', 'score')]);
    await director.flushPendingAudioForTests();

    expect(mixer.playedOneShots).toEqual([]);
    expect(director.getSnapshot().eventHistory.some((entry) => entry.reason === 'audioDisabled')).toBe(true);
  });

  it('does not mutate gameplay snapshots', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const snapshot = snapshotGameplayModel(gameplay);
    const before = JSON.stringify(snapshot);
    const mixer = new FakeCommentaryAudioPort();
    const director = new BroadcastCommentaryDirector(mixer);

    director.update(snapshot);

    expect(JSON.stringify(snapshot)).toBe(before);
  });
});

function event(
  type: PresentationAudioEvent['type'],
  id: string,
  yardsGained = 0,
): PresentationAudioEvent {
  return Object.freeze({
    id,
    playResult: Object.freeze({
      endingBallSpot: { x: 0, z: -15 + yardsGained },
      id: stableId(id),
      reason: type === 'sack' ? 'sack' : type === 'touchdown' ? 'touchdown' : 'tackle',
      scoringTeam: type === 'touchdown' ? 'offense' : null,
      startingBallSpot: { x: 0, z: -15 },
      type: type === 'sack' ? 'sack' : type === 'touchdown' ? 'touchdown' : 'tackle',
      yardsGained,
    }),
    playState: type === 'playPrepared' ? 'preSnap' : 'dead',
    score: type === 'touchdown' ? 6 : 0,
    type,
  });
}

function stableId(value: string): number {
  return [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

class FakeCommentaryAudioPort implements BroadcastCommentaryAudioPort {
  readonly playedOneShots: string[] = [];
  readonly stoppedCategories: AudioPlaybackCategory[] = [];
  crowdDuckingGain = 1;
  currentTime = 0;
  settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  snapshot: AudioMixerSnapshot = {
    activeAudioNodeCount: 5,
    activeBuses: ['master', 'crowd', 'announcer'],
    activeLoops: [],
    activeOneShots: 0,
    activeSourceCount: 0,
    announcerEnabled: true,
    busGains: {
      announcer: 0.85,
      crowd: 0.45,
      gameplaySfx: 0.85,
      master: 0.85,
      ui: 0.85,
    },
    captionsEnabled: true,
    contextState: 'running',
    crowdDuckingGain: 1,
    decodedAssetIds: [],
    decodedBufferBytes: 0,
    enabled: true,
    lastUnlockError: null,
    loadedAssetIds: [],
    loadedCompressedBytes: 0,
    longestLoadedClipSeconds: null,
    missingOptionalAssetIds: [],
    muted: false,
    preparedMediaElementSourceCount: 0,
    streamedAssetIds: [],
    userGestureUnlocked: true,
  };

  getCurrentTime(): number {
    return this.currentTime;
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  getSnapshot(): AudioMixerSnapshot {
    return {
      ...this.snapshot,
      announcerEnabled: this.settings.announcerEnabled && this.snapshot.announcerEnabled,
      captionsEnabled: this.settings.captionsEnabled,
      crowdDuckingGain: this.crowdDuckingGain,
      muted: this.snapshot.muted || this.settings.muted,
    };
  }

  async playOneShot(assetId: string): Promise<boolean> {
    this.playedOneShots.push(assetId);
    return true;
  }

  setCrowdDuckingGain(gain: number): void {
    this.crowdDuckingGain = gain;
  }

  setSettings(patch: Partial<AudioSettings>): AudioSettings {
    this.settings = {
      ...this.settings,
      ...patch,
    };
    return this.getSettings();
  }

  stopOneShotsByCategory(category: AudioPlaybackCategory): number {
    this.stoppedCategories.push(category);
    return 1;
  }
}
