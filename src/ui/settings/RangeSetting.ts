import { createSettingRow } from './SettingRow';

export interface RangeSettingOptions {
  readonly description: string;
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly value: number;
}

export function createRangeSetting({
  description,
  label,
  onChange,
  value,
}: RangeSettingOptions): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-range-control';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.01';
  input.value = String(value);
  input.setAttribute('aria-label', label);
  const output = document.createElement('output');
  output.textContent = formatPercent(value);
  input.addEventListener('input', () => {
    const next = Number(input.value);
    output.textContent = formatPercent(next);
    onChange(next);
  });
  wrapper.append(input, output);

  return createSettingRow({
    control: wrapper,
    description,
    label,
  });
}

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}
