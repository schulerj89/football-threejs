import type { UniformPalette } from '../teams/UniformPalette';

export function createTeamHelmetBadge(uniform: UniformPalette): SVGSVGElement {
  const svg = createSvgElement('svg');
  svg.classList.add('team-helmet-badge');
  svg.setAttribute('viewBox', '0 0 96 72');
  svg.setAttribute('aria-hidden', 'true');

  const shell = createSvgElement('path');
  shell.classList.add('team-helmet-shell');
  shell.setAttribute(
    'd',
    'M16 44c0-20 15-34 38-34 17 0 29 8 33 22 2 8 0 17-5 24H39c-9 0-16-5-20-12h-3z',
  );

  const opening = createSvgElement('path');
  opening.classList.add('team-helmet-opening');
  opening.setAttribute('d', 'M56 33h27c1 8-2 15-7 19H58c-6 0-10-4-10-9 0-6 3-10 8-10z');

  const stripe = createSvgElement('path');
  stripe.classList.add('team-helmet-stripe');
  stripe.setAttribute('d', 'M38 12c-6 8-8 21-6 35');

  const faceguard = createSvgElement('path');
  faceguard.classList.add('team-helmet-faceguard');
  faceguard.setAttribute('d', 'M59 36h27M61 47h21M78 36v19M66 36v18');

  svg.append(shell, opening, stripe, faceguard);
  syncTeamHelmetBadge(svg, uniform);
  return svg;
}

export function syncTeamHelmetBadge(svg: SVGSVGElement, uniform: UniformPalette): void {
  svg.style.setProperty('--helmet-shell', uniform.helmetShell);
  svg.style.setProperty('--helmet-faceguard', uniform.faceguard);
  svg.style.setProperty('--helmet-stripe', uniform.stripe);
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}
