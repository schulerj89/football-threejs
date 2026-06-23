import type { BroadcastScriptId, PostgameCategory } from '../../audio/voicePacks/VoicePackTypes';
import type { MatchPossession } from '../../match/MatchTypes';

export interface PostgameStory {
  readonly caption: string;
  readonly category: PostgameCategory;
  readonly scriptId: BroadcastScriptId;
  readonly supportingPlayerId: string | null;
  readonly supportingStatKeys: readonly string[];
  readonly supportingTeam: MatchPossession | null;
}
