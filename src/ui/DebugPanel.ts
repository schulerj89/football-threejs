import type { DebugFeatureRegistry } from './DebugFeatureRegistry';

export interface DebugPanelOptions {
  registry: DebugFeatureRegistry;
}

export class DebugPanel {
  readonly root = document.createElement('aside');

  private readonly featureList = document.createElement('div');
  private readonly unsubscribe: () => void;

  constructor(private readonly options: DebugPanelOptions) {
    this.root.className = 'debug-panel';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Debug tools');

    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.textContent = 'Debug Tools';
    const hint = document.createElement('p');
    hint.textContent = 'F1 toggles this panel.';
    header.append(title, hint);

    this.featureList.className = 'debug-feature-list';
    this.root.append(header, this.featureList);
    document.body.append(this.root);

    this.unsubscribe = options.registry.subscribe(() => this.render());
    this.render();
  }

  isVisible(): boolean {
    return !this.root.hidden;
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  toggleVisible(): void {
    this.setVisible(!this.isVisible());
  }

  dispose(): void {
    this.unsubscribe();
    this.root.remove();
  }

  private render(): void {
    this.featureList.replaceChildren(
      ...this.options.registry.getSnapshots().map((feature) => {
        const label = document.createElement('label');
        label.className = 'debug-feature-row';
        if (feature.description) {
          label.title = feature.description;
        }
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = feature.enabled;
        input.addEventListener('change', () => {
          this.options.registry.setEnabled(feature.id, input.checked);
        });
        const span = document.createElement('span');
        span.textContent = feature.label;
        label.append(input, span);
        return label;
      }),
    );
  }
}
