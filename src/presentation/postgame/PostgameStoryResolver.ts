import {
  POSTGAME_SCRIPT_IDS,
} from '../../audio/voicePacks/VoicePackRegistry';
import type { PostgameCategory } from '../../audio/voicePacks/VoicePackTypes';
import { createDynastyPresentationSummary } from '../../dynasty/DynastyStoryContext';
import type { MatchPossession, MatchSnapshot } from '../../match/MatchTypes';
import { getRosterPlayer } from '../../roster/TeamRoster';
import { getTeamRosterOrDefault } from '../../roster/RosterRegistry';
import type { PlayerGameStats } from '../../stats/GameStatsTypes';
import type { PostgameStory } from './PostgamePresentationTypes';

interface PostgameStoryCandidate {
  readonly captionVariants: readonly string[];
  readonly category: PostgameCategory;
  readonly supportingPlayerId?: string | null;
  readonly supportingStatKeys: readonly string[];
  readonly supportingTeam: MatchPossession | null;
}

export function resolvePostgameStory(match: MatchSnapshot): PostgameStory {
  const candidates = createPostgameStoryCandidates(match);
  const selectionSeed = [
    match.deterministicSeed,
    match.userScore,
    match.opponentScore,
    match.stats.teams.user.totalYards,
    match.stats.teams.opponent.totalYards,
    match.stats.teams.user.turnovers,
    match.stats.teams.opponent.turnovers,
  ].join(':');
  const candidate = candidates[Math.abs(stableHash(selectionSeed)) % candidates.length]!;
  const caption =
    candidate.captionVariants[
      Math.abs(stableHash(`${selectionSeed}:${candidate.category}`)) % candidate.captionVariants.length
    ]!;
  const scriptIds = POSTGAME_SCRIPT_IDS[candidate.category];
  const scriptId = scriptIds[
    Math.abs(stableHash(`${selectionSeed}:${candidate.category}:script`)) % scriptIds.length
  ]!;

  return {
    caption,
    category: candidate.category,
    contextSummary: createDynastyPresentationSummary(match.dynastyStoryContext, 'postgame'),
    scriptId,
    supportingPlayerId: candidate.supportingPlayerId ?? null,
    supportingStatKeys: candidate.supportingStatKeys,
    supportingTeam: candidate.supportingTeam,
  };
}

