import type { AudioAssetPlan } from './schemas';

export type AnnouncerEventCategory =
  | 'bigGain'
  | 'challengeEnding'
  | 'firstDown'
  | 'gameOpening'
  | 'incomplete'
  | 'outOfBounds'
  | 'playReady'
  | 'sack'
  | 'tackleForLoss'
  | 'touchdown'
  | 'turnoverOnDowns';

export type AnnouncerIntensity = 'high' | 'low' | 'medium' | 'peak';

export interface AnnouncerIdentity {
  description: string;
  displayName: string;
  id: string;
  voiceDirection: string;
}

export interface AnnouncerScript {
  approximateDurationSeconds: number;
  caption: string;
  eventCategory: AnnouncerEventCategory;
  intensity: AnnouncerIntensity;
  script: string;
  scriptId: string;
  variant: number;
}

export const ANNOUNCER_IDENTITY: AnnouncerIdentity = {
  id: 'gridiron-local-prototype',
  displayName: 'Gridiron Local Prototype Announcer',
  description:
    'Original fictional football broadcaster for the low-poly prototype. Warm, authoritative, modern, and energetic without imitating a named person.',
  voiceDirection:
    'Clear modern football broadcast delivery, controlled energy, warm authority, able to rise for big plays without shouting every line.',
} as const;

export const ANNOUNCER_TTS_MODEL_ID = 'eleven_v3';
export const ANNOUNCER_OUTPUT_FORMAT = 'mp3_44100_128';
export const ANNOUNCER_VOICE_ID_PLACEHOLDER = 'prototype-announcer-voice-unconfigured';

export const ANNOUNCER_SCRIPT_CATALOG: readonly AnnouncerScript[] = [
  line('ann_game_opening_01', 'gameOpening', 1, 'low', 'Settle in. The offense has a short field and a ticking clock.', 3.5),
  line('ann_game_opening_02', 'gameOpening', 2, 'low', 'Here we go. Clean execution is the whole story on this drive.', 3.5),
  line('ann_play_ready_01', 'playReady', 1, 'low', 'Fresh snap coming. The offense is set.', 2.4),
  line('ann_play_ready_02', 'playReady', 2, 'low', 'Quiet at the line. The play call is in.', 2.5),
  line('ann_first_down_01', 'firstDown', 1, 'medium', 'That keeps the drive moving. The offense earns a fresh set.', 3.4),
  line('ann_first_down_02', 'firstDown', 2, 'medium', 'They needed the marker, and they got there.', 2.8),
  line('ann_first_down_03', 'firstDown', 3, 'medium', 'Good push after the snap. The chains move again.', 3),
  line('ann_touchdown_01', 'touchdown', 1, 'peak', 'He breaks through and finishes it. Touchdown.', 2.9),
  line('ann_touchdown_02', 'touchdown', 2, 'peak', 'Into the paint. The offense cashes in.', 2.7),
  line('ann_touchdown_03', 'touchdown', 3, 'peak', 'That run finds daylight all the way home.', 2.7),
  line('ann_sack_01', 'sack', 1, 'high', 'Pressure gets there. The quarterback is wrapped up behind the line.', 3.7),
  line('ann_sack_02', 'sack', 2, 'high', 'The pocket closes fast, and the defense wins the down.', 3.3),
  line('ann_sack_03', 'sack', 3, 'high', 'Nowhere to go. The rush drops him before the throw.', 3.2),
  line('ann_tackle_for_loss_01', 'tackleForLoss', 1, 'high', 'Hit in the backfield. That one moves the wrong way.', 3),
  line('ann_tackle_for_loss_02', 'tackleForLoss', 2, 'high', 'The defense knifes through and shuts it down early.', 3),
  line('ann_big_gain_01', 'bigGain', 1, 'high', 'Big lane, big burst. The offense flips the field.', 3),
  line('ann_big_gain_02', 'bigGain', 2, 'high', 'He found space and turned it into a chunk.', 2.7),
  line('ann_big_gain_03', 'bigGain', 3, 'high', 'That is the kind of gain that changes the drive.', 3),
  line('ann_incomplete_01', 'incomplete', 1, 'medium', 'The throw is there late, and it falls away.', 2.6),
  line('ann_incomplete_02', 'incomplete', 2, 'medium', 'Close window, no connection.', 1.8),
  line('ann_incomplete_03', 'incomplete', 3, 'medium', 'The pass misses the mark. The drive moves to the next down.', 3.4),
  line('ann_out_of_bounds_01', 'outOfBounds', 1, 'medium', 'Forced to the sideline, and the spot comes back in.', 3),
  line('ann_out_of_bounds_02', 'outOfBounds', 2, 'medium', 'He steps out before the defense can finish the hit.', 3),
  line('ann_turnover_on_downs_01', 'turnoverOnDowns', 1, 'high', 'The stop holds. The drive ends on downs.', 2.6),
  line('ann_turnover_on_downs_02', 'turnoverOnDowns', 2, 'high', 'Fourth down comes up short, and the drill resets.', 3),
  line('ann_challenge_ending_01', 'challengeEnding', 1, 'medium', 'That is the horn. Final score is on the board.', 3),
  line('ann_challenge_ending_02', 'challengeEnding', 2, 'medium', 'Time runs out, and the offense has its number.', 3),
] as const;

