import {
  SETTINGS_CATEGORY_LABELS,
  SETTINGS_CATEGORY_ORDER,
  type SettingsCategoryId,
} from './SettingsTypes';

export interface SettingsNavigationOptions {
  readonly activeCategory: SettingsCategoryId;
  readonly onSelect: (category: SettingsCategoryId) => void;
}

export function createSettingsNavigation({
  activeCategory,
  onSelect,
}: SettingsNavigationOptions): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'settings-navigation';
  nav.setAttribute('aria-label', 'Settings categories');
  for (const category of SETTINGS_CATEGORY_ORDER) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = SETTINGS_CATEGORY_LABELS[category];
    button.dataset.active = String(category === activeCategory);
    button.setAttribute('aria-current', category === activeCategory ? 'page' : 'false');
    button.addEventListener('click', () => onSelect(category));
    nav.append(button);
  }
  return nav;
}
