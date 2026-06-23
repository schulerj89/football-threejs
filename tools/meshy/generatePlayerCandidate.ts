import { existsSync, readFileSync } from 'node:fs';
import { MeshyClient } from './MeshyClient';
import {
  FOOTBALL_PLAYER_CANDIDATE_PLAN,
  FOOTBALL_PLAYER_REFERENCE_PLAN,
  assertValidFootballPlayerGenerationPlan,
} from './playerGenerationPlan';
import {
  PLAYER_METADATA_DIR,
  assertCanWritePlayerPath,
  getFileHash,
  isDirectCli,
  parsePlayerGenerateOptions,
  playerReferenceOutputExists,
  requireMeshyApiKey,
  resolveRepoPath,
  selectPlayerCandidates,
  toDataUri,
  withSingleRetry,
  writeBinaryFile,
  writeJsonFile,
  writePlayerReferenceProvenance,
  type MeshyMultiImageTo3DRequest,
  type PlayerCandidatePlan,
  type PlayerGenerateOptions,
  type PlayerGenerateSummary,
  type PlayerMeshyTaskMetadata,
  type PlayerReferenceImagePlan,
} from './schemas';
import { requireOpenAIApiKey } from '../branding/schemas';

interface OpenAIImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
}

export interface PlayerReferenceGenerationResult {
  readonly content: Uint8Array;
  readonly revisedPrompt: string | null;
}

export interface PlayerCandidateGenerationDependencies {
  readonly createMeshyTask?: (
    request: MeshyMultiImageTo3DRequest,
    apiKey: string,
  ) => Promise<{ creditCost: number | null; taskId: string }>;
  readonly requestReferenceImage?: (
    asset: PlayerReferenceImagePlan,
    apiKey: string,
    referenceImage?: Uint8Array,
  ) => Promise<PlayerReferenceGenerationResult>;
}

export async function generatePlayerCandidates(
  options: PlayerGenerateOptions,
  dependencies: PlayerCandidateGenerationDependencies = {},
): Promise<PlayerGenerateSummary> {
  assertValidFootballPlayerGenerationPlan();
  const selectedCandidates = selectPlayerCandidates(FOOTBALL_PLAYER_CANDIDATE_PLAN, options);
  const selectedReferences = FOOTBALL_PLAYER_REFERENCE_PLAN.filter((reference) =>
    selectedCandidates.some((candidate) => candidate.assetId === reference.candidateId),
  );

  if (!options.execute) {
    return {
      dryRun: true,
      generatedReferences: [],
      skippedCandidates: selectedCandidates.map((candidate) => candidate.assetId),
      skippedReferences: selectedReferences.map((reference) => reference.assetId),
      submittedCandidates: [],
    };
  }

  const openAiApiKey = requireOpenAIApiKey();
  const meshyApiKey = requireMeshyApiKey();
  const requestReferenceImage = dependencies.requestReferenceImage ?? requestOpenAIPlayerReferenceImage;
  const createMeshyTask = dependencies.createMeshyTask ?? createMeshyTaskFromRequest;
  const generatedReferences: string[] = [];
  const skippedReferences: string[] = [];
  const submittedCandidates: string[] = [];
  const skippedCandidates: string[] = [];

  for (const candidate of selectedCandidates) {
    const candidateReferences = selectedReferences.filter((reference) => reference.candidateId === candidate.assetId);
    const frontReference = candidateReferences.find((reference) => reference.view === 'front');
    for (const reference of candidateReferences) {
      if (!options.force && playerReferenceOutputExists(reference)) {
        skippedReferences.push(reference.assetId);
        continue;
      }
      assertCanWritePlayerPath(reference.outputPath, options.force);
      assertCanWritePlayerPath(`${reference.outputPath}.json`, options.force);
      const referenceImage = reference.view !== 'front' && frontReference
        ? readReferenceImage(frontReference)
        : undefined;
      const result = await withSingleRetry(
        options.retryCount,
        () => requestReferenceImage(reference, openAiApiKey, referenceImage),
      );
      writeBinaryFile(reference.outputPath, result.content);
      writePlayerReferenceProvenance(reference, result.content, {
        revisedPrompt: result.revisedPrompt,
      });
      generatedReferences.push(reference.assetId);
    }

    const taskMetadataPath = getCandidateTaskMetadataPath(candidate);
    if (!options.force && existsSync(resolveRepoPath(taskMetadataPath))) {
      skippedCandidates.push(candidate.assetId);
      continue;
    }
    assertCanWritePlayerPath(taskMetadataPath, options.force);

    const request = createMeshyPlayerRequest(candidate, candidateReferences);
    const task = await withSingleRetry(
      options.retryCount,
      () => createMeshyTask(request, meshyApiKey),
    );
    writeJsonFile(resolveRepoPath(taskMetadataPath), {
      candidateId: candidate.assetId,
      createdAt: new Date().toISOString(),
      creditCost: task.creditCost,
      generationRequest: {
        ...request,
        image_urls: candidateReferences.map((reference) => reference.outputPath),
      },
      referenceImageHashes: createReferenceRecord(
        candidateReferences,
        (reference) => getFileHash(reference.outputPath),
      ),
      referenceImagePaths: createReferenceRecord(
        candidateReferences,
        (reference) => reference.outputPath,
      ),
      taskId: task.taskId,
    } satisfies PlayerMeshyTaskMetadata);
    submittedCandidates.push(candidate.assetId);
  }

  return {
    dryRun: false,
    generatedReferences,
    skippedCandidates,
    skippedReferences,
    submittedCandidates,
  };
}