function createPostgameStoryCandidates(match: MatchSnapshot): PostgameStoryCandidate[] {
  const user = match.stats.teams.user;
  const opponent = match.stats.teams.opponent;
  const winner = match.winner === 'tie' ? null : match.winner;
  const losingTeam = winner === 'user' ? 'opponent' : winner === 'opponent' ? 'user' : null;
  const margin = Math.abs(match.userScore - match.opponentScore);
  const turnoverDiff = user.turnovers - opponent.turnovers;
  const totalYardDiff = user.totalYards - opponent.totalYards;
  const passingDiff = user.passingYards - opponent.passingYards;
  const rushingDiff = user.rushingYards - opponent.rushingYards;
  const userPasser = findBestPasser(match, 'user');
  const opponentPasser = findBestPasser(match, 'opponent');
  const dominantPasser = resolveDominantPasser(match, userPasser, opponentPasser);
  const candidates: PostgameStoryCandidate[] = [];

  if (margin <= 7) {
    candidates.push({
      captionVariants: [
        `That final score tells the story. ${formatTeam(match, match.userScore >= match.opponentScore ? 'user' : 'opponent')} had just enough answers late.`,
        'This stayed tight all the way through. One or two execution moments ended up deciding it.',
      ],
      category: 'closeFinish',
      supportingStatKeys: ['score', 'totalYards'],
      supportingTeam: winner,
    });
  }

  if (winner && margin >= 21) {
    candidates.push({
      captionVariants: [
        `${formatTeam(match, winner)} controlled the scoreboard and never let the game get comfortable for the other sideline.`,
        `This was a complete result for ${formatTeam(match, winner)}. The margin matched the way the game felt.`,
      ],
      category: 'decisiveWin',
      supportingStatKeys: ['score', 'totalYards'],
      supportingTeam: winner,
    });
  }

  if (Math.abs(turnoverDiff) >= 2) {
    const cleanTeam: MatchPossession = turnoverDiff < 0 ? 'user' : 'opponent';
    candidates.push({
      captionVariants: [
        `${formatTeam(match, cleanTeam)} protected the football better, and that tilted the entire game.`,
        'The turnover margin is the first place to look. Extra possessions changed the finish.',
      ],
      category: 'turnoverSwing',
      supportingStatKeys: ['turnovers'],
      supportingTeam: cleanTeam,
    });
  }

  if (dominantPasser) {
    const playerName = formatPlayerName(match, dominantPasser.team, dominantPasser.player.rosterPlayerId);
    candidates.push({
      captionVariants: [
        `${playerName} put his stamp on this game. The passing attack gave the offense its cleanest answers.`,
        `Quarterback play shaped the result. ${playerName} kept finding space and kept the pressure on.`,
      ],
      category: 'quarterbackDominance',
      supportingPlayerId: dominantPasser.player.rosterPlayerId,
      supportingStatKeys: ['passingYards', 'passingTouchdowns', 'completions'],
      supportingTeam: dominantPasser.team,
    });
  }

  if (Math.abs(rushingDiff) >= 60 || user.rushingYards >= 130 || opponent.rushingYards >= 130) {
    const rushingTeam: MatchPossession = rushingDiff >= 0 ? 'user' : 'opponent';
    candidates.push({
      captionVariants: [
        `${formatTeam(match, rushingTeam)} leaned on the run game, and that physical edge showed up over four quarters.`,
        'The ground game mattered here. The team that could stay on schedule running the ball owned the cleaner path.',
      ],
      category: 'rushingControl',
      supportingStatKeys: ['rushingYards', 'rushingTouchdowns'],
      supportingTeam: rushingTeam,
    });
  }

  if (
    winner &&
    losingTeam &&
    (match.stats.teams[winner].sacksMade >= 3 || match.stats.teams[losingTeam].totalYards <= 140)
  ) {
    candidates.push({
      captionVariants: [
        `${formatTeam(match, winner)} made this a defensive result. The pressure and field position never really let up.`,
        'The defense deserves a lot of the credit. They kept the game from turning into a track meet.',
      ],
      category: 'defensiveControl',
      supportingStatKeys: ['sacksMade', 'totalYards'],
      supportingTeam: winner,
    });
  }

  if (Math.abs(totalYardDiff) >= 100 || Math.abs(passingDiff) >= 90) {
    const efficientTeam: MatchPossession = totalYardDiff >= 0 ? 'user' : 'opponent';
    candidates.push({
      captionVariants: [
        `${formatTeam(match, efficientTeam)} had the more efficient offense, and the stat sheet backs that up.`,
        'The yardage gap was not cosmetic. Sustained offense kept changing the leverage of this game.',
      ],
      category: 'offensiveEfficiency',
      supportingStatKeys: ['totalYards', 'passingYards', 'firstDowns'],
      supportingTeam: efficientTeam,
    });
  }

  if (candidates.length === 0 || match.winner === 'tie') {
    candidates.push({
      captionVariants: match.winner === 'tie'
        ? [
            'Nothing separated these teams at the final whistle. The numbers were as close as the score.',
            'A tie game leaves both sidelines with chances they will want back.',
          ]
        : [
            'The final numbers were balanced, but the winning side made the decisive plays when it had to.',
            'No single stat explains this one. The small moments added up by the final whistle.',
          ],
      category: match.winner === 'tie' ? 'balancedFinal' : 'closeFinish',
      supportingStatKeys: ['score', 'totalYards', 'firstDowns'],
      supportingTeam: winner,
    });
  }

  return candidates;
}

function resolveDominantPasser(
  match: MatchSnapshot,
  userPasser: PassingLeader | null,
  opponentPasser: PassingLeader | null,
): PassingLeader | null {
  const leaders = [userPasser, opponentPasser]
    .filter((leader): leader is PassingLeader => leader !== null)
    .sort((a, b) => b.player.passingYards - a.player.passingYards);
  const best = leaders[0] ?? null;
  const next = leaders[1] ?? null;
  if (!best) {
    return null;
  }

  const winnerBonus = match.winner === best.team ? 20 : 0;
  const yardGap = best.player.passingYards - (next?.player.passingYards ?? 0);
  const dominanceScore = best.player.passingYards + winnerBonus + best.player.passingTouchdowns * 35;
  if (best.player.passingYards >= 140 && (yardGap >= 55 || best.player.passingTouchdowns >= 2 || dominanceScore >= 220)) {
    return best;
  }

  return null;
}

interface PassingLeader {
  readonly player: PlayerGameStats;
  readonly team: MatchPossession;
}

function findBestPasser(match: MatchSnapshot, team: MatchPossession): PassingLeader | null {
  let best: PlayerGameStats | null = null;
  for (const player of Object.values(match.stats.players)) {
    if (player.team !== team || player.passingYards <= 0) {
      continue;
    }
    if (!best || player.passingYards > best.passingYards) {
      best = player;
    }
  }

  return best ? { player: best, team } : null;
}

function formatTeam(match: MatchSnapshot, team: MatchPossession): string {
  return team === 'user' ? match.userTeam.shortName : match.opponentTeam.shortName;
}

function formatPlayerName(
  match: MatchSnapshot,
  team: MatchPossession,
  rosterPlayerId: string,
): string {
  const profile = team === 'user' ? match.userTeam : match.opponentTeam;
  const roster = getTeamRosterOrDefault(profile.id);
  const player = getRosterPlayer(roster, rosterPlayerId);
  return player ? `#${player.jerseyNumber} ${player.displayName}` : rosterPlayerId;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
