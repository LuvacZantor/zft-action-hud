/** Pure D&D5e 5.x inventory visibility helpers (no Foundry globals). */
export const EQUIPPABLE_CATEGORY_SETTINGS = Object.freeze({
  weapons: 'showUnequippedWeapons',
  equipment: 'showUnequippedEquipment',
  consumables: 'showUnequippedConsumables',
  tools: 'showUnequippedTools',
  inventory: 'showUnequippedContainers'
});

/** D&D5e's 5.x uses.spent/max, with fallback for older value/max shapes. */
export function remainingUses(uses) {
  const maximum = Number(uses?.max);
  if (uses?.max == null || String(uses.max).trim() === '' || !Number.isFinite(maximum) || maximum <= 0) return null;
  const spent = Number(uses?.spent);
  const value = Number(uses?.value);
  const remaining = uses?.spent != null && Number.isFinite(spent)
    ? maximum - spent
    : (uses?.value != null && Number.isFinite(value) ? value : null);
  return remaining === null ? null : { remaining: Math.max(0, remaining), maximum };
}

/** Only hide when charges are definitely spent and no alternate activity is available. */
export function isExhaustedItem(item) {
  if (!item || item.type === 'spell' || item.type === 'feat') return false;
  const uses = remainingUses(item.system?.uses);
  if (!uses || uses.remaining > 0) return false;
  const activities = item.system?.activities;
  const values = activities instanceof Map || typeof activities?.values === 'function'
    ? [...activities.values()]
    : Object.values(activities ?? {});
  // If an activity consumes some other resource or is not tied to Item Uses,
  // do not assume the depleted Item pool makes it unusable.
  if (values.some(activity => {
    const targets = activity?.consumption?.targets ?? [];
    return targets.length === 0 || !targets.some(t => t.type === 'itemUses');
  })) return false;
  return true;
}

/** Filter only Items whose schema actually includes an equipped property. */
export function shouldShowInventoryItem(item, category, preferences = {}) {
  const setting = EQUIPPABLE_CATEGORY_SETTINGS[category];
  if (setting && preferences[setting] === false && item?.system?.equipped === false) return false;
  if (preferences.showUnchargedItems === false && isExhaustedItem(item)) return false;
  return true;
}