const HIGH_VALUE_EVENT_COUNTS: Readonly<Record<string, number>> = {
  bigGain: 3,
  firstDown: 3,
  incomplete: 3,
  sack: 3,
  touchdown: 3,
};

const STANDARD_EVENT_COUNTS: Readonly<Record<string, number>> = {
  challengeEnding: 2,
  gameOpening: 2,
  outOfBounds: 2,
  playReady: 2,
  tackleForLoss: 2,
  turnoverOnDowns: 2,
};

export function createAnnouncerSpeechPlan(
  voiceId = ANNOUNCER_VOICE_ID_PLACEHOLDER,
): readonly AudioAssetPlan[] {
  return ANNOUNCER_SCRIPT_CATALOG.map((script) => ({
    assetId: script.scriptId,
    caption: script.caption,
    category: 'announcer',
    eventCategory: script.eventCategory,
    generationStatus: 'planned',
    kind: 'speech',
    loop: false,
    maxBytes: 140_000,
    modelId: ANNOUNCER_TTS_MODEL_ID,
    notes: `${ANNOUNCER_IDENTITY.displayName}; ${script.intensity} ${script.eventCategory} variant ${script.variant}.`,
    outputFormat: ANNOUNCER_OUTPUT_FORMAT,
    outputPath: `public/audio/announcer/${script.scriptId}.mp3`,
    requestedDurationSeconds: script.approximateDurationSeconds,
    runtimeLoadingStrategy: 'buffer',
    script: script.script,
    scriptId: script.scriptId,
    voiceId,
    voiceSettings: {
      stability: 0.56,
      similarityBoost: 0.72,
      style: script.intensity === 'peak' ? 0.46 : script.intensity === 'high' ? 0.38 : 0.25,
      useSpeakerBoost: true,
    },
  }));
}

export function validateAnnouncerScriptCatalog(
  catalog: readonly AnnouncerScript[] = ANNOUNCER_SCRIPT_CATALOG,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const script of catalog) {
    if (ids.has(script.scriptId)) {
      errors.push(`${script.scriptId}: duplicate script ID`);
    }
    ids.add(script.scriptId);

    if (script.caption !== script.script) {
      errors.push(`${script.scriptId}: caption must exactly match script`);
    }
    if (script.approximateDurationSeconds <= 0 || script.approximateDurationSeconds > 5) {
      errors.push(`${script.scriptId}: approximate duration should stay near the 1-4 second target`);
    }
    if (/\b(player|team|quarter|record|league|network)\b/i.test(script.script)) {
      errors.push(`${script.scriptId}: script contains unsupported named-stat context`);
    }
  }

  for (const [eventCategory, expectedCount] of Object.entries({
    ...HIGH_VALUE_EVENT_COUNTS,
    ...STANDARD_EVENT_COUNTS,
  })) {
    const actualCount = catalog.filter((script) => script.eventCategory === eventCategory).length;
    if (actualCount !== expectedCount) {
      errors.push(`${eventCategory}: expected ${expectedCount} variants, found ${actualCount}`);
    }
  }

  return errors;
}

function line(
  scriptId: string,
  eventCategory: AnnouncerEventCategory,
  variant: number,
  intensity: AnnouncerIntensity,
  script: string,
  approximateDurationSeconds: number,
): AnnouncerScript {
  return {
    approximateDurationSeconds,
    caption: script,
    eventCategory,
    intensity,
    script,
    scriptId,
    variant,
  };
}
