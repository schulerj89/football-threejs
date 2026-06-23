import type { MeshyMultiImageTo3DRequest, MeshyRiggingRequest } from './schemas';

const MESHY_API_BASE_URL = 'https://api.meshy.ai/openapi/v1';

export type MeshyTaskStatus =
  | 'CANCELED'
  | 'EXPIRED'
  | 'FAILED'
  | 'IN_PROGRESS'
  | 'PENDING'
  | 'SUCCEEDED'
  | 'UNKNOWN';

export interface MeshyTaskSubmission {
  readonly creditCost: number | null;
  readonly raw: unknown;
  readonly taskId: string;
}

export interface MeshyTaskResult {
  readonly raw: unknown;
  readonly status: MeshyTaskStatus;
  readonly animationUrls: readonly string[];
  readonly fbxUrl: string | null;
  readonly modelUrl: string | null;
  readonly thumbnailUrls: readonly string[];
}

export class MeshyClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = MESHY_API_BASE_URL,
  ) {}

  async createMultiImageTo3DTask(request: MeshyMultiImageTo3DRequest): Promise<MeshyTaskSubmission> {
    const response = await fetch(`${this.baseUrl}/multi-image-to-3d`, {
      body: JSON.stringify(request),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Meshy multi-image-to-3d failed: ${response.status} ${errorBody}`);
    }

    const raw = await response.json() as unknown;
    return {
      creditCost: readNumberPath(raw, ['credit_cost']) ?? readNumberPath(raw, ['result', 'credit_cost']),
      raw,
      taskId: readStringPath(raw, ['result']) ??
        readStringPath(raw, ['id']) ??
        readStringPath(raw, ['task_id']) ??
        readStringPath(raw, ['result', 'id']) ??
        readStringPath(raw, ['result', 'task_id']) ??
        failMissingTaskId(raw),
    };
  }

  async createRiggingTask(request: MeshyRiggingRequest): Promise<MeshyTaskSubmission> {
    const response = await fetch(`${this.baseUrl}/rigging`, {
      body: JSON.stringify(request),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Meshy rigging failed: ${response.status} ${errorBody}`);
    }

    const raw = await response.json() as unknown;
    return {
      creditCost: readNumberPath(raw, ['credit_cost']) ?? readNumberPath(raw, ['result', 'credit_cost']),
      raw,
      taskId: readStringPath(raw, ['result']) ??
        readStringPath(raw, ['id']) ??
        readStringPath(raw, ['task_id']) ??
        readStringPath(raw, ['result', 'id']) ??
        readStringPath(raw, ['result', 'task_id']) ??
        failMissingTaskId(raw),
    };
  }

  async getTask(taskId: string): Promise<MeshyTaskResult> {
    const response = await fetch(`${this.baseUrl}/multi-image-to-3d/${encodeURIComponent(taskId)}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      method: 'GET',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Meshy task lookup failed for ${taskId}: ${response.status} ${errorBody}`);
    }

    const raw = await response.json() as unknown;
    return {
      modelUrl: resolveModelUrl(raw),
      raw,
      status: normalizeTaskStatus(
        readStringPath(raw, ['status']) ??
        readStringPath(raw, ['result', 'status']) ??
        readStringPath(raw, ['task_status']),
      ),
      animationUrls: resolveAnimationUrls(raw),
      fbxUrl: resolveFbxUrl(raw),
      thumbnailUrls: resolveThumbnailUrls(raw),
    };
  }

  async getRiggingTask(taskId: string): Promise<MeshyTaskResult> {
    const response = await fetch(`${this.baseUrl}/rigging/${encodeURIComponent(taskId)}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      method: 'GET',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Meshy rigging task lookup failed for ${taskId}: ${response.status} ${errorBody}`);
    }

    const raw = await response.json() as unknown;
    return {
      animationUrls: resolveAnimationUrls(raw),
      fbxUrl: resolveFbxUrl(raw),
      modelUrl: resolveModelUrl(raw),
      raw,
      status: normalizeTaskStatus(
        readStringPath(raw, ['status']) ??
        readStringPath(raw, ['result', 'status']) ??
        readStringPath(raw, ['task_status']),
      ),
      thumbnailUrls: resolveThumbnailUrls(raw),
    };
  }

  async waitForTask(
    taskId: string,
    options: { pollIntervalMs?: number; timeoutMs?: number } = {},
  ): Promise<MeshyTaskResult> {
    const pollIntervalMs = options.pollIntervalMs ?? 10_000;
    const timeoutMs = options.timeoutMs ?? 20 * 60_000;
    const startedAt = Date.now();

    while (true) {
      const task = await this.getTask(taskId);
      if (task.status === 'SUCCEEDED') {
        return task;
      }
      if (task.status === 'FAILED' || task.status === 'CANCELED' || task.status === 'EXPIRED') {
        throw new Error(`Meshy task ${taskId} ended with status ${task.status}`);
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out waiting for Meshy task ${taskId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  async waitForRiggingTask(
    taskId: string,
    options: { pollIntervalMs?: number; timeoutMs?: number } = {},
  ): Promise<MeshyTaskResult> {
    const pollIntervalMs = options.pollIntervalMs ?? 10_000;
    const timeoutMs = options.timeoutMs ?? 20 * 60_000;
    const startedAt = Date.now();

    while (true) {
      const task = await this.getRiggingTask(taskId);
      if (task.status === 'SUCCEEDED') {
        return task;
      }
      if (task.status === 'FAILED' || task.status === 'CANCELED' || task.status === 'EXPIRED') {
        throw new Error(`Meshy rigging task ${taskId} ended with status ${task.status}`);
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out waiting for Meshy rigging task ${taskId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  async downloadModel(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download Meshy model: ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

function resolveModelUrl(raw: unknown): string | null {
  return readStringPath(raw, ['model_urls', 'glb']) ??
    readStringPath(raw, ['model_urls', 'glb_url']) ??
    readStringPath(raw, ['model_urls', 'rigged_glb']) ??
    readStringPath(raw, ['result', 'model_urls', 'glb']) ??
    readStringPath(raw, ['result', 'model_urls', 'glb_url']) ??
    readStringPath(raw, ['result', 'model_urls', 'rigged_glb']) ??
    readStringPath(raw, ['result', 'rigged_character_glb_url']) ??
    readStringPath(raw, ['output', 'model_urls', 'glb']) ??
    readStringPath(raw, ['output', 'model_urls', 'rigged_glb']) ??
    readStringPath(raw, ['output', 'glb']) ??
    readStringPath(raw, ['output', 'rigged_glb']) ??
    readStringPath(raw, ['model_url']) ??
    null;
}

function resolveFbxUrl(raw: unknown): string | null {
  return readStringPath(raw, ['model_urls', 'fbx']) ??
    readStringPath(raw, ['model_urls', 'rigged_fbx']) ??
    readStringPath(raw, ['result', 'model_urls', 'fbx']) ??
    readStringPath(raw, ['result', 'model_urls', 'rigged_fbx']) ??
    readStringPath(raw, ['result', 'rigged_character_fbx_url']) ??
    readStringPath(raw, ['output', 'model_urls', 'fbx']) ??
    readStringPath(raw, ['output', 'model_urls', 'rigged_fbx']) ??
    readStringPath(raw, ['output', 'fbx']) ??
    readStringPath(raw, ['output', 'rigged_fbx']) ??
    readStringPath(raw, ['fbx_url']) ??
    null;
}

function resolveThumbnailUrls(raw: unknown): readonly string[] {
  return readStringArrayPath(raw, ['thumbnail_urls']) ??
    readStringArrayPath(raw, ['result', 'thumbnail_urls']) ??
    readStringArrayPath(raw, ['output', 'thumbnail_urls']) ??
    [];
}

function resolveAnimationUrls(raw: unknown): readonly string[] {
  const direct = readStringArrayPath(raw, ['animation_urls']) ??
    readStringArrayPath(raw, ['result', 'animation_urls']) ??
    readStringArrayPath(raw, ['result', 'basic_animations']) ??
    readStringArrayPath(raw, ['output', 'animation_urls']);
  if (direct) {
    return direct;
  }

  const objectValue = readPath(raw, ['animation_urls']) ??
    readPath(raw, ['result', 'animation_urls']) ??
    readPath(raw, ['result', 'basic_animations']) ??
    readPath(raw, ['output', 'animation_urls']);
  if (objectValue && typeof objectValue === 'object' && !Array.isArray(objectValue)) {
    return Object.values(objectValue)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  }

  return [];
}

function normalizeTaskStatus(status: string | null | undefined): MeshyTaskStatus {
  const normalized = status?.toUpperCase();
  if (
    normalized === 'CANCELED' ||
    normalized === 'EXPIRED' ||
    normalized === 'FAILED' ||
    normalized === 'IN_PROGRESS' ||
    normalized === 'PENDING' ||
    normalized === 'SUCCEEDED'
  ) {
    return normalized;
  }
  return 'UNKNOWN';
}

function readStringPath(value: unknown, path: readonly string[]): string | null {
  const found = readPath(value, path);
  return typeof found === 'string' && found.trim() ? found : null;
}

function readNumberPath(value: unknown, path: readonly string[]): number | null {
  const found = readPath(value, path);
  return typeof found === 'number' && Number.isFinite(found) ? found : null;
}

function readStringArrayPath(value: unknown, path: readonly string[]): string[] | null {
  const found = readPath(value, path);
  if (!Array.isArray(found)) {
    return null;
  }
  const strings = found.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return strings.length > 0 ? strings : null;
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function failMissingTaskId(raw: unknown): never {
  throw new Error(`Meshy task creation response did not include a task ID: ${JSON.stringify(raw)}`);
}
