import { existsSync, statSync } from 'node:fs';
import { COMMENTARY_CATALOG } from '../../src/audio/CommentaryCatalog';
import { PREGAME_COMMENTARY_CATALOG } from '../../src/audio/PregameCommentaryCatalog';
import {
  GAME_OPINION_SCRIPT_IDS,
  HALFTIME_SCRIPT_IDS,
  REQUIRED_VOICE_PACK_SCRIPT_IDS,
  VOICE_PACKS,
  VOICE_PACK_SCHEMA_VERSION,
} from '../../src/audio/voicePacks/VoicePackRegistry';
import type {
  BroadcastScriptId,
  GameOpinionCategory,
  HalftimeCategory,
  VoicePackClip,
  VoicePackId,
  VoicePackManifest,
  VoicePackScriptDomain,
} from '../../src/audio/voicePacks/VoicePackTypes';
import {
  ANNOUNCER_OUTPUT_FORMAT,
  ANNOUNCER_TTS_MODEL_ID,
} from './announcerScriptCatalog';
import {
  getFileHash,
  readAudioDurationSeconds,
  resolveRepoPath,
  type AudioAssetPlan,
} from './schemas';

export interface CompactBroadcastScript {
  approximateDurationSeconds: number;
  caption: string;
  category: string;
  domain: VoicePackScriptDomain;
  script: string;
  scriptId: BroadcastScriptId;
  variant: number;
}

export interface VoicePackIdentity {
  description: string;
  displayName: string;
  id: VoicePackId;
  voiceDirection: string;
  voiceIdPlaceholder: string;
}

export const VOICE_PACK_IDENTITIES: Readonly<Record<VoicePackId, VoicePackIdentity>> = {
  'announcer-a': {
    description: VOICE_PACKS[0].description,
    displayName: VOICE_PACKS[0].displayName,
    id: 'announcer-a',
    voiceDirection:
      'Warm, authoritative, modern football broadcast delivery. Controlled excitement, clear phrasing, no imitation of any real announcer.',
    voiceIdPlaceholder: 'voice-pack-a-unconfigured',
  },
  'announcer-b': {
    description: VOICE_PACKS[1].description,
    displayName: VOICE_PACKS[1].displayName,
    id: 'announcer-b',
    voiceDirection:
      'Crisp, confident, analytical football broadcast delivery. Energetic but composed, distinct from Voice A, no imitation of any real announcer.',
    voiceIdPlaceholder: 'voice-pack-b-unconfigured',
  },
} as const;

export const COMPACT_BROADCAST_SCRIPT_CATALOG: readonly CompactBroadcastScript[] = [
  ...COMMENTARY_CATALOG.map((clip) => ({
    approximateDurationSeconds: clip.durationSeconds,
    caption: clip.caption,
    category: clip.category,
    domain: 'gameplay' as const,
    script: clip.caption,
    scriptId: clip.scriptId,
    variant: clip.variant,
  })),
  ...PREGAME_COMMENTARY_CATALOG.map((clip) => ({
    approximateDurationSeconds: clip.durationSeconds,
    caption: clip.caption,
    category: clip.category,
    domain: 'pregame' as const,
    script: clip.script,
    scriptId: clip.scriptId,
    variant: clip.variant,
  })),
  ...createGameOpinionScripts(),
  ...createHalftimeScripts(),
] as const;

export function createVoicePackSpeechPlan(
  packId: VoicePackId,
  voiceId = VOICE_PACK_IDENTITIES[packId].voiceIdPlaceholder,
): readonly AudioAssetPlan[] {
  return COMPACT_BROADCAST_SCRIPT_CATALOG.map((script) => ({
    assetId: createVoicePackAssetId(packId, script.scriptId),
    caption: script.caption,
    category: 'announcer',
    eventCategory: `${script.domain}:${script.category}`,
    generationStatus: 'planned',
    kind: 'speech',
    loop: false,
    maxBytes: 110_000,
    metadata: {
      packId,
      scriptDomain: script.domain,
      scriptCategory: script.category,
      variant: script.variant,
    },
    modelId: ANNOUNCER_TTS_MODEL_ID,
    notes: `${VOICE_PACK_IDENTITIES[packId].displayName}; compact ${script.domain} ${script.category}.`,
    outputFormat: ANNOUNCER_OUTPUT_FORMAT,
    outputPath: `public/audio/voice-packs/${packId}/${script.scriptId}.mp3`,
    requestedDurationSeconds: script.approximateDurationSeconds,
    runtimeLoadingStrategy: 'buffer',
    script: script.script,
    scriptId: script.scriptId,
    voiceId,
    voiceSettings: {
      similarityBoost: packId === 'announcer-a' ? 0.72 : 0.68,
      stability: packId === 'announcer-a' ? 0.58 : 0.62,
      style: script.domain === 'gameplay' ? 0.34 : 0.27,
      useSpeakerBoost: true,
    },
  }));
}

