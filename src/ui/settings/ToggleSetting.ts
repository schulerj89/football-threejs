import { createSettingRow } from './SettingRow';

export interface ToggleSettingOptions {
  readonly checked: boolean;
  readonly description: string;
  readonly disabledReason?: string;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}

export function createToggleSetting({
  checked,
  description,
  disabledReason,
  label,
  onChange,
}: ToggleSettingOptions): HTMLElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.disabled = Boolean(disabledReason);
  input.setAttribute('aria-label', label);
  input.addEventListener('change', () => onChange(input.checked));

  return createSettingRow({
    control: input,
    description,
    disabledReason,
    label,
  });
}
