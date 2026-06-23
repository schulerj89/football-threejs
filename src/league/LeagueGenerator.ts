import { listTeamRosters } from '../roster/RosterRegistry';
import { listTeamProfiles } from '../teams/TeamRegistry';
import {
  DEFAULT_LEAGUE_SEED,
  LEAGUE_GENERATOR_VERSION,
  LEAGUE_SCHEMA_VERSION,
  type LeagueData,
} from './LeagueTypes';
import { encodeLeagueData } from './LeagueDataCodec';

export interface LeagueGenerationOptions {
  readonly seed?: string;
}

export function generateLeagueData(options: LeagueGenerationOptions = {}): LeagueData {
  const seed = options.seed ?? DEFAULT_LEAGUE_SEED;
  const withoutHash = {
    generatorVersion: LEAGUE_GENERATOR_VERSION,
    schemaVersion: LEAGUE_SCHEMA_VERSION,
    seed,
    teams: listTeamProfiles(),
    rosters: listTeamRosters(),
  };
  const encoded = encodeLeagueData(withoutHash);
  return {
    ...withoutHash,
    contentHash: encoded.contentHash,
  };
}
