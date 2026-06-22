export interface DisposableDebugFeature {
  dispose(): void;
}

export interface DebugFeature {
  create(): DisposableDebugFeature;
  description?: string;
  enabled: boolean;
  id: string;
  label: string;
}

export interface DebugFeatureSnapshot {
  description?: string;
  enabled: boolean;
  id: string;
  label: string;
}

type Listener = () => void;

interface RegisteredDebugFeature {
  definition: DebugFeature;
  instance: DisposableDebugFeature | null;
}

export class DebugFeatureRegistry {
  private readonly features = new Map<string, RegisteredDebugFeature>();
  private readonly listeners = new Set<Listener>();

  register(feature: DebugFeature): void {
    if (this.features.has(feature.id)) {
      throw new Error(`Duplicate debug feature ${feature.id}`);
    }

    const registered: RegisteredDebugFeature = {
      definition: { ...feature },
      instance: null,
    };
    this.features.set(feature.id, registered);
    if (feature.enabled) {
      this.activate(registered);
    }
    this.emitChange();
  }

  getSnapshots(): DebugFeatureSnapshot[] {
    return [...this.features.values()]
      .map(({ definition }) => ({
        ...(definition.description ? { description: definition.description } : {}),
        enabled: definition.enabled,
        id: definition.id,
        label: definition.label,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  isEnabled(id: string): boolean {
    return this.features.get(id)?.definition.enabled ?? false;
  }

  setEnabled(id: string, enabled: boolean): void {
    const registered = this.features.get(id);
    if (!registered || registered.definition.enabled === enabled) {
      return;
    }

    registered.definition.enabled = enabled;
    if (enabled) {
      this.activate(registered);
    } else {
      registered.instance?.dispose();
      registered.instance = null;
    }
    this.emitChange();
  }

  setManyEnabled(ids: readonly string[], enabled: boolean): void {
    for (const id of ids) {
      this.setEnabled(id, enabled);
    }
  }

  disableAll(): void {
    for (const id of this.features.keys()) {
      this.setEnabled(id, false);
    }
  }

  toggle(id: string): void {
    this.setEnabled(id, !this.isEnabled(id));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    for (const registered of this.features.values()) {
      registered.instance?.dispose();
      registered.instance = null;
      registered.definition.enabled = false;
    }
    this.listeners.clear();
  }

  private activate(registered: RegisteredDebugFeature): void {
    if (!registered.instance) {
      registered.instance = registered.definition.create();
    }
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
