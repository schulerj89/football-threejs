import { describe, expect, it } from 'vitest';
import type { AudioMixerSnapshot, AudioPlaybackHandle } from '../src/audio/AudioMixer';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../src/audio/AudioSettings';
import { GameMusicDirector, type GameMusicAudioPort } from '../src/audio/GameMusicDirector';
import { MENU_MUSIC_TRACKS } from '../src/audio/MusicCatalog';
import {
  MenuMusicPlaylistController,
  type MenuMusicPlaybackPort,
} from '../src/audio/MenuMusicPlaylistController';
import { StadiumChantDirector, type StadiumChantAudioPort } from '../src/audio/StadiumChantDirector';
import type { BroadcastCommentarySnapshot } from '../src/audio/BroadcastCommentaryDirector';
import type { PresentationAudioEvent } from '../src/audio/PresentationEventBridge';
import type { GameplaySnapshot } from '../src/playState';

describe('menu music playlist controller', () => {
  it('streams menu tracks and auto-advances without decoding full songs', async () => {
    const mixer = new FakeMusicPort();
    const tracks = MENU_MUSIC_TRACKS.slice(0, 2).map((track, index) => ({
      ...track,
      durationSeconds: index === 0 ? 0.25 : track.durationSeconds,
    }));
    const playlist = new MenuMusicPlaylistController(mixer, {
      tracks,
    });

    await expect(playlist.startFromUserGesture()).resolves.toBe(true);
    expect(mixer.startedLoops).toEqual(['football-js-title']);
    expect(playlist.getSnapshot()).toMatchObject({
      loopActive: true,
      trackTitle: 'Football JS Main Theme',
    });

    playlist.update(0.25);
    await flushMicrotasks();

    expect(mixer.startedLoops).toEqual(['football-js-title', 'football-js-saturday-lights']);
    expect(mixer.stoppedLoops).toContain('football-js-title');
    expect(playlist.getSnapshot()).toMatchObject({
      assetId: 'football-js-saturday-lights',
      trackTitle: 'Saturday Lights',
    });
  });

  it('supports previous and next controls without immediately restarting the active song', async () => {
    const mixer = new FakeMusicPort();
    const playlist = new MenuMusicPlaylistController(mixer, {
      tracks: MENU_MUSIC_TRACKS.slice(0, 3),
    });

    await playlist.startFromUserGesture();
    await playlist.startFromUserGesture();
    await playlist.nextTrack();
    await playlist.previousTrack();

    expect(mixer.startedLoops).toEqual([
      'football-js-title',
      'football-js-saturday-lights',
      'football-js-title',
    ]);
    expect(playlist.getSnapshot().assetId).toBe('football-js-title');
  });
});

describe('game music director', () => {
  it('does not start transition stingers during live play', async () => {
    const mixer = new FakeMusicPort();
    const director = new GameMusicDirector(mixer);

    await expect(director.requestStinger('pregameToField', makeGameplaySnapshot('live'))).resolves.toBe(false);

    expect(mixer.playedOneShots).toEqual([]);
    expect(director.getSnapshot().history[0]).toMatchObject({
      purpose: 'pregameToField',
      reason: 'livePlay',
      status: 'suppressed',
    });
  });

  it('plays one tracked stinger and suppresses overlap', async () => {
    const mixer = new FakeMusicPort();
    const director = new GameMusicDirector(mixer);

    await expect(director.requestStinger('matchupReveal', makeGameplaySnapshot('preSnap'))).resolves.toBe(true);
    await expect(director.requestStinger('pregameToField', makeGameplaySnapshot('preSnap'))).resolves.toBe(false);

    expect(mixer.playedOneShots).toEqual(['football-js-stinger-matchup-reveal']);
    expect(director.getSnapshot().activeStinger?.assetId).toBe('football-js-stinger-matchup-reveal');
    expect(director.getSnapshot().history.some((entry) => entry.reason === 'activeStinger')).toBe(true);
  });
});

