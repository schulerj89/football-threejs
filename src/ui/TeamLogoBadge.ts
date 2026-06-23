import type { TeamProfile } from '../teams/TeamProfile';
import { getReadableTextColor } from '../teams/TeamThemeApplier';

export interface TeamLogoBadge {
  readonly root: HTMLDivElement;
  sync: (profile: TeamProfile) => void;
}

export function createTeamLogoBadge(profile: TeamProfile, className = 'team-logo-badge'): TeamLogoBadge {
  const root = document.createElement('div');
  const image = document.createElement('img');
  const fallback = document.createElement('span');
  let currentLogoUrl: string | null = null;

  root.className = className;
  image.alt = '';
  image.decoding = 'async';
  fallback.className = 'team-logo-badge-fallback';
  root.append(image, fallback);

  function sync(nextProfile: TeamProfile): void {
    root.dataset.teamId = nextProfile.id;
    root.style.setProperty('--team-logo-primary', nextProfile.colors.primary);
    root.style.setProperty('--team-logo-secondary', nextProfile.colors.secondary);
    root.style.setProperty('--team-logo-text', getReadableTextColor(nextProfile.colors.primary));
    root.setAttribute('aria-label', `${nextProfile.displayName} logo`);
    fallback.textContent = nextProfile.abbreviation;
    const nextLogoUrl = nextProfile.logoUrl || null;
    if (!nextLogoUrl) {
      if (currentLogoUrl !== null) {
        image.removeAttribute('src');
      }
      currentLogoUrl = null;
      image.hidden = true;
      return;
    }
    if (currentLogoUrl !== nextLogoUrl) {
      currentLogoUrl = nextLogoUrl;
      image.hidden = false;
      image.src = nextLogoUrl;
    }
  }

  image.addEventListener('error', () => {
    image.hidden = true;
  });
  image.addEventListener('load', () => {
    image.hidden = false;
  });
  sync(profile);

  return {
    root,
    sync,
  };
}
