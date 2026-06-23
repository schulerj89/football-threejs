export interface SettingRowOptions {
  readonly control: HTMLElement;
  readonly description: string;
  readonly disabledReason?: string;
  readonly label: string;
}

export function createSettingRow({
  control,
  description,
  disabledReason,
  label,
}: SettingRowOptions): HTMLElement {
  const row = document.createElement('label');
  row.className = 'settings-row settings-control-row';
  if (disabledReason) {
    row.dataset.disabledReason = disabledReason;
  }

  const copy = document.createElement('span');
  copy.className = 'settings-row-copy';
  const title = document.createElement('span');
  title.className = 'settings-row-title';
  title.textContent = label;
  const detail = document.createElement('span');
  detail.className = 'settings-row-description';
  detail.textContent = disabledReason ?? description;
  copy.append(title, detail);

  row.append(copy, control);
  return row;
}
