import type { MatchPossession } from '../match/MatchTypes';
import type { PlayerRole, PlayerTeam } from '../playerModel';
import type { FootballPlayerVisualPosition, FootballPlayerVisualTeamSide } from '../presentation/players/FootballPlayerVisualFactory';

export type KickoffTeamPhase = 'kicking' | 'receiving';

export type KickoffKickingSlotId =
  | 'coverage-left-1'
  | 'coverage-left-2'
  | 'coverage-left-3'
  | 'coverage-left-4'
  | 'coverage-left-5'
  | 'coverage-right-1'
  | 'coverage-right-2'
  | 'coverage-right-3'
  | 'coverage-right-4'
  | 'coverage-right-5'
  | 'kicker';

export type KickoffReceivingSlotId =
  | 'front-line-left-1'
  | 'front-line-left-2'
  | 'front-line-middle'
  | 'front-line-right-1'
  | 'front-line-right-2'
  | 'returner-left'
  | 'returner-right'
  | 'second-line-left-1'
  | 'second-line-left-2'
  | 'second-line-right-1'
  | 'second-line-right-2';

export type KickoffSlotId = KickoffKickingSlotId | KickoffReceivingSlotId;

export interface KickoffPresentationParticipant {
  appearanceId: string;
  footballPosition: FootballPlayerVisualPosition;
  gameplayTeam: PlayerTeam;
  jerseyNumber: number;
  phase: KickoffTeamPhase;
  role: PlayerRole;
  rosterPlayerId: string;
  slotId: KickoffSlotId;
  team: MatchPossession;
  teamSide: FootballPlayerVisualTeamSide;
  visualId: string;
}

export interface KickoffPresentationRoster {
  kicker: KickoffPresentationParticipant | null;
  kickingParticipants: readonly KickoffPresentationParticipant[];
  kickingTeam: MatchPossession;
  noGameplayAuthority: true;
  participants: readonly KickoffPresentationParticipant[];
  receivingParticipants: readonly KickoffPresentationParticipant[];
  receivingTeam: MatchPossession;
  returners: readonly KickoffPresentationParticipant[];
}