describe('stadium chant director', () => {
  it('plays chants only during safe phases and limits them per drive', async () => {
    const mixer = new FakeMusicPort();
    const director = new StadiumChantDirector(mixer, { cooldownSeconds: 0 });
    const snapshot = makeGameplaySnapshot('preSnap');
    const event = makeEvent('playPrepared:test', 'playPrepared');

    director.processEvents(snapshot, [event]);
    await flushMicrotasks();
    director.processEvents(snapshot, [makeEvent('playPrepared:test-2', 'playPrepared')]);
    await flushMicrotasks();

    expect(mixer.playedOneShots).toHaveLength(1);
    expect(director.getSnapshot().history.some((entry) => entry.reason === 'driveLimit')).toBe(true);
  });

  it('suppresses chants while announcer speech or a stinger is active', async () => {
    const mixer = new FakeMusicPort();
    const director = new StadiumChantDirector(mixer, { cooldownSeconds: 0 });
    const snapshot = makeGameplaySnapshot('preSnap');

    director.processEvents(snapshot, [makeEvent('playPrepared:announcer', 'playPrepared')], 0, {
      commentary: makeCommentarySnapshot(true),
    });
    await flushMicrotasks();
    director.processEvents(
      { ...snapshot, drive: { ...snapshot.drive, firstDownMarker: { x: 0, z: 10 } } },
      [makeEvent('playPrepared:stinger', 'playPrepared')],
      0,
      {
        gameMusic: {
          activeStinger: {
            assetId: 'football-js-stinger-matchup-reveal',
            purpose: 'matchupReveal',
            startedAtSeconds: 0,
          },
          history: [],
          suppressionReason: null,
        },
      },
    );
    await flushMicrotasks();

    expect(mixer.playedOneShots).toEqual([]);
    expect(director.getSnapshot().history.map((entry) => entry.reason)).toEqual([
      'stingerActive',
      'announcerActive',
    ]);
  });
});

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function makeGameplaySnapshot(playState: GameplaySnapshot['playState']): GameplaySnapshot {
  return {
    activePlayStartSpot: null,
    ball: {
      possession: { kind: 'none' },
      position: { x: 0, y: 0, z: -15 },
      state: { kind: 'dead' },
    },
    blocking: { engagements: [] },
    currentBallSpot: { x: 0, z: -15 },
    drive: {
      currentDown: 1,
      firstDownMarker: { x: 0, z: -5 },
      lastDriveResult: null,
      lineOfScrimmage: { x: 0, z: -15 },
      snapLane: 'middle',
      state: 'active',
      yardsToFirstDown: 10,
    },
    exactDeadBallSpot: null,
    formationOrigin: { x: 0, z: -15 },
    forwardPassEligible: true,
    lastPlayResult: null,
    nextBallSpot: { x: 0, z: -15 },
    nextSnapSpot: { x: 0, z: -15 },
    passAttempted: false,
    passAudit: null,
    passFeedback: null,
    player: {} as GameplaySnapshot['player'],
    players: [],
    playbookId: '11v11',
    playState,
    receiverRouteStates: [],
    score: 0,
    scoreAttack: {
      durationSeconds: 120,
      finalScore: null,
      remainingSeconds: 120,
      state: 'ready',
    },
    selectedPlay: {
      displayName: 'Inside Zone 11',
      id: 'inside-zone-11',
      initialMovementDirection: { x: 0, z: 1 },
      kind: 'run',
    },
    selectedReceiver: null,
    snapLane: 'middle',
  };
}

function makeEvent(id: string, type: PresentationAudioEvent['type']): PresentationAudioEvent {
  return {
    id,
    playState: 'preSnap',
    score: 0,
    type,
  };
}

