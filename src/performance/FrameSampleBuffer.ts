export interface FrameSampleBufferSnapshot {
  count: number;
  frameDurationsMs: number[];
  phaseDurationsMs: number[][];
  timestampsMs: number[];
  totalRecorded: number;
}

export class FrameSampleBuffer {
  private readonly frameDurationsMs: Float64Array;
  private readonly phaseDurationsMs: Float64Array[];
  private readonly timestampsMs: Float64Array;
  private count = 0;
  private totalRecorded = 0;
  private writeIndex = 0;

  constructor(
    readonly capacity: number,
    readonly phaseCount: number,
  ) {
    this.frameDurationsMs = new Float64Array(capacity);
    this.timestampsMs = new Float64Array(capacity);
    this.phaseDurationsMs = Array.from(
      { length: phaseCount },
      () => new Float64Array(capacity),
    );
  }

  clear(): void {
    this.count = 0;
    this.totalRecorded = 0;
    this.writeIndex = 0;
  }

  recordFrame(
    timestampMs: number,
    frameDurationMs: number,
    phaseDurationsMs: Float64Array,
  ): void {
    const index = this.writeIndex;
    this.timestampsMs[index] = timestampMs;
    this.frameDurationsMs[index] = frameDurationMs;

    for (let phaseIndex = 0; phaseIndex < this.phaseCount; phaseIndex += 1) {
      this.phaseDurationsMs[phaseIndex][index] = phaseDurationsMs[phaseIndex] ?? 0;
    }

    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.count = Math.min(this.capacity, this.count + 1);
    this.totalRecorded += 1;
  }

  getCount(): number {
    return this.count;
  }

  getTotalRecorded(): number {
    return this.totalRecorded;
  }

  getFrameDurations(): number[] {
    return this.copyOrderedValues(this.frameDurationsMs);
  }

  getTimestamps(): number[] {
    return this.copyOrderedValues(this.timestampsMs);
  }

  getPhaseDurations(phaseIndex: number): number[] {
    return this.copyOrderedValues(this.phaseDurationsMs[phaseIndex]);
  }

  getSnapshot(): FrameSampleBufferSnapshot {
    return {
      count: this.count,
      frameDurationsMs: this.getFrameDurations(),
      phaseDurationsMs: this.phaseDurationsMs.map((_, index) => this.getPhaseDurations(index)),
      timestampsMs: this.getTimestamps(),
      totalRecorded: this.totalRecorded,
    };
  }

  private copyOrderedValues(values: Float64Array): number[] {
    if (this.count === 0) {
      return [];
    }

    const output = new Array<number>(this.count);
    const startIndex = this.count === this.capacity ? this.writeIndex : 0;

    for (let index = 0; index < this.count; index += 1) {
      output[index] = values[(startIndex + index) % this.capacity];
    }

    return output;
  }
}