export function createVoicePackManifest(
  packId: VoicePackId,
  generatedAt = new Date().toISOString(),
): VoicePackManifest {
  const identity = VOICE_PACK_IDENTITIES[packId];
  const clips: Record<BroadcastScriptId, VoicePackClip> = {};

  for (const script of COMPACT_BROADCAST_SCRIPT_CATALOG) {
    const generatedPath = `public/audio/voice-packs/${packId}/${script.scriptId}.mp3`;
    const compatibilityPath = packId === 'announcer-a'
      ? resolveCompatibilityPath(script)
      : null;
    const outputPath = existingPath(generatedPath) ?? compatibilityPath ?? generatedPath;
    const exists = existsSync(resolveRepoPath(outputPath));

    clips[script.scriptId] = {
      assetId: createVoicePackAssetId(packId, script.scriptId),
      caption: script.caption,
      category: script.category as VoicePackClip['category'],
      compressedBytes: exists ? statSync(resolveRepoPath(outputPath)).size : 0,
      contentHash: exists ? getFileHash(outputPath) : null,
      domain: script.domain,
      durationSeconds: readAudioDurationSeconds(outputPath) ?? script.approximateDurationSeconds,
      modelId: ANNOUNCER_TTS_MODEL_ID,
      outputPath,
      scriptId: script.scriptId,
      url: outputPath.replace(/^public\//, '/'),
      voiceId: identity.voiceIdPlaceholder,
    };
  }

  return {
    announcerName: identity.displayName.replace(/^Voice [AB] - /, ''),
    clips,
    displayName: identity.displayName,
    generatedAt,
    id: packId,
    requiredScriptIds: REQUIRED_VOICE_PACK_SCRIPT_IDS,
    schemaVersion: VOICE_PACK_SCHEMA_VERSION,
    targetCompressedBytes: 4 * 1024 * 1024,
  };
}

export function validateCompactBroadcastScriptCatalog(
  catalog: readonly CompactBroadcastScript[] = COMPACT_BROADCAST_SCRIPT_CATALOG,
): string[] {
  const errors: string[] = [];
  const scriptIds = new Set<string>();

  for (const script of catalog) {
    if (scriptIds.has(script.scriptId)) {
      errors.push(`${script.scriptId}: duplicate compact script ID`);
    }
    scriptIds.add(script.scriptId);

    if (script.caption !== script.script) {
      errors.push(`${script.scriptId}: caption must exactly match script`);
    }
    if (script.approximateDurationSeconds <= 0 || script.approximateDurationSeconds > 8.5) {
      errors.push(`${script.scriptId}: script duration is outside compact broadcast bounds`);
    }
    if (containsForbiddenBroadcastReference(script.script)) {
      errors.push(`${script.scriptId}: contains forbidden real-announcer or unsupported-stat reference`);
    }
  }

  for (const requiredId of REQUIRED_VOICE_PACK_SCRIPT_IDS) {
    if (!scriptIds.has(requiredId)) {
      errors.push(`${requiredId}: missing from compact broadcast script catalog`);
    }
  }

  return errors;
}

function createGameOpinionScripts(): CompactBroadcastScript[] {
  const scripts: Record<GameOpinionCategory, readonly string[]> = {
    evenlyMatchedTeams: [
      'These teams look close on paper. Small mistakes may decide the early rhythm.',
      'There is not much separation here. Execution is the separator today.',
    ],
    offensiveLineMatchup: [
      'The line of scrimmage is the matchup to watch. Protection and leverage have to hold.',
      'If the offensive front can stay clean, the playbook opens up fast.',
    ],
    opponentCoverageThreat: [
      'The coverage unit on the other side can squeeze throwing windows quickly.',
      'The receivers need sharp breaks, because the coverage matchup is a real test.',
    ],
    opponentPassRushThreat: [
      'Pressure off the edge could shape this game if the pocket gets noisy.',
      'The pass rush is capable of changing the timing before routes develop.',
    ],
    specialTeamsAdvantage: [
      'Special teams could tilt hidden yardage before the offense ever takes over.',
      'Field position may matter here, and the kicking game has a chance to swing it.',
    ],
    turnoverImportance: [
      'Ball security is the thread running through this matchup.',
      'A takeaway could flip this game faster than any single play call.',
    ],
    userPassingAdvantage: [
      'The passing matchup gives this offense a real chance to attack space.',
      'If the protection holds, the throwing game can be a strength today.',
    ],
    userRushingAdvantage: [
      'The run game has a path to control the tempo if blocks land cleanly.',
      'Early rushing success could make the whole offense easier to manage.',
    ],
  };

  return Object.entries(scripts).flatMap(([category, lines]) =>
    lines.map((script, index) => createCompactScript(
      GAME_OPINION_SCRIPT_IDS[category as GameOpinionCategory][index],
      'gameOpinion',
      category,
      index + 1,
      script,
      3.5,
    )),
  );
}

function createHalftimeScripts(): CompactBroadcastScript[] {
  const scripts: Record<HalftimeCategory, readonly string[]> = {
    closeGame: [
      'This one is tight at halftime. The next clean drive may matter most.',
      'A close game through the break means adjustments have to show up quickly.',
    ],
    defensiveGame: [
      'Defense has controlled the shape of this game so far.',
      'Neither offense has found easy space, and that keeps the pressure high.',
    ],
    halftimeOpening: [
      'We have reached halftime, and the numbers tell the first-half story.',
      'At the break, the halftime picture is coming into focus.',
    ],
    highScoringGame: [
      'Points came quickly in the first half. The defenses need answers now.',
      'This has opened up into a scoring pace that rewards every possession.',
    ],
    lowScoringGame: [
      'The first half stayed low-scoring, so field position remains critical.',
      'Points have been scarce, and patience may matter after the break.',
    ],
    oneSidedGame: [
      'One side has controlled the first half, but the next possession still matters.',
      'The halftime gap is real, and the response has to start immediately.',
    ],
    opponentPassingSuccess: [
      'The opposing passing game found enough rhythm to shape the first half.',
      'Coverage adjustments are coming after the opponent created space through the air.',
    ],
    opponentRushingSuccess: [
      'The opponent found room on the ground, and that changes the second-half math.',
      'Run fits have to tighten after the opponent built momentum on the ground.',
    ],
    secondHalfTransition: [
      'The second-half kickoff is next, and field position will matter right away.',
      'The teams are coming back out, and the second-half kickoff is moments away.',
    ],
    turnoverStory: [
      'Turnovers changed the first-half story, and protecting the football is priority one.',
      'The ball has not been safe enough. That has to change after halftime.',
    ],
    userPassingSuccess: [
      'The passing game gave this offense its cleanest answers before halftime.',
      'The throws were there in the first half, and that rhythm is worth protecting.',
    ],
    userRushingSuccess: [
      'The run game gave this offense structure before the break.',
      'Rushing success helped settle the first half, and it can travel into the third quarter.',
    ],
  };

  return Object.entries(scripts).flatMap(([category, lines]) =>
    lines.map((script, index) => createCompactScript(
      HALFTIME_SCRIPT_IDS[category as HalftimeCategory][index],
      'halftime',
      category,
      index + 1,
      script,
      3.7,
    )),
  );
}

function createCompactScript(
  scriptId: string,
  domain: VoicePackScriptDomain,
  category: string,
  variant: number,
  script: string,
  approximateDurationSeconds: number,
): CompactBroadcastScript {
  return {
    approximateDurationSeconds,
    caption: script,
    category,
    domain,
    script,
    scriptId,
    variant,
  };
}

function createVoicePackAssetId(packId: VoicePackId, scriptId: string): string {
  return `${packId}_${scriptId}`.replaceAll('-', '_');
}

function existingPath(path: string): string | null {
  return existsSync(resolveRepoPath(path)) ? path : null;
}

function resolveCompatibilityPath(script: CompactBroadcastScript): string | null {
  if (script.domain === 'gameplay') {
    return existingPath(`public/audio/announcer/${script.scriptId}.mp3`);
  }

  if (script.domain === 'pregame') {
    return existingPath(`public/audio/announcer/pregame/${script.scriptId}.mp3`);
  }

  return null;
}

function containsForbiddenBroadcastReference(script: string): boolean {
  return [
    /\bAl Michaels\b/i,
    /\bJoe Buck\b/i,
    /\bJim Nantz\b/i,
    /\bTony Romo\b/i,
    /\bTroy Aikman\b/i,
    /\bCollinsworth\b/i,
    /\b\d+\s*(passing|rushing|receiving|sacks|turnovers)\b/i,
  ].some((pattern) => pattern.test(script));
}