function makeCommentarySnapshot(playing: boolean): BroadcastCommentarySnapshot {
  return {
    captionsEnabled: true,
    crowdDuckState: { ducked: playing, duckingGain: 0.42 },
    currentCaption: playing ? 'caption' : null,
    currentClip: playing
      ? {
          assetId: 'announcer-test',
          caption: 'caption',
          category: 'firstDown',
          endsAtSeconds: 2,
          eventId: 'event',
          eventType: 'firstDown',
          priority: 10,
          startedAtSeconds: 0,
        }
      : null,
    enabled: true,
    eventHistory: [],
    lastEventSource: null,
    lastPriority: null,
    playback: {
      activeClipId: playing ? 'announcer-test' : null,
      completed: !playing,
      completedEventIds: [],
      elapsedDuration: 0,
      eventId: playing ? 'event' : null,
      expectedDuration: 2,
      failed: false,
      failedEventIds: [],
      playing,
      remainingDuration: playing ? 2 : 0,
    },
    queue: [],
    remainingCooldowns: [],
    voicePack: null,
  };
}

class FakeMusicPort implements MenuMusicPlaybackPort, GameMusicAudioPort, StadiumChantAudioPort {
  readonly activeLoops = new Set<string>();
  readonly loopGains = new Map<string, number>();
  readonly playedOneShots: string[] = [];
  readonly startedLoops: string[] = [];
  readonly stoppedLoops: string[] = [];
  settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  currentTime = 0;

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  getSnapshot(): AudioMixerSnapshot {
    return {
      activeAudioNodeCount: this.activeLoops.size,
      activeBuses: [],
      activeLoops: [...this.activeLoops],
      activeOneShots: this.playedOneShots.length,
      activeSourceCount: this.activeLoops.size + this.playedOneShots.length,
      announcerEnabled: this.settings.announcerEnabled,
      busGains: {
        announcer: this.settings.announcerVolume,
        crowd: this.settings.crowdVolume,
        gameplaySfx: this.settings.effectsVolume,
        master: this.settings.masterVolume,
        music: this.settings.musicEnabled ? this.settings.musicVolume : 0,
        ui: this.settings.effectsVolume,
      },
      captionsEnabled: this.settings.captionsEnabled,
      contextState: 'running',
      crowdDuckingGain: 1,
      decodedAssetIds: [],
      decodedBufferBytes: 0,
      decodedBufferBudgetBytes: 8 * 1024 * 1024,
      enabled: true,
      lastEvictedAudioAssetId: null,
      lastUnlockError: null,
      loadedAssetIds: [],
      loadedCompressedBytes: 0,
      longestLoadedClipSeconds: null,
      missingOptionalAssetIds: [],
      muted: this.settings.muted,
      preparedMediaElementSourceCount: this.activeLoops.size,
      streamedAssetIds: [...this.activeLoops],
      userGestureUnlocked: true,
    };
  }

  async unlockFromUserGesture(): Promise<boolean> {
    return true;
  }

  async startLoop(assetId: string, options = {} as { gain?: number }): Promise<boolean> {
    if (!this.settings.musicEnabled) {
      return false;
    }

    if (!this.activeLoops.has(assetId)) {
      this.startedLoops.push(assetId);
    }
    this.activeLoops.add(assetId);
    this.loopGains.set(assetId, options.gain ?? 1);
    return true;
  }

  stopLoop(assetId: string): boolean {
    this.stoppedLoops.push(assetId);
    this.activeLoops.delete(assetId);
    this.loopGains.set(assetId, 0);
    return true;
  }

  hasActiveLoop(assetId: string): boolean {
    return this.activeLoops.has(assetId);
  }

  getLoopGain(assetId: string): number {
    return this.loopGains.get(assetId) ?? 0;
  }

  setLoopGain(assetId: string, gain: number): boolean {
    if (!this.activeLoops.has(assetId)) {
      return false;
    }
    this.loopGains.set(assetId, gain);
    return true;
  }

  async playOneShot(assetId: string): Promise<boolean> {
    this.playedOneShots.push(assetId);
    return true;
  }

  async playOneShotTracked(assetId: string): Promise<AudioPlaybackHandle | null> {
    this.playedOneShots.push(assetId);
    const startedAt = this.currentTime;
    return {
      assetId,
      category: 'music',
      ended: new Promise(() => undefined),
      startedAt,
      stop: () => undefined,
    };
  }

  getCurrentTime(): number {
    return this.currentTime;
  }
}