export function createMeshyPlayerRequest(
  candidate: PlayerCandidatePlan,
  references: readonly PlayerReferenceImagePlan[],
): MeshyMultiImageTo3DRequest {
  const orderedReferences = ['front', 'right', 'back', 'left']
    .map((view) => references.find((reference) => reference.view === view))
    .filter((reference): reference is PlayerReferenceImagePlan => Boolean(reference));

  if (orderedReferences.length !== 4) {
    throw new Error(`${candidate.assetId}: all four reference views must exist before Meshy submission`);
  }

  for (const reference of orderedReferences) {
    if (!existsSync(resolveRepoPath(reference.outputPath))) {
      throw new Error(`${candidate.assetId}: missing generated reference ${reference.outputPath}`);
    }
  }

  return {
    ai_model: candidate.aiModel,
    auto_size: candidate.autoSize,
    enable_pbr: candidate.enablePbr,
    hd_texture: candidate.hdTexture,
    image_enhancement: candidate.imageEnhancement,
    image_urls: orderedReferences.map((reference) => toDataUri(reference.outputPath, 'image/png')),
    multi_view_thumbnails: candidate.multiViewThumbnails,
    origin_at: candidate.originAt,
    pose_mode: candidate.poseMode,
    remove_lighting: candidate.removeLighting,
    save_pre_remeshed_model: false,
    should_remesh: candidate.shouldRemesh,
    should_texture: candidate.shouldTexture,
    target_formats: candidate.targetFormats,
    target_polycount: candidate.targetPolycount,
    texture_prompt: candidate.texturePrompt,
    topology: candidate.topology,
  };
}

function getCandidateTaskMetadataPath(candidate: PlayerCandidatePlan): string {
  return `${PLAYER_METADATA_DIR}/${candidate.assetId}-meshy-task.json`;
}

function createReferenceRecord(
  references: readonly PlayerReferenceImagePlan[],
  getValue: (reference: PlayerReferenceImagePlan) => string,
): Record<PlayerReferenceImagePlan['view'], string> {
  const record = {} as Record<PlayerReferenceImagePlan['view'], string>;

  for (const view of ['front', 'right', 'back', 'left'] as const) {
    const reference = references.find((candidate) => candidate.view === view);
    if (!reference) {
      throw new Error(`Missing ${view} reference`);
    }
    record[view] = getValue(reference);
  }

  return record;
}

function readReferenceImage(reference: PlayerReferenceImagePlan): Uint8Array | undefined {
  const absolutePath = resolveRepoPath(reference.outputPath);
  return existsSync(absolutePath) ? readFileSync(absolutePath) : undefined;
}

async function createMeshyTaskFromRequest(
  request: MeshyMultiImageTo3DRequest,
  apiKey: string,
): Promise<{ creditCost: number | null; taskId: string }> {
  const client = new MeshyClient(apiKey);
  return client.createMultiImageTo3DTask(request);
}

async function requestOpenAIPlayerReferenceImage(
  asset: PlayerReferenceImagePlan,
  apiKey: string,
  referenceImage?: Uint8Array,
): Promise<PlayerReferenceGenerationResult> {
  if (referenceImage) {
    try {
      return await requestOpenAIImageEdit(asset, apiKey, referenceImage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/unsupported|not supported|400|404/i.test(message)) {
        throw error;
      }
    }
  }
  return requestOpenAIImageGeneration(asset, apiKey);
}

async function requestOpenAIImageGeneration(
  asset: PlayerReferenceImagePlan,
  apiKey: string,
): Promise<PlayerReferenceGenerationResult> {
  const body = {
    background: 'opaque',
    model: asset.model,
    n: 1,
    output_format: asset.outputFormat,
    prompt: asset.prompt,
    quality: asset.quality,
    size: asset.requestedSize,
  };
  return postOpenAIImageRequest(
    'https://api.openai.com/v1/images/generations',
    apiKey,
    body,
    asset.assetId,
  );
}

async function requestOpenAIImageEdit(
  asset: PlayerReferenceImagePlan,
  apiKey: string,
  referenceImage: Uint8Array,
): Promise<PlayerReferenceGenerationResult> {
  const form = new FormData();
  form.set('background', 'opaque');
  form.set('model', asset.model);
  form.set('n', '1');
  form.set('output_format', asset.outputFormat);
  form.set('prompt', asset.prompt);
  form.set('quality', asset.quality);
  form.set('size', asset.requestedSize);
  form.set(
    'image',
    new Blob([new Uint8Array(referenceImage)], { type: 'image/png' }),
    `${asset.candidateId}-front-reference.png`,
  );

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    body: form,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI image edit failed for ${asset.assetId}: ${response.status} ${errorBody}`);
  }

  return readOpenAIImageResponse(response, asset.assetId);
}

async function postOpenAIImageRequest(
  url: string,
  apiKey: string,
  body: unknown,
  assetId: string,
): Promise<PlayerReferenceGenerationResult> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI image generation failed for ${assetId}: ${response.status} ${errorBody}`);
  }

  return readOpenAIImageResponse(response, assetId);
}

async function readOpenAIImageResponse(
  response: Response,
  assetId: string,
): Promise<PlayerReferenceGenerationResult> {
  const payload = await response.json() as OpenAIImageGenerationResponse;
  const image = payload.data?.[0];

  if (image?.b64_json) {
    return {
      content: Buffer.from(image.b64_json, 'base64'),
      revisedPrompt: image.revised_prompt ?? null,
    };
  }
  if (image?.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`OpenAI image download failed for ${assetId}: ${imageResponse.status}`);
    }
    return {
      content: new Uint8Array(await imageResponse.arrayBuffer()),
      revisedPrompt: image.revised_prompt ?? null,
    };
  }

  throw new Error(`OpenAI image generation returned no image data for ${assetId}`);
}

if (isDirectCli(import.meta.url)) {
  const options = parsePlayerGenerateOptions(process.argv.slice(2));
  generatePlayerCandidates(options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
