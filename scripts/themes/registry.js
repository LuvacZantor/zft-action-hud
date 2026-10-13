// All themes use the same RPG-independent UI, action rendering and settings.
// The IDs are stable: never change them without a persisted-settings migration.
export const THEMES = Object.freeze({
  'zft-default': Object.freeze({ id: 'zft-default', label: 'ZFT Default' }),
  'gothic-arcane': Object.freeze({ id: 'gothic-arcane', label: 'Gothic Arcane' }),
  'midnight-steel': Object.freeze({ id: 'midnight-steel', label: 'Midnight Steel' }),
  'emerald-grove': Object.freeze({ id: 'emerald-grove', label: 'Emerald Grove' }),
  'royal-sapphire': Object.freeze({ id: 'royal-sapphire', label: 'Royal Sapphire' }),
  'crimson-ember': Object.freeze({ id: 'crimson-ember', label: 'Crimson Ember' }),
  'sunlit-parchment': Object.freeze({ id: 'sunlit-parchment', label: 'Sunlit Parchment' })
});

// One ordered source for both Foundry Module Settings and the floating settings UI.
export const THEME_CHOICES = Object.freeze(Object.fromEntries(
  Object.values(THEMES).map(({ id, label }) => [id, label])
));

export function themeOptions(selectedTheme) {
  return Object.values(THEMES).map(({ id, label }) => ({
    id, label, selected: id === selectedTheme || (id === 'zft-default' && !Object.hasOwn(THEMES, selectedTheme))
  }));
}

/** Personal-only themes. Legacy "inherit" settings now resolve to ZFT Default. */
export function resolveTheme({ clientTheme } = {}) {
  return Object.hasOwn(THEMES, clientTheme) ? clientTheme : 'zft-default';
}

/** Cycle the same stable list in either direction, wrapping at both ends. */
export function nextClientTheme(current, direction = 1) {
  const choices = Object.keys(THEMES);
  const i = choices.indexOf(current);
  if (i < 0) return 'zft-default';
  return choices[(i + (direction < 0 ? -1 : 1) + choices.length) % choices.length];
}
