import type { LocalAudioAsset } from '../AudioAssetManifest';
import type { PregameCommentaryCategory } from '../PregameCommentaryCatalog';
import type { CommentaryCategory } from '../CommentaryCatalog';
import type { QuarterbackArchetype } from '../../roster/QuarterbackScoutingProfile';

export type VoicePackId = 'announcer-a' | 'announcer-b';
export type AnnouncerVoiceSetting = 'auto' | VoicePackId;

export type BroadcastScriptId = string;

export type VoicePackScriptDomain =
  | 'gameplay'
  | 'gameOpinion'
  | 'halftime'
  | 'postgame'
  | 'pregame';

export type GameOpinionCategory =
  | 'evenlyMatchedTeams'
  | 'offensiveLineMatchup'
  | 'opponentCoverageThreat'
  | 'opponentPassRushThreat'
  | 'specialTeamsAdvantage'
  | 'turnoverImportance'
  | 'userPassingAdvantage'
  | 'userRushingAdvantage';

export type HalftimeCategory =
  | 'closeGame'
  | 'defensiveGame'
  | 'halftimeOpening'
  | 'highScoringGame'
  | 'lowScoringGame'
  | 'oneSidedGame'
  | 'opponentPassingSuccess'
  | 'opponentRushingSuccess'
  | 'secondHalfTransition'
  | 'turnoverStory'
  | 'userPassingSuccess'
  | 'userRushingSuccess';

export type PostgameCategory =
  | 'balancedFinal'
  | 'closeFinish'
  | 'decisiveWin'
  | 'defensiveControl'
  | 'offensiveEfficiency'
  | 'quarterbackDominance'
  | 'rushingControl'
  | 'turnoverSwing';

export interface VoicePackClip {
  readonly assetId: string;
  readonly caption: string;
  readonly category?: CommentaryCategory | PregameCommentaryCategory | GameOpinionCategory | HalftimeCategory | PostgameCategory;
  readonly compressedBytes?: number;
  readonly contentHash?: string | null;
  readonly domain: VoicePackScriptDomain;
  readonly durationSeconds: number;
  readonly modelId?: string;
  readonly outputPath?: string;
  readonly priority?: number;
  readonly provenancePath?: string;
  readonly scriptId: BroadcastScriptId;
  readonly url: string;
  readonly voiceId?: string;
}

export interface VoicePackManifest {
  readonly announcerName: string;
  readonly clips: Record<BroadcastScriptId, VoicePackClip>;
  readonly displayName: string;
  readonly generatedAt?: string;
  readonly id: VoicePackId;
  readonly requiredScriptIds: readonly BroadcastScriptId[];
  readonly schemaVersion: number;
  readonly targetCompressedBytes?: number;
}

export interface VoicePackMetadata {
  readonly announcerName: string;
  readonly description: string;
  readonly displayName: string;
  readonly id: VoicePackId;
  readonly manifestUrl: string;
}

export interface VoicePackSelectionInput {
  readonly matchSeed: number | string | null | undefined;
  readonly opponentTeamId: string | null | undefined;
  readonly setting: AnnouncerVoiceSetting;
  readonly userTeamId: string | null | undefined;
}

export interface VoicePackSelection {
  readonly packId: VoicePackId;
  readonly reason: 'forced' | 'seeded';
  readonly seedKey: string;
}

export interface VoicePackResolvedClip {
  readonly asset: LocalAudioAsset;
  readonly caption: string;
  readonly clip: VoicePackClip;
  readonly fallbackSource: 'defaultPack' | 'selectedPack';
  readonly packId: VoicePackId;
}

export interface VoicePackAssetResolverSnapshot {
  readonly cacheLimitBytes: number;
  readonly decodedBytes: number;
  readonly fallbackSource: string | null;
  readonly lastEviction: string | null;
  readonly loadedClipCount: number;
  readonly loadedManifest: VoicePackId | null;
  readonly selectedPack: VoicePackId;
  readonly selectionReason: VoicePackSelection['reason'];
}

export interface QuarterbackIntroScriptContext {
  readonly archetype: QuarterbackArchetype;
}
