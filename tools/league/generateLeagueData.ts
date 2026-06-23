import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { encodeLeagueData, estimateEncodedLeagueBytes } from '../../src/league/LeagueDataCodec';
import { generateLeagueData } from '../../src/league/LeagueGenerator';
import { DEFAULT_LEAGUE_SEED } from '../../src/league/LeagueTypes';
import {
  throwOnLeagueValidationErrors,
  validateEncodedLeagueData,
  validateLeagueData,
} from '../../src/league/LeagueValidation';

const outputPath = resolve('public/data/league/league-v1.json');
const seed = readArg('--seed') ?? DEFAULT_LEAGUE_SEED;

const data = generateLeagueData({ seed });
const encoded = encodeLeagueData(data);
throwOnLeagueValidationErrors(validateEncodedLeagueData(encoded));
throwOnLeagueValidationErrors(validateLeagueData(data));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(encoded, null, 2)}\n`, 'utf8');

console.log([
  `Wrote ${outputPath}`,
  `schema=${encoded.schemaVersion}`,
  `generator=${encoded.generatorVersion}`,
  `seed=${encoded.seed}`,
  `teams=${encoded.teams.length}`,
  `players=${encoded.rosters.reduce((sum, roster) => sum + roster.players.length, 0)}`,
  `bytes=${estimateEncodedLeagueBytes(encoded)}`,
  `hash=${encoded.contentHash}`,
].join('\n'));

function readArg(name: string): string | null {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}
