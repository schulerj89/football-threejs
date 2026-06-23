export function createSettingsSection(title: string, description: string, children: readonly HTMLElement[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'settings-section';
  const header = document.createElement('header');
  const heading = document.createElement('h3');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = description;
  header.append(heading, copy);
  section.append(header, ...children);
  return section;
}
