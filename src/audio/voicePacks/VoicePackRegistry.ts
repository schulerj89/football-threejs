import { COMMENTARY_CATALOG } from '../CommentaryCatalog';
import { PREGAME_COMMENTARY_CATALOG } from '../PregameCommentaryCatalog';
import type {
  BroadcastScriptId,
  GameOpinionCategory,
  HalftimeCategory,
  PostgameCategory,
  VoicePackId,
  VoicePackMetadata,
} from './VoicePackTypes';

export const DEFAULT_VOICE_PACK_ID: VoicePackId = 'announcer-a';
export const VOICE_PACK_SCHEMA_VERSION = 1;
export const VOICE_PACK_DECODED_CACHE_LIMIT_BYTES = 8 * 1024 * 1024;

export const VOICE_PACKS: readonly VoicePackMetadata[] = [
  {
    announcerName: 'Grant Mercer',
    description:
      'Warm, authoritative, controlled-energy fictional football broadcaster.',
    displayName: 'Voice A - Grant Mercer',
    id: 'announcer-a',
    manifestUrl: '/audio/voice-packs/announcer-a/voice-pack-manifest.json',
  },
  {
    announcerName: 'Mara Ellison',
    description:
      'Crisp, energetic, modern fictional football broadcaster with a cooler analytical edge.',
    displayName: 'Voice B - Mara Ellison',
    id: 'announcer-b',
    manifestUrl: '/audio/voice-packs/announcer-b/voice-pack-manifest.json',
  },
] as const;

export const GAME_OPINION_SCRIPT_IDS: Readonly<Record<GameOpinionCategory, readonly BroadcastScriptId[]>> = {
  evenlyMatchedTeams: ['op_evenly_matched_01', 'op_evenly_matched_02'],
  offensiveLineMatchup: ['op_offensive_line_matchup_01', 'op_offensive_line_matchup_02'],
  opponentCoverageThreat: ['op_opponent_coverage_threat_01', 'op_opponent_coverage_threat_02'],
  opponentPassRushThreat: ['op_opponent_pass_rush_threat_01', 'op_opponent_pass_rush_threat_02'],
  specialTeamsAdvantage: ['op_special_teams_advantage_01', 'op_special_teams_advantage_02'],
  turnoverImportance: ['op_turnover_importance_01', 'op_turnover_importance_02'],
  userPassingAdvantage: ['op_user_passing_advantage_01', 'op_user_passing_advantage_02'],
  userRushingAdvantage: ['op_user_rushing_advantage_01', 'op_user_rushing_advantage_02'],
} as const;

export const HALFTIME_SCRIPT_IDS: Readonly<Record<HalftimeCategory, readonly BroadcastScriptId[]>> = {
  closeGame: ['half_close_game_01', 'half_close_game_02'],
  defensiveGame: ['half_defensive_game_01', 'half_defensive_game_02'],
  halftimeOpening: ['half_opening_01', 'half_opening_02'],
  highScoringGame: ['half_high_scoring_game_01', 'half_high_scoring_game_02'],
  lowScoringGame: ['half_low_scoring_game_01', 'half_low_scoring_game_02'],
  oneSidedGame: ['half_one_sided_game_01', 'half_one_sided_game_02'],
  opponentPassingSuccess: ['half_opponent_passing_success_01', 'half_opponent_passing_success_02'],
  opponentRushingSuccess: ['half_opponent_rushing_success_01', 'half_opponent_rushing_success_02'],
  secondHalfTransition: ['half_second_half_transition_01', 'half_second_half_transition_02'],
  turnoverStory: ['half_turnover_story_01', 'half_turnover_story_02'],
  userPassingSuccess: ['half_user_passing_success_01', 'half_user_passing_success_02'],
  userRushingSuccess: ['half_user_rushing_success_01', 'half_user_rushing_success_02'],
} as const;

export const POSTGAME_SCRIPT_IDS: Readonly<Record<PostgameCategory, readonly BroadcastScriptId[]>> = {
  balancedFinal: ['post_balanced_final_01', 'post_balanced_final_02'],
  closeFinish: ['post_close_finish_01', 'post_close_finish_02'],
  decisiveWin: ['post_decisive_win_01', 'post_decisive_win_02'],
  defensiveControl: ['post_defensive_control_01', 'post_defensive_control_02'],
  offensiveEfficiency: ['post_offensive_efficiency_01', 'post_offensive_efficiency_02'],
  quarterbackDominance: ['post_qb_dominance_01', 'post_qb_dominance_02'],
  rushingControl: ['post_rushing_control_01', 'post_rushing_control_02'],
  turnoverSwing: ['post_turnover_swing_01', 'post_turnover_swing_02'],
} as const;

export const REQUIRED_VOICE_PACK_SCRIPT_IDS: readonly BroadcastScriptId[] = [
  ...COMMENTARY_CATALOG.map((clip) => clip.scriptId),
  ...PREGAME_COMMENTARY_CATALOG.map((clip) => clip.scriptId),
  ...Object.values(GAME_OPINION_SCRIPT_IDS).flat(),
  ...Object.values(HALFTIME_SCRIPT_IDS).flat(),
] as const;

export function getVoicePackMetadata(id: VoicePackId): VoicePackMetadata {
  return VOICE_PACKS.find((pack) => pack.id === id) ?? VOICE_PACKS[0];
}

export function isVoicePackId(value: unknown): value is VoicePackId {
  return value === 'announcer-a' || value === 'announcer-b';
}
