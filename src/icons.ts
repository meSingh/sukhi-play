/**
 * Every icon, as SVG that ships with the app: no emoji, no icon font. The
 * tray's pieces are small pictures of themselves, so a child who cannot read
 * picks them by how they look.
 */
import type { Kind } from './track';
import type { Vehicle } from './vehicles';

const TRACK = (d: string): string =>
  `<path d="${d}" fill="none" stroke="#C99A6B" stroke-width="30"/><path d="${d}" fill="none" stroke="#6B4A2F" stroke-width="16"/><path d="${d}" fill="none" stroke="#C99A6B" stroke-width="11"/>`;

export const PIECE: Record<Kind, string> = {
  straight: TRACK('M4 32H60'),
  curve: TRACK('M4 32 A28 28 0 0 1 32 60'),
  station: `${TRACK('M4 40H60')}<path d="M8 22 L32 8 L56 22Z" fill="#E8453C"/><rect x="12" y="50" width="40" height="10" rx="3" fill="#EBD9BF" stroke="#B89A72" stroke-width="2"/>`,
  bridge: `<rect x="0" y="40" width="64" height="22" rx="6" fill="#7CC6F0"/>${TRACK('M2 30H62')}<path d="M6 16H58M6 44H58" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>`,
  tunnel: `${TRACK('M2 44H62')}<path d="M6 52 C10 10 54 10 58 52Z" fill="#8CC96A"/><path d="M20 52 V40 A12 12 0 0 1 44 40 V52Z" fill="#3E5A2B"/>`,
  ramp: `<path d="M4 54 L60 18 V54Z" fill="#C99A6B"/><path d="M4 54 L60 18" stroke="#6B4A2F" stroke-width="6" stroke-linecap="round"/><path d="M26 44 l8 -6 l-4 -8 M40 36 l8 -6 l-4 -8" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  bouncy: `${TRACK('M4 50H60')}<rect x="14" y="10" width="36" height="12" rx="6" fill="#FF7AA8"/><path d="M20 24 L44 30 L20 36 L44 42" fill="none" stroke="#6B7280" stroke-width="4" stroke-linejoin="round"/>`,
  bell: `${TRACK('M4 50H60')}<path d="M32 6c-9 0-14 6-14 15v9l-5 7h38l-5-7v-9c0-9-5-15-14-15z" fill="#FFC93C" stroke="#B8860B" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="40" r="4" fill="#B8860B"/>`,
  wash: `${TRACK('M4 32H60')}<rect x="8" y="10" width="48" height="44" rx="10" fill="#9ED8F5" fill-opacity=".75" stroke="#3A8FC4" stroke-width="3"/><g fill="#FFFFFF" stroke="#3A8FC4" stroke-width="2"><circle cx="20" cy="22" r="5"/><circle cx="40" cy="18" r="4"/><circle cx="46" cy="40" r="6"/></g>`
};

export const piece = (k: Kind): string => `<svg viewBox="0 0 64 64" aria-hidden="true">${PIECE[k]}</svg>`;

export const VEHICLE: Record<Vehicle, string> = {
  train: '<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="4" y="14" width="36" height="22" rx="6" fill="#E8453C"/><rect x="32" y="4" width="16" height="32" rx="5" fill="#C7322B"/><rect x="8" y="4" width="8" height="12" rx="2" fill="#1E2A5A"/><rect x="50" y="16" width="12" height="20" rx="4" fill="#2F6FD6"/><circle cx="14" cy="40" r="6" fill="#1E2A5A"/><circle cx="36" cy="40" r="6" fill="#1E2A5A"/></svg>',
  car: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M8 32l6-14c1-3 3-4 6-4h22c3 0 5 1 6 4l6 14v6H8z" fill="#FFC93C"/><rect x="18" y="17" width="12" height="9" rx="2" fill="#BFE3FA"/><rect x="34" y="17" width="12" height="9" rx="2" fill="#BFE3FA"/><circle cx="18" cy="40" r="6" fill="#1E2A5A"/><circle cx="46" cy="40" r="6" fill="#1E2A5A"/></svg>',
  bus: '<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="4" y="6" width="56" height="30" rx="8" fill="#0E9F9A"/><rect x="10" y="12" width="10" height="10" rx="2" fill="#BFE3FA"/><rect x="24" y="12" width="10" height="10" rx="2" fill="#BFE3FA"/><rect x="38" y="12" width="10" height="10" rx="2" fill="#BFE3FA"/><circle cx="16" cy="40" r="6" fill="#1E2A5A"/><circle cx="48" cy="40" r="6" fill="#1E2A5A"/></svg>'
};

const S = (d: string, extra = ''): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;

export const ICONS = {
  go: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.7L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  undo: S('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  rubber: S('<path d="M20 20H9L4 15a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-7 8"/><path d="M8 11l6 6"/>'),
  tracks: S('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 15h10M7 11h6"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  bin: S('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  sound: S('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  mute: S('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 10l4 4M21 10l-4 4"/>'),
  slow: '<svg viewBox="0 0 64 44" aria-hidden="true"><path d="M8 32 C8 14 44 14 44 32Z" fill="#1F9D55"/><path d="M14 30 C16 20 36 20 38 30" fill="none" stroke="#157A40" stroke-width="3"/><circle cx="52" cy="28" r="7" fill="#7FCB8F"/><rect x="12" y="32" width="8" height="8" rx="3" fill="#7FCB8F"/><rect x="32" y="32" width="8" height="8" rx="3" fill="#7FCB8F"/></svg>',
  fast: '<svg viewBox="0 0 64 44" aria-hidden="true"><ellipse cx="30" cy="28" rx="18" ry="11" fill="#C9B8A6"/><circle cx="48" cy="20" r="8" fill="#C9B8A6"/><ellipse cx="48" cy="6" rx="3" ry="8" fill="#C9B8A6"/><ellipse cx="54" cy="7" rx="3" ry="8" fill="#C9B8A6"/><circle cx="12" cy="26" r="4" fill="#FFFFFF"/><circle cx="51" cy="19" r="1.8" fill="#1E2A5A"/></svg>',
  hand: '<svg viewBox="0 0 64 80" aria-hidden="true"><path d="M24 2c6 0 9 4 9 9v20l11 2c5 1 9 6 8 11l-3 18c-1 7-7 12-14 12H21c-6 0-10-3-12-8L1 44c-2-5 3-10 9-7l6 6V11c0-5 3-9 8-9z" fill="#FFD9B8" stroke="#1E2A5A" stroke-width="3" stroke-linejoin="round"/></svg>'
};
