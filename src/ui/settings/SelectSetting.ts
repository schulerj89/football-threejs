import { createSettingRow } from './SettingRow';
import type { SettingsOption } from './SettingsTypes';

export interface SelectSettingOptions<TValue extends string> {
  readonly description: string;
  readonly disabledReason?: string;
  readonly label: string;
  readonly onChange: (value: TValue) => void;
  readonly options: readonly SettingsOption<TValue>[];
  readonly value: TValue;
}

export function createSelectSetting<TValue extends string>({
  description,
  disabledReason,
  label,
  onChange,
  options,
  value,
}: SelectSettingOptions<TValue>): HTMLElement {
  const select = document.createElement('select');
  select.setAttribute('aria-label', label);
  select.disabled = Boolean(disabledReason);
  for (const optionData of options) {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.append(option);
  }
  select.value = value;
  select.addEventListener('change', () => onChange(select.value as TValue));

  return createSettingRow({
    control: select,
    description,
    disabledReason,
    label,
  });
}
