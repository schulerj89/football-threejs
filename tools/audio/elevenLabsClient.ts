import type { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

type ElevenLabsModule = typeof import('@elevenlabs/elevenlabs-js');
export type ElevenLabsClientInstance = InstanceType<typeof ElevenLabsClient>;

export async function createElevenLabsClient(apiKey: string): Promise<ElevenLabsClientInstance> {
  const module = await importElevenLabsModule();
  return new module.ElevenLabsClient({ apiKey });
}

async function importElevenLabsModule(): Promise<ElevenLabsModule> {
  try {
    return await import('@elevenlabs/elevenlabs-js');
  } catch (error) {
    if (!isMissingRootApiError(error)) {
      throw error;
    }

    const fallbackModulePath = '@elevenlabs/elevenlabs-js/dist/index.js';
    return await import(fallbackModulePath) as ElevenLabsModule;
  }
}

function isMissingRootApiError(error: unknown): boolean {
  return error instanceof Error && /Cannot find module ['"]\.\/api['"]/.test(error.message);
}
