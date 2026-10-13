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

export function themeOptions(selectedTheme, { includeInherit = false } = {}) {
  const options = Object.values(THEMES).map(({ id, label }) => ({
    id, label, selected: id === selectedTheme
  }));
  return includeInherit
    ? [{ id: 'inherit', label: 'Follow Campaign', selected: selectedTheme === 'inherit' }, ...options]
    : options;
}

export function resolveTheme({ worldTheme, clientTheme, allowOverride }) {
  const requested = allowOverride && clientTheme !== 'inherit' ? clientTheme : worldTheme;
  return Object.hasOwn(THEMES, requested) ? requested : 'zft-default';
}

export function nextClientTheme(current) {
  const choices = ['inherit', ...Object.keys(THEMES)];
  const i = choices.indexOf(current);
  return choices[(i + 1) % choices.length];
}
