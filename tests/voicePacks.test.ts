import { describe, expect, it } from 'vitest';
import { VoicePackAssetResolver } from '../src/audio/voicePacks/VoicePackAssetResolver';
import {
  resolveHalftimeCategory,
  resolveTeamRatingOpinionCategory,
  selectVoicePack,
} from '../src/audio/voicePacks/VoicePackSelector';
import {
  DEFAULT_VOICE_PACK_ID,
  GAME_OPINION_SCRIPT_IDS,
  HALFTIME_SCRIPT_IDS,
  VOICE_PACK_DECODED_CACHE_LIMIT_BYTES,
} from '../src/audio/voicePacks/VoicePackRegistry';
import type {
  VoicePackClip,
  VoicePackId,
  VoicePackManifest,
} from '../src/audio/voicePacks/VoicePackTypes';
import {
  listKnownStartingQuarterbacks,
  resolveQuarterbackSpotlight,
} from '../src/audio/PregameCommentaryCatalog';
import { createQuarterbackScoutingProfile } from '../src/roster/QuarterbackScoutingProfile';
import type { TeamRatings } from '../src/ratings/TeamRatingCalculator';
import {
  createZeroTeamGameStats,
  type GameStatsSnapshot,
} from '../src/stats/GameStatsTypes';

describe('compact voice packs', () => {
  it('selects the same announcer pack for the same match seed and distributes across packs', () => {
    const input = {
      matchSeed: 'week-1',
      opponentTeamId: 'lakefront-lights',
      setting: 'auto' as const,
      userTeamId: 'metro-meteors',
    };

    expect(selectVoicePack(input)).toEqual(selectVoicePack(input));

    const selected = new Set<VoicePackId>();
    for (let index = 0; index < 30; index += 1) {
      selected.add(selectVoicePack({
        ...input,
        matchSeed: `seed-${index}`,
      }).packId);
    }

    expect(selected).toEqual(new Set(['announcer-a', 'announcer-b']));
  });

  it('honors explicit voice settings for the entire match', () => {
    expect(selectVoicePack({
      matchSeed: 'same',
      opponentTeamId: 'lakefront-lights',
      setting: 'announcer-b',
      userTeamId: 'metro-meteors',
    })).toMatchObject({
      packId: 'announcer-b',
      reason: 'forced',
    });
  });

  it('fetches only the selected manifest before resolving audio', async () => {
    const fetchedUrls: string[] = [];
    const registered: string[] = [];
    const manifest = createManifest('announcer-b', [
      createClip('announcer-b', 'ann_touchdown_01', 1240),
    ]);
    const resolver = new VoicePackAssetResolver({
      fetcher: async (input) => {
        fetchedUrls.push(String(input));
        return new Response(JSON.stringify(manifest), { status: 200 });
      },
      initialSelection: {
        matchSeed: 'forced',
        opponentTeamId: 'lakefront-lights',
        setting: 'announcer-b',
        userTeamId: 'metro-meteors',
      },
      registerAudioAssets: (assets) => {
        registered.push(...assets.map((asset) => asset.assetId));
      },
    });

    const resolved = await resolver.resolveClip('ann_touchdown_01');

    expect(fetchedUrls).toEqual(['/audio/voice-packs/announcer-b/voice-pack-manifest.json']);
    expect(resolved).toMatchObject({
      caption: 'Caption for ann_touchdown_01',
      packId: 'announcer-b',
    });
    expect(registered).toEqual(['announcer_b_ann_touchdown_01']);
    expect(resolver.getSnapshot(1024, null)).toMatchObject({
      cacheLimitBytes: VOICE_PACK_DECODED_CACHE_LIMIT_BYTES,
      decodedBytes: 1024,
      loadedClipCount: 1,
      loadedManifest: 'announcer-b',
      selectedPack: 'announcer-b',
      selectionReason: 'forced',
    });
  });

  it('falls back to the default pack when the selected clip is unavailable', async () => {
    const fetchedUrls: string[] = [];
    const manifests = new Map<string, VoicePackManifest>([
      ['/audio/voice-packs/announcer-b/voice-pack-manifest.json', createManifest('announcer-b', [
        createClip('announcer-b', 'ann_first_down_01', 0),
      ])],
      ['/audio/voice-packs/announcer-a/voice-pack-manifest.json', createManifest('announcer-a', [
        createClip('announcer-a', 'ann_first_down_01', 2500),
      ])],
    ]);
    const resolver = new VoicePackAssetResolver({
      fetcher: async (input) => {
        fetchedUrls.push(String(input));
        return new Response(JSON.stringify(manifests.get(String(input))), { status: 200 });
      },
      initialSelection: {
        matchSeed: 'forced',
        opponentTeamId: 'lakefront-lights',
        setting: 'announcer-b',
        userTeamId: 'metro-meteors',
      },
    });

    const resolved = await resolver.resolveClip('ann_first_down_01');

    expect(resolved).toMatchObject({
      fallbackSource: 'defaultPack',
      packId: DEFAULT_VOICE_PACK_ID,
    });
    expect(fetchedUrls).toEqual([
      '/audio/voice-packs/announcer-b/voice-pack-manifest.json',
      '/audio/voice-packs/announcer-a/voice-pack-manifest.json',
    ]);
  });

  it('uses generated quarterback intro lines when available', () => {
    const quarterback = listKnownStartingQuarterbacks().find(
      (candidate) => candidate.rosterPlayerId === 'metro-meteors-qb-12',
    )!;
    const selection = resolveQuarterbackSpotlight({
      matchSeed: 'qb-specific',
      rosterPlayerId: quarterback.rosterPlayerId,
    });

    expect(selection.available).toBe(true);
    expect(selection.clip?.rosterPlayerId).toBe(quarterback.rosterPlayerId);
    expect(selection.caption).toContain(quarterback.player.displayName);
    expect(selection.caption).toContain(String(quarterback.jerseyNumber));
  });

  it('keeps generic quarterback archetype lines as fallback when no player-specific intro exists', () => {
    const quarterback = listKnownStartingQuarterbacks().find(
      (candidate) => candidate.rosterPlayerId === 'ironwood-owls-qb-4',
    )!;
    const profile = createQuarterbackScoutingProfile(quarterback.player);
    const selection = resolveQuarterbackSpotlight({
      matchSeed: 'qb-generic',
      rosterPlayerId: quarterback.rosterPlayerId,
    });

    expect(selection.available).toBe(true);
    expect(selection.clip?.qbArchetype).toBe(profile.archetype);
    expect(selection.caption).not.toContain(quarterback.player.displayName);
    expect(selection.caption).not.toContain(String(quarterback.jerseyNumber));
  });

  it('resolves game-opinion and halftime categories from real models instead of exact-stat scripts', () => {
    expect(resolveTeamRatingOpinionCategory(
      createTeamRatings({ passing: 90 }),
      createTeamRatings({ coverage: 74 }),
    )).toBe('userPassingAdvantage');
    expect(GAME_OPINION_SCRIPT_IDS.userPassingAdvantage).toHaveLength(2);

    const stats = createStatsSnapshot({
      opponentPoints: 20,
      userPassingYards: 210,
      userPoints: 31,
    });

    expect(resolveHalftimeCategory(stats)).toBe('highScoringGame');
    expect(HALFTIME_SCRIPT_IDS.highScoringGame).toHaveLength(2);
  });
});

