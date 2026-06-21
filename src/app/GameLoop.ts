export interface GameLoopOptions {
  onFrame: (deltaSeconds: number) => void;
  now?: () => number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
  maxDeltaSeconds?: number;
}

export class GameLoop {
  private readonly cancelFrame: (handle: number) => void;
  private readonly maxDeltaSeconds: number;
  private readonly now: () => number;
  private readonly onFrame: (deltaSeconds: number) => void;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private frameHandle: number | null = null;
  private previousFrameTime = 0;
  private running = false;

  constructor({
    cancelFrame = window.cancelAnimationFrame.bind(window),
    maxDeltaSeconds = 0.1,
    now = performance.now.bind(performance),
    onFrame,
    requestFrame = window.requestAnimationFrame.bind(window),
  }: GameLoopOptions) {
    this.cancelFrame = cancelFrame;
    this.maxDeltaSeconds = maxDeltaSeconds;
    this.now = now;
    this.onFrame = onFrame;
    this.requestFrame = requestFrame;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.previousFrameTime = this.now();
    this.onFrame(0);
    this.frameHandle = this.requestFrame(this.tick);
  }

  pause(): void {
    if (this.frameHandle !== null) {
      this.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.running = false;
  }

  dispose(): void {
    this.pause();
  }

  private readonly tick = (): void => {
    if (!this.running) {
      return;
    }

    const now = this.now();
    const delta = Math.min((now - this.previousFrameTime) / 1000, this.maxDeltaSeconds);
    this.previousFrameTime = now;
    this.onFrame(delta);
    this.frameHandle = this.requestFrame(this.tick);
  };
}
