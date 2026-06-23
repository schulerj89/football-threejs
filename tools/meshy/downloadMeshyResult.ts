import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import { MeshyClient } from './MeshyClient';
import { sanitizeMeshyTaskPayload } from './downloadHelmetCandidate';
import {
  FOOTBALL_PLAYER_CANDIDATE_PLAN,
  assertValidFootballPlayerGenerationPlan,
} from './playerGenerationPlan';
import {
  PLAYER_GENERATED_DIR,
  PLAYER_METADATA_DIR,
  assertCanWritePlayerPath,
  getFileHash,
  getFileSize,
  isDirectCli,
  parsePlayerGenerateOptions,
  readJsonFile,
  requireMeshyApiKey,
  resolveRepoPath,
  selectPlayerCandidates,
  writeBinaryFile,
  writeJsonFile,
  type PlayerDownloadSummary,
  type PlayerGenerateOptions,
  type PlayerMeshyDownloadMetadata,
  type PlayerMeshyTaskMetadata,
} from './schemas';

export async function downloadPlayerCandidates(
  options: PlayerGenerateOptions,
): Promise<PlayerDownloadSummary> {
  assertValidFootballPlayerGenerationPlan();
  const candidates = selectPlayerCandidates(FOOTBALL_PLAYER_CANDIDATE_PLAN, options);
  const downloaded: string[] = [];
  const downloadedThumbnails: string[] = [];
  const missingTasks: string[] = [];
  const skipped: string[] = [];

  if (!options.execute) {
    return {
      downloaded,
      downloadedThumbnails,
      dryRun: true,
      missingTasks,
      skipped: candidates.map((candidate) => candidate.assetId),
    };
  }

  const client = new MeshyClient(requireMeshyApiKey());

  for (const candidate of candidates) {
    const taskMetadataPath = `${PLAYER_METADATA_DIR}/${candidate.assetId}-meshy-task.json`;
    if (!existsSync(resolveRepoPath(taskMetadataPath))) {
      missingTasks.push(candidate.assetId);
      continue;
    }
    if (!options.force && existsSync(resolveRepoPath(candidate.outputPath))) {
      skipped.push(candidate.assetId);
      continue;
    }

    assertCanWritePlayerPath(candidate.outputPath, options.force);
    const taskMetadata = readJsonFile<PlayerMeshyTaskMetadata>(taskMetadataPath);
    const taskResult = await client.waitForTask(taskMetadata.taskId);
    if (!taskResult.modelUrl) {
      throw new Error(`Meshy task ${taskMetadata.taskId} succeeded but did not expose a GLB URL`);
    }

    const model = await client.downloadModel(taskResult.modelUrl);
    writeBinaryFile(candidate.outputPath, model);
    const thumbnailPaths = await downloadThumbnails(client, candidate.assetId, taskResult.thumbnailUrls, options.force);
    downloadedThumbnails.push(...thumbnailPaths);
    writeJsonFile(resolveRepoPath(`${PLAYER_METADATA_DIR}/${candidate.assetId}-download.json`), {
      ...taskMetadata,
      downloadedAt: new Date().toISOString(),
      outputBytes: getFileSize(candidate.outputPath),
      outputHash: getFileHash(candidate.outputPath),
      outputPath: candidate.outputPath,
      taskPayload: sanitizeMeshyTaskPayload(taskResult.raw),
      thumbnailPaths,
    } satisfies PlayerMeshyDownloadMetadata);
    downloaded.push(candidate.assetId);
  }

  return {
    downloaded,
    downloadedThumbnails,
    dryRun: false,
    missingTasks,
    skipped,
  };
}

async function downloadThumbnails(
  client: MeshyClient,
  candidateId: string,
  thumbnailUrls: readonly string[],
  force: boolean,
): Promise<string[]> {
  const paths: string[] = [];
  for (const [index, url] of thumbnailUrls.entries()) {
    const extension = resolveDownloadExtension(url, '.png');
    const outputPath = `${PLAYER_GENERATED_DIR}/${candidateId}-thumbnail-${index + 1}${extension}`;
    if (!force && existsSync(resolveRepoPath(outputPath))) {
      paths.push(outputPath);
      continue;
    }
    assertCanWritePlayerPath(outputPath, force);
    const content = await client.downloadModel(url);
    writeBinaryFile(outputPath, content);
    paths.push(outputPath);
  }
  return paths;
}

function resolveDownloadExtension(url: string, fallback: string): string {
  try {
    const parsed = new URL(url);
    const extension = extname(parsed.pathname).toLowerCase();
    return extension || fallback;
  } catch {
    return fallback;
  }
}

if (isDirectCli(import.meta.url)) {
  const options = parsePlayerGenerateOptions(process.argv.slice(2));
  downloadPlayerCandidates(options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
