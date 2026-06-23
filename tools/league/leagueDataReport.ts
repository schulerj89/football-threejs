import { gzipSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  decodeLeagueData,
  estimateDecodedLeagueBytes,
  estimateEncodedLeagueBytes,
} from '../../src/league/LeagueDataCodec';
import type { EncodedLeagueData } from '../../src/league/LeagueTypes';
import {
  validateEncodedLeagueData,
  validateLeagueData,
} from '../../src/league/LeagueValidation';

const inputPath = resolve('public/data/league/league-v1.json');
const outputPath = resolve('public/data/league/league-v1-report.json');
const raw = await readFile(inputPath, 'utf8');
const encoded = JSON.parse(raw) as EncodedLeagueData;
const decoded = decodeLeagueData(encoded);
const encodedIssues = validateEncodedLeagueData(encoded);
const decodedIssues = validateLeagueData(decoded);
const playerCount = decoded.rosters.reduce((sum, roster) => sum + roster.players.length, 0);
const report = {
  attributeOrderLength: encoded.rosters[0]?.players[0]?.ratings.length ?? 0,
  contentHash: encoded.contentHash,
  decodedEstimateBytes: estimateDecodedLeagueBytes(decoded),
  encodedBytes: estimateEncodedLeagueBytes(encoded),
  generatorVersion: encoded.generatorVersion,
  gzipBytes: gzipSync(Buffer.from(raw, 'utf8')).byteLength,
  issues: [...encodedIssues, ...decodedIssues],
  oneLeagueRequest: true,
  playerCount,
  schemaVersion: encoded.schemaVersion,
  seed: encoded.seed,
  targetUncompressedBytes: 300 * 1024,
  teamCount: decoded.teams.length,
  totalRosterPlayersByTeam: Object.fromEntries(
    decoded.rosters.map((roster) => [roster.teamId, roster.players.length]),
  ),
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log([
  `Wrote ${outputPath}`,
  `teams=${report.teamCount}`,
  `players=${report.playerCount}`,
  `encodedBytes=${report.encodedBytes}`,
  `gzipBytes=${report.gzipBytes}`,
  `issues=${report.issues.length}`,
].join('\n'));
