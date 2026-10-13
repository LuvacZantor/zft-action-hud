/**
 * D&D5e spell-action classification. Pure data helpers with no Foundry globals.
 *
 * A cast Activity on an Item/Feature is the executable source of a cached spell.
 * Do not treat flags.dnd5e.cachedFor spell copies as independent casts.
 * Data model observed in Foundry V13 Build 351 / D&D5e 5.2.5.
 */
export const SPELL_LEVELS = Object.freeze([
  'Cantrips', '1st Level', '2nd Level', '3rd Level', '4th Level',
  '5th Level', '6th Level', '7th Level', '8th Level', '9th Level'
]);

const FEATURE_TYPES = new Set(['feat', 'class', 'subclass', 'race', 'species', 'background']);
const CAST_PREFIX = 'cast:';

/** Only IDs originating from actual embedded source Items and Activities are used. */
export function isFeatureSpellSource(item) {
  return FEATURE_TYPES.has(item?.type);
}

export function castActionId(itemId, activityId) {
  return `${CAST_PREFIX}${itemId}:${activityId}`;
}

export function parseCastActionId(id) {
  if (typeof id !== 'string' || !id.startsWith(CAST_PREFIX)) return null;
  const match = /^cast:([^:]+):([^:]+)$/.exec(id);
  return match ? { itemId: match[1], activityId: match[2] } : null;
}

/** Relative references are produced by D&D5e's Activity.relativeUUID. */
export function cachedForActivity(item) {
  const path = item?.flags?.dnd5e?.cachedFor;
  if (typeof path !== 'string') return null;
  const match = /(?:^|\.)Item\.([^.]*)\.Activity\.([^.]*)$/.exec(path);
  if (!match || !match[1] || !match[2]) return null;
  return castActionId(match[1], match[2]);
}

export function listActivities(item) {
  const collection = item?.system?.activities;
  if (!collection) return [];
  if (collection instanceof Map || (typeof collection.values === 'function' && !Array.isArray(collection))) {
    return Array.from(collection.values());
  }
  if (Array.isArray(collection)) return collection;
  return typeof collection === 'object' ? Object.values(collection) : [];
}

export function findActivity(item, activityId) {
  const activities = item?.system?.activities;
  const fromCollection = typeof activities?.get === 'function' ? activities.get(activityId) : activities?.[activityId];
  return fromCollection ?? listActivities(item).find(act => (act?.id ?? act?._id) === activityId) ?? null;
}

export function spellGroup(item) {
  const method = String(item?.system?.method ?? 'spell').toLowerCase();
  const level = Number(item?.system?.level);
  // Casting method wins over spell level and preparation, including at-will
  // spells configured with a limited number of uses.
  if (method === 'atwill') return { id: 'at-will', label: 'At-Will', order: 1 };
  if (method === 'innate') return { id: 'innate', label: 'Innate Spellcasting', order: 2 };
  if (method === 'ritual') return { id: 'ritual-only', label: 'Ritual-Only', order: 3 };
  if (method !== 'spell' && method !== 'pact') return { id: 'other-spells', label: 'Other Spellcasting', order: 23 };
  if (level === 0) return { id: 'level-0', label: SPELL_LEVELS[0], order: 0 };
  // Keep Pact Magic spells together under the Pact pool, including spells
  // granted by a multiclass Warlock. Cantrips still use the Cantrips group.
  if (method === 'pact') return { id: 'pact-slots', label: 'Pact Magic', order: 20 };
  // D&D5e character sheets include known but unprepared spells (e.g., Heal
  // from the supplied Bard/Warlock fixture). Show them; native Item.use()
  // remains responsible for preparing/casting validation and automation.
  if (Number.isInteger(level) && level >= 1 && level <= 9) {
    return { id: `level-${level}`, label: SPELL_LEVELS[level], order: 3 + level };
  }
  return { id: 'other-spells', label: 'Other Spells', order: 23 };
}

/**
 * Returns normal prepared/special-method spells and feature Cast Activities.
 * Equipment-based Cast Activities remain accessible via their parent Items,
 * so they are not duplicated in Spells. Broken cachedFor links remain visible
 * (unless unprepared) but are never executable.
 */
export function collectSpellActions(items) {
  const spells = items.filter(item => item.type === 'spell');
  const cacheByAction = new Map();
  const normal = [];
  for (const spell of spells) {
    const link = cachedForActivity(spell);
    if (!link) {
      const group = spellGroup(spell);
      if (group) normal.push({ id: spell.id ?? spell._id, item: spell, group });
      continue;
    }
    if (!cacheByAction.has(link)) cacheByAction.set(link, []);
    cacheByAction.get(link).push(spell);
  }

  const casts = [];
  const linked = new Set();
  for (const item of items) {
    if (item.type === 'spell') continue;
    for (const activity of listActivities(item)) {
      if (activity?.type !== 'cast') continue;
      const activityId = activity.id ?? activity._id;
      const sourceId = item.id ?? item._id;
      if (!sourceId || !activityId) continue;
      const id = castActionId(sourceId, activityId);
      const cached = cacheByAction.get(id) ?? [];
      if (cached.length) linked.add(id);
      const spell = cached[0] ?? null;
      const sourceKind = isFeatureSpellSource(item) ? 'feature' : 'item';
      // Equipment and consumables already appear in their normal inventory
      // categories. Clicking the parent Item invokes D&D5e's activity chooser;
      // don't list its Cast Activities again as independent spells.
      if (sourceKind !== 'feature') continue;
      const group = { id: 'feature-castings', label: 'Feature Spellcasting', order: 21 };
      const activityName = String(activity.name ?? '').trim();
      const bareSpellName = spell?.name ?? '';
      const name = bareSpellName || activityName || `Cast Spell (${item.name ?? 'Item'})`;
      casts.push({
        id, item, activity, spell, name,
        img: spell?.img || activity.img || item.img,
        sourceLabel: item.name ?? '', sourceKind, group
      });
    }
  }

  const unlinked = [];
  for (const [id, duplicates] of cacheByAction) {
    if (linked.has(id)) continue;
    // A missing source must never cause a cached copy to become castable.
    const spell = duplicates[0];
    // Preserve dev.41 safety for broken cached cast references: unprepared
    // copies are not standalone executable Items, even when listed on a sheet.
    if (Number(spell?.system?.prepared) === 0) continue;
    unlinked.push({
      id: spell.id ?? spell._id, item: spell, missingSource: true,
      sourceLabel: 'Casting source missing',
      group: { id: 'unlinked-castings', label: 'Unlinked Spell Castings', order: 24 }
    });
  }
  return [...normal, ...casts, ...unlinked];
}
