import { describe, expect, it } from 'vitest';
import type { AudioPlaybackCompletion, AudioPlaybackHandle, AudioMixerSnapshot } from '../src/audio/AudioMixer';
import { VoicePackAssetResolver } from '../src/audio/voicePacks/VoicePackAssetResolver';
import type { VoicePackManifest } from '../src/audio/voicePacks/VoicePackTypes';
import { MatchFlowController } from '../src/match/MatchFlowController';
import type { MatchSnapshot } from '../src/match/MatchTypes';
import { HalftimePresentationDirector, type HalftimeAudioPort } from '../src/presentation/halftime/HalftimePresentationDirector';
import { createHalftimeCameraShot } from '../src/presentation/halftime/HalftimeCameraShot';
import { createHalftimeStatsViewModel } from '../src/presentation/halftime/HalftimeStatsOverlay';
import { resolveHalftimeStory } from '../src/presentation/halftime/HalftimeStoryResolver';
import { createZeroPlayerGameStats, createZeroTeamGameStats, type GameStatsSnapshot } from '../src/stats/GameStatsTypes';

describe('halftime presentation', () => {
  it('selects a mathematically supported story from actual stats', () => {
    const match = createMatchSnapshot({
      opponentTurnovers: 3,
      userPoints: 14,
    });

    const story = resolveHalftimeStory(match);

    expect(story.category).toBe('turnoverStory');
    expect(story.supportingTeam).toBe('user');
    expect(story.supportingStatKeys).toContain('turnovers');
  });

  it('builds the comparative stats panel from GameStatsModel data', () => {
    const match = createMatchSnapshot({
      opponentPassingYards: 62,
      opponentPoints: 10,
      userFirstDowns: 8,
      userPassingYards: 144,
      userPoints: 17,
      userRushingYards: 71,
      userThirdDownAttempts: 4,
      userThirdDownConversions: 2,
    });

    const view = createHalftimeStatsViewModel(match);

    expect(view.rows.find((row) => row.key === 'score')).toMatchObject({
      opponent: '10',
      user: '17',
    });
    expect(view.rows.find((row) => row.key === 'thirdDown')).toMatchObject({
      user: '2/4 (50%)',
    });
    expect(view.leaders.find((leader) => leader.label === 'Passer')).toMatchObject({
      statText: '144 passing yards',
    });
  });

  it('includes small team logo payloads for report team headers', () => {
    const match = createMatchSnapshot({
      opponentPoints: 10,
      userPoints: 17,
    });
    const view = createHalftimeStatsViewModel(match);

    expect(view.teams[0].logoUrl).toBe(match.userTeam.logoUrl);
    expect(view.teams[1].logoUrl).toBe(match.opponentTeam.logoUrl);
    expect(view.teams[0].primaryColor).toBe(match.userTeam.colors.primary);
    expect(view.teams[1].primaryColor).toBe(match.opponentTeam.colors.primary);
  });

  it('targets the exact field center for the continuous halftime orbit', () => {
    const shot = createHalftimeCameraShot({
      cinematics: 'full',
      elapsedSeconds: 8,
      restoreCamera: 'offensePerspective',
    });

    expect(shot.focus.x).toBeCloseTo(0);
    expect(shot.focus.z).toBeCloseTo(0);
    expect(shot.lookTarget.x).toBeCloseTo(0);
    expect(shot.lookTarget.z).toBeCloseTo(0);
    expect(shot.orbitCenter?.x).toBeCloseTo(0);
    expect(shot.orbitCenter?.z).toBeCloseTo(0);
  });

  it('uses a slower elevated orbit pace for halftime camera movement', () => {
    expect(createHalftimeCameraShot({
      cinematics: 'full',
      elapsedSeconds: 14,
      restoreCamera: 'offensePerspective',
    }).shotProgress).toBeCloseTo(0.5);

    expect(createHalftimeCameraShot({
      cinematics: 'brief',
      elapsedSeconds: 9,
      restoreCamera: 'offensePerspective',
    }).shotProgress).toBeCloseTo(0.5);
  });

  it('does not start the next halftime line until the active clip ends plus the quiet gap', async () => {
    const audio = new FakeHalftimeAudio();
    const resolver = createVoicePackResolver();
    const director = new HalftimePresentationDirector({
      audio,
      cinematics: 'brief',
      gameMusicDirector: {
        requestStinger: async () => true,
      },
      onContinue: () => undefined,
      overlay: {
        dispose: () => undefined,
        hide: () => undefined,
        sync: () => null,
      },
      targetGameplayCamera: 'offensePerspective',
      voicePackResolver: resolver,
    });
    const match = createMatchSnapshot({
      opponentPassingYards: 170,
      opponentPoints: 10,
      userPassingYards: 190,
      userPoints: 13,
    });

    director.start(match);
    director.update({
      deltaSeconds: 0.016,
      gameplayPlayerVisibleCount: 0,
      matchSnapshot: match,
      sidelineVisibleCount: 22,
    });
    await flushPromises();

    expect(audio.handles).toHaveLength(1);
    director.update({
      deltaSeconds: 0.5,
      gameplayPlayerVisibleCount: 0,
      matchSnapshot: match,
      sidelineVisibleCount: 22,
    });
    await flushPromises();
    expect(audio.handles).toHaveLength(1);

    audio.currentTime = 1.5;
    audio.endHandle(0);
    await flushPromises();
    director.update({
      deltaSeconds: 0.1,
      gameplayPlayerVisibleCount: 0,
      matchSnapshot: match,
      sidelineVisibleCount: 22,
    });
    await flushPromises();
    expect(audio.handles).toHaveLength(1);

    audio.currentTime = 1.95;
    director.update({
      deltaSeconds: 0.5,
      gameplayPlayerVisibleCount: 0,
      matchSnapshot: match,
      sidelineVisibleCount: 22,
    });
    await flushPromises();
    expect(audio.handles).toHaveLength(2);
  });
});

