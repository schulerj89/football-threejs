import type {
  AudioMixer,
  AudioPlaybackHandle,
} from './AudioMixer';
import type { PreSnapCadenceCueKind } from '../gameplay/PreSnapCadenceModel';

interface ActiveCadenceCue {
  assetId: string;
  handle: AudioPlaybackHandle | null;
  kind: PreSnapCadenceCueKind;
  token: number;
}

export interface CadenceAudioSnapshot {
  activeAssetId: string | null;
  activeKind: PreSnapCadenceCueKind | null;
  completedCueIds: readonly string[];
}

export class CadenceAudioDirector {
  private activeCue: ActiveCadenceCue | null = null;
  private readonly completedCueIds = new Set<string>();
  private token = 0;

  constructor(private readonly mixer: Pick<AudioMixer, 'playOneShotTracked'>) {}

  playCue(kind: PreSnapCadenceCueKind, assetId: string): void {
    if (!assetId) {
      return;
    }

    this.stopActiveCue(0.025);
    const token = ++this.token;
    const cue: ActiveCadenceCue = {
      assetId,
      handle: null,
      kind,
      token,
    };
    this.activeCue = cue;

    void this.mixer.playOneShotTracked(assetId)
      .then((handle) => {
        if (this.activeCue?.token !== token) {
          handle?.stop(0.025);
          return;
        }

        cue.handle = handle;
        if (!handle) {
          return;
        }

        void handle.ended.then(() => {
          if (this.activeCue?.token === token) {
            this.completedCueIds.add(createCueKey(kind, assetId));
            this.activeCue = null;
          }
        });
      })
      .catch(() => {
        if (this.activeCue?.token === token) {
          this.activeCue = null;
        }
      });
  }

  consumeCompletion(kind: PreSnapCadenceCueKind, assetId: string | null): boolean {
    if (!assetId) {
      return false;
    }

    const key = createCueKey(kind, assetId);
    const completed = this.completedCueIds.has(key);
    if (completed) {
      this.completedCueIds.delete(key);
    }
    return completed;
  }

  reset(): void {
    this.stopActiveCue(0.025);
    this.completedCueIds.clear();
  }

  getSnapshot(): CadenceAudioSnapshot {
    return {
      activeAssetId: this.activeCue?.assetId ?? null,
      activeKind: this.activeCue?.kind ?? null,
      completedCueIds: [...this.completedCueIds],
    };
  }

  private stopActiveCue(fadeSeconds: number): void {
    this.activeCue?.handle?.stop(fadeSeconds);
    this.activeCue = null;
    this.token += 1;
  }
}

function createCueKey(kind: PreSnapCadenceCueKind, assetId: string): string {
  return `${kind}:${assetId}`;
}