function createManifest(
  id: VoicePackId,
  clips: readonly VoicePackClip[],
): VoicePackManifest {
  return {
    announcerName: id,
    clips: Object.fromEntries(clips.map((clip) => [clip.scriptId, clip])),
    displayName: id,
    id,
    requiredScriptIds: clips.map((clip) => clip.scriptId),
    schemaVersion: 1,
    targetCompressedBytes: 4 * 1024 * 1024,
  };
}

function createClip(
  packId: VoicePackId,
  scriptId: string,
  compressedBytes: number,
): VoicePackClip {
  return {
    assetId: `${packId}_${scriptId}`.replaceAll('-', '_'),
    caption: `Caption for ${scriptId}`,
    category: 'touchdown',
    compressedBytes,
    contentHash: compressedBytes > 0 ? `${scriptId}-hash` : null,
    domain: 'gameplay',
    durationSeconds: 2,
    outputPath: `public/audio/voice-packs/${packId}/${scriptId}.mp3`,
    scriptId,
    url: `/audio/voice-packs/${packId}/${scriptId}.mp3`,
  };
}

function createTeamRatings(patch: Partial<TeamRatings>): TeamRatings {
  return {
    blocking: 78,
    coverage: 78,
    defense: 78,
    offense: 78,
    overall: 78,
    passRush: 78,
    passing: 78,
    rushing: 78,
    specialTeams: 78,
    ...patch,
  };
}

function createStatsSnapshot(patch: {
  opponentPassingYards?: number;
  opponentPoints?: number;
  opponentRushingYards?: number;
  opponentTurnovers?: number;
  userPassingYards?: number;
  userPoints?: number;
  userRushingYards?: number;
  userTurnovers?: number;
}): GameStatsSnapshot {
  return {
    duplicateSuppressionCount: 0,
    invariantFailures: [],
    lastEvent: null,
    players: {},
    possessionSeconds: {
      opponent: 0,
      user: 0,
    },
    processedEventCount: 0,
    teams: {
      opponent: {
        ...createZeroTeamGameStats(),
        passingYards: patch.opponentPassingYards ?? 0,
        points: patch.opponentPoints ?? 0,
        rushingYards: patch.opponentRushingYards ?? 0,
        turnovers: patch.opponentTurnovers ?? 0,
      },
      user: {
        ...createZeroTeamGameStats(),
        passingYards: patch.userPassingYards ?? 0,
        points: patch.userPoints ?? 0,
        rushingYards: patch.userRushingYards ?? 0,
        turnovers: patch.userTurnovers ?? 0,
      },
    },
  };
}
