import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import { MeshyClient } from './MeshyClient';
import { sanitizeMeshyTaskPayload } from './downloadHelmetCandidate';
import {
  FOOTBALL_PLAYER_CANDIDATE_PLAN,
  assertValidFootballPlayerGenerationPlan,
} from './playerGenerationPlan';
import {
  PLAYER_METADATA_DIR,
  PLAYER_RIGGED_DIR,
  assertCanWritePlayerPath,
  getFileHash,
  getFileSize,
  isDirectCli,
  parsePlayerGenerateOptions,
  readJsonFile,
  requireMeshyApiKey,
  resolveRepoPath,
  selectPlayerCandidates,
  toDataUri,
  withSingleRetry,
  writeBinaryFile,
  writeJsonFile,
  type MeshyRiggingRequest,
  type PlayerGenerateOptions,
  type PlayerMeshyTaskMetadata,
  type PlayerRigSummary,
  type PlayerRiggingDownloadMetadata,
  type PlayerRiggingTaskMetadata,
} from './schemas';
import {
  normalizePlayerGlbTextureBudget,
  validateGeneratedPlayerCandidate,
  validateRiggedPlayerCandidate,
} from './playerAssetReport';

const PLAYER_RIG_HEIGHT_METERS = 1.85;

export async function rigPlayerCandidates(
  options: PlayerGenerateOptions,
): Promise<PlayerRigSummary> {
  assertValidFootballPlayerGenerationPlan();
  const candidates = selectPlayerCandidates(FOOTBALL_PLAYER_CANDIDATE_PLAN, options);
  const missingCandidates: string[] = [];
  const rigged: string[] = [];
  const skipped: string[] = [];
  const submitted: string[] = [];

  if (!options.execute) {
    return {
      dryRun: true,
      missingCandidates,
      rigged,
      skipped: candidates.map((candidate) => candidate.assetId),
      submitted,
    };
  }

  const client = new MeshyClient(requireMeshyApiKey());

  for (const candidate of candidates) {
    if (!existsSync(resolveRepoPath(candidate.outputPath))) {
      missingCandidates.push(candidate.assetId);
      continue;
    }
    if (!options.force && existsSync(resolveRepoPath(candidate.riggedGlbOutputPath))) {
      skipped.push(candidate.assetId);
      continue;
    }

    const generatedValidation = validateGeneratedPlayerCandidate(candidate.outputPath);
    const geometryFailures = generatedValidation.failures.filter((failure) => !/^Texture .* above 1024x1024\.$/.test(failure));
    if (geometryFailures.length > 0) {
      throw new Error(`${candidate.assetId}: generated candidate failed validation before rigging:\n${generatedValidation.failures.join('\n')}`);
    }

    assertCanWritePlayerPath(candidate.riggedGlbOutputPath, options.force);
    const rigTaskMetadataPath = `${PLAYER_METADATA_DIR}/${candidate.assetId}-rigging-task.json`;
    const rigTask = existsSync(resolveRepoPath(rigTaskMetadataPath)) && !options.force
      ? readJsonFile<PlayerRiggingTaskMetadata>(rigTaskMetadataPath)
      : await submitRiggingTask(client, candidate.assetId, candidate.outputPath, options.retryCount);

    if (!existsSync(resolveRepoPath(rigTaskMetadataPath)) || options.force) {
      writeJsonFile(resolveRepoPath(rigTaskMetadataPath), rigTask);
      submitted.push(candidate.assetId);
    }

    const taskResult = await client.waitForRiggingTask(rigTask.taskId);
    if (!taskResult.modelUrl) {
      throw new Error(`Meshy rigging task ${rigTask.taskId} succeeded but did not expose a rigged GLB URL`);
    }

    const glb = await client.downloadModel(taskResult.modelUrl);
    writeBinaryFile(candidate.riggedGlbOutputPath, glb);
    normalizePlayerGlbTextureBudget(candidate.riggedGlbOutputPath);
    const fbxOutputPath = taskResult.fbxUrl ? candidate.riggedFbxOutputPath : null;
    if (taskResult.fbxUrl && fbxOutputPath) {
      assertCanWritePlayerPath(fbxOutputPath, options.force);
      writeBinaryFile(fbxOutputPath, await client.downloadModel(taskResult.fbxUrl));
    }
    const animationPaths = await downloadAnimations(client, candidate.assetId, taskResult.animationUrls, options.force);
    const riggedValidation = validateRiggedPlayerCandidate(candidate.riggedGlbOutputPath);
    if (!riggedValidation.passed) {
      throw new Error(`${candidate.assetId}: rigged candidate failed validation:\n${riggedValidation.failures.join('\n')}`);
    }

    writeJsonFile(resolveRepoPath(`${PLAYER_METADATA_DIR}/${candidate.assetId}-rigging-download.json`), {
      ...rigTask,
      animationPaths,
      downloadedAt: new Date().toISOString(),
      fbxOutputBytes: fbxOutputPath ? getFileSize(fbxOutputPath) : null,
      fbxOutputHash: fbxOutputPath ? getFileHash(fbxOutputPath) : null,
      fbxOutputPath,
      glbOutputBytes: getFileSize(candidate.riggedGlbOutputPath),
      glbOutputHash: getFileHash(candidate.riggedGlbOutputPath),
      glbOutputPath: candidate.riggedGlbOutputPath,
      taskPayload: sanitizeMeshyTaskPayload(taskResult.raw),
    } satisfies PlayerRiggingDownloadMetadata);
    rigged.push(candidate.assetId);
  }

  return {
    dryRun: false,
    missingCandidates,
    rigged,
    skipped,
    submitted,
  };
}

async function submitRiggingTask(
  client: MeshyClient,
  candidateId: string,
  generatedGlbPath: string,
  retryCount: number,
): Promise<PlayerRiggingTaskMetadata> {
  const sourceTaskPath = `${PLAYER_METADATA_DIR}/${candidateId}-meshy-task.json`;
  const sourceTask = existsSync(resolveRepoPath(sourceTaskPath))
    ? readJsonFile<PlayerMeshyTaskMetadata>(sourceTaskPath)
    : null;
  const request: MeshyRiggingRequest = sourceTask
    ? {
        height_meters: PLAYER_RIG_HEIGHT_METERS,
        input_task_id: sourceTask.taskId,
      }
    : {
        height_meters: PLAYER_RIG_HEIGHT_METERS,
        model_url: toDataUri(generatedGlbPath, 'model/gltf-binary'),
      };
  const task = await withSingleRetry(retryCount, () => client.createRiggingTask(request));
  return {
    candidateId: candidateId as PlayerRiggingTaskMetadata['candidateId'],
    createdAt: new Date().toISOString(),
    creditCost: task.creditCost,
    generatedGlbHash: getFileHash(generatedGlbPath),
    generatedGlbPath,
    riggingRequest: request,
    taskId: task.taskId,
  };
}

async function downloadAnimations(
  client: MeshyClient,
  candidateId: string,
  animationUrls: readonly string[],
  force: boolean,
): Promise<string[]> {
  const paths: string[] = [];
  for (const [index, url] of animationUrls.entries()) {
    const extension = resolveDownloadExtension(url, '.glb');
    const outputPath = `${PLAYER_RIGGED_DIR}/${candidateId}-animation-${index + 1}${extension}`;
    if (!force && existsSync(resolveRepoPath(outputPath))) {
      paths.push(outputPath);
      continue;
    }
    assertCanWritePlayerPath(outputPath, force);
    writeBinaryFile(outputPath, await client.downloadModel(url));
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
  rigPlayerCandidates(options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
