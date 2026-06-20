import type { Vector2 } from './playerModel';

const MOVEMENT_KEYS: Record<string, Vector2> = {
  a: { x: -1, z: 0 },
  arrowleft: { x: -1, z: 0 },
  d: { x: 1, z: 0 },
  arrowright: { x: 1, z: 0 },
  s: { x: 0, z: -1 },
  arrowdown: { x: 0, z: -1 },
  w: { x: 0, z: 1 },
  arrowup: { x: 0, z: 1 },
};

export class KeyboardMovementInput {
  private readonly pressedKeys = new Set<string>();
  private readonly target: Window;

  constructor(target: Window) {
    this.target = target;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.handleBlur);
  }

  getMovement(): Vector2 {
    const rawInput = { x: 0, z: 0 };

    for (const key of this.pressedKeys) {
      const keyInput = MOVEMENT_KEYS[key];
      if (keyInput) {
        rawInput.x += keyInput.x;
        rawInput.z += keyInput.z;
      }
    }

    return normalizeMovementInput(rawInput);
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
    this.pressedKeys.clear();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const key = normalizeKey(event.key);
    if (!MOVEMENT_KEYS[key]) {
      return;
    }

    this.pressedKeys.add(key);
    event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const key = normalizeKey(event.key);
    if (!MOVEMENT_KEYS[key]) {
      return;
    }

    this.pressedKeys.delete(key);
    event.preventDefault();
  };

  private readonly handleBlur = (): void => {
    this.pressedKeys.clear();
  };
}

export function normalizeMovementInput(input: Vector2): Vector2 {
  const length = Math.hypot(input.x, input.z);

  if (length === 0) {
    return { x: 0, z: 0 };
  }

  return {
    x: input.x / length,
    z: input.z / length,
  };
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