class FakeHalftimeAudio implements HalftimeAudioPort {
  currentTime = 0;
  handles: Array<AudioPlaybackHandle & { resolve: (completion: AudioPlaybackCompletion) => void }> = [];

  getCurrentTime(): number {
    return this.currentTime;
  }

  getSnapshot(): AudioMixerSnapshot {
    return {
      activeAudioNodeCount: this.handles.length,
      activeBuses: ['announcer'],
      activeLoops: [],
      activeOneShots: this.handles.length,
      activeSourceCount: this.handles.length,
      announcerEnabled: true,
      busGains: {
        announcer: 1,
        crowd: 1,
        gameplaySfx: 1,
        master: 1,
        music: 1,
        ui: 1,
      },
      captionsEnabled: true,
      contextState: 'running',
      crowdDuckingGain: 1,
      decodedAssetIds: [],
      decodedBufferBudgetBytes: 0,
      decodedBufferBytes: 0,
      enabled: true,
      lastEvictedAudioAssetId: null,
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
  }

  async playOneShotTracked(assetId: string): Promise<AudioPlaybackHandle | null> {
    let resolveCompletion: (completion: AudioPlaybackCompletion) => void = () => undefined;
    const ended = new Promise<AudioPlaybackCompletion>((resolve) => {
      resolveCompletion = resolve;
    });
    const handle = {
      assetId,
      category: 'announcer' as const,
      durationSeconds: 1.5,
      ended,
      resolve: resolveCompletion,
      startedAt: this.currentTime,
      stop: () => {
        resolveCompletion({
          assetId,
          category: 'announcer',
          endedAt: this.currentTime,
          reason: 'stopped',
          startedAt: this.currentTime,
          stopped: true,
        });
      },
    };
    this.handles.push(handle);
    return handle;
  }

  setCrowdDuckingGain(): void {
    return undefined;
  }

  setSettings() {
    return {} as never;
  }

  stopOneShotsByCategory(): number {
    return 0;
  }

  endHandle(index: number): void {
    const handle = this.handles[index];
    handle.resolve({
      assetId: handle.assetId,
      category: 'announcer',
      endedAt: this.currentTime,
      reason: 'ended',
      startedAt: handle.startedAt,
      stopped: false,
    });
  }
}

function createVoicePackResolver(): VoicePackAssetResolver {
  return new VoicePackAssetResolver({
    fetcher: async () => new Response(JSON.stringify(createManifest()), { status: 200 }),
    initialSelection: {
      matchSeed: 'halftime',
      opponentTeamId: 'lakefront-lights',
      setting: 'announcer-a',
      userTeamId: 'metro-meteors',
    },
  });
}

function createManifest(): VoicePackManifest {
  const scriptIds = [
    'half_opening_01',
    'half_opening_02',
    'half_close_game_01',
    'half_close_game_02',
    'half_second_half_transition_01',
    'half_second_half_transition_02',
  ];
  return {
    announcerName: 'Grant Mercer',
    clips: Object.fromEntries(scriptIds.map((scriptId) => [scriptId, {
      assetId: `announcer_a_${scriptId}`,
      caption: `Caption ${scriptId}`,
      category: scriptId.includes('opening')
        ? 'halftimeOpening'
        : scriptId.includes('transition')
          ? 'secondHalfTransition'
          : 'closeGame',
      compressedBytes: 1200,
      contentHash: `${scriptId}-hash`,
      domain: 'halftime',
      durationSeconds: 1.5,
      outputPath: `public/audio/voice-packs/announcer-a/${scriptId}.mp3`,
      scriptId,
      url: `/audio/voice-packs/announcer-a/${scriptId}.mp3`,
    }])),
    displayName: 'Voice A - Grant Mercer',
    id: 'announcer-a',
    requiredScriptIds: scriptIds,
    schemaVersion: 1,
  };
}

function createMatchSnapshot(patch: {
  opponentPassingYards?: number;
  opponentPoints?: number;
  opponentRushingYards?: number;
  opponentTurnovers?: number;
  userFirstDowns?: number;
  userPassingYards?: number;
  userPoints?: number;
  userRushingYards?: number;
  userThirdDownAttempts?: number;
  userThirdDownConversions?: number;
  userTurnovers?: number;
}): MatchSnapshot {
  const controller = new MatchFlowController({
    opponentTeamId: 'lakefront-lights',
    userTeamId: 'metro-meteors',
  });
  const snapshot = controller.getSnapshot();
  return {
    ...snapshot,
    opponentScore: patch.opponentPoints ?? 0,
    phase: 'halftime',
    stats: createStatsSnapshot(patch),
    userScore: patch.userPoints ?? 0,
  };
}

function createStatsSnapshot(patch: Parameters<typeof createMatchSnapshot>[0]): GameStatsSnapshot {
  return {
    duplicateSuppressionCount: 0,
    invariantFailures: [],
    lastEvent: null,
    players: {
      'metro-meteors-qb-12': {
        ...createZeroPlayerGameStats('metro-meteors-qb-12', 'user'),
        passingYards: patch.userPassingYards ?? 0,
      },
    },
    possessionSeconds: {
      opponent: 95,
      user: 85,
    },
    processedEventCount: 0,
    teams: {
      opponent: {
        ...createZeroTeamGameStats(),
        passingYards: patch.opponentPassingYards ?? 0,
        points: patch.opponentPoints ?? 0,
        rushingYards: patch.opponentRushingYards ?? 0,
        totalYards: (patch.opponentPassingYards ?? 0) + (patch.opponentRushingYards ?? 0),
        turnovers: patch.opponentTurnovers ?? 0,
      },
      user: {
        ...createZeroTeamGameStats(),
        firstDowns: patch.userFirstDowns ?? 0,
        passingYards: patch.userPassingYards ?? 0,
        points: patch.userPoints ?? 0,
        rushingYards: patch.userRushingYards ?? 0,
        thirdDownAttempts: patch.userThirdDownAttempts ?? 0,
        thirdDownConversions: patch.userThirdDownConversions ?? 0,
        totalYards: (patch.userPassingYards ?? 0) + (patch.userRushingYards ?? 0),
        turnovers: patch.userTurnovers ?? 0,
      },
    },
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
