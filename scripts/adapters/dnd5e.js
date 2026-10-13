import { adjustDnd5eHp } from './dnd5e-hp.js';
import { getDnd5eRollCategories, rollDnd5eCheck, getDnd5eToolPresentation, getDnd5eToolChecks } from './dnd5e-checks.js';
import { dnd5eItemControls, toggleDnd5eItemState } from './dnd5e-item-state.js';
import { getDnd5eSpellSlots, adjustDnd5eSpellSlot } from './dnd5e-spell-slots.js';
import { getDnd5eInspiration, setDnd5eInspiration } from './dnd5e-inspiration.js';
import { collectSpellActions, findActivity, parseCastActionId, cachedForActivity, isFeatureSpellSource } from './dnd5e-spells.js';
import { EQUIPPABLE_CATEGORY_SETTINGS, shouldShowInventoryItem, remainingUses } from './dnd5e-visibility.js';
import { getActiveEffects } from './dnd5e-effects.js';
import { collectActivitySummaries, formatDnd5eRange } from './dnd5e-activity-preview.js';

/**
 * D&D5e 5.x adapter. The core handles presentation and asks adapters to execute.
 * Item5e.use() delegates to native Activity execution / choice dialogs, preserving
 * the system and Midi-QOL/CPR hooks. V14 + D&D5e 6.x need separate live tests.
 */
const CATEGORY_DEFS = Object.freeze([
  { id: 'weapons', label: 'Weapons', icon: 'fa-solid fa-swords', types: ['weapon'] },
  { id: 'spells', label: 'Spells', icon: 'fa-solid fa-wand-magic-sparkles', types: ['spell'] },
  { id: 'features', label: 'Features', icon: 'fa-solid fa-shield-halved', types: ['feat'] },
  { id: 'consumables', label: 'Consumables', shortLabel: 'Consum.', icon: 'fa-solid fa-flask', types: ['consumable'] },
  { id: 'equipment', label: 'Equipment', icon: 'fa-solid fa-helmet-safety', types: ['equipment'] },
  { id: 'tools', label: 'Tools', icon: 'fa-solid fa-screwdriver-wrench', types: ['tool'] },
  { id: 'inventory', label: 'Inventory', icon: 'fa-solid fa-bag-shopping', types: ['loot', 'backpack', 'container'] }
]);

function subcategoryFor(item, id) {
  if (id === 'weapons') {
    return item.system?.equipped
      ? { id: 'equipped', label: 'Equipped', order: 0 }
      : { id: 'other', label: 'Other Weapons', order: 1 };
  }
  if (id === 'features') {
    const type = item.system?.type?.value;
    const groups = {
      class: ['class', 'Class Features', 0],
      subclass: ['subclass', 'Subclass Features', 1],
      race: ['species', 'Species Features', 2],
      species: ['species', 'Species Features', 2],
      feat: ['feats', 'Feats', 3],
      background: ['background', 'Background', 4]
    };
    const group = groups[type] ?? ['other', 'Other Features', 6];
    return { id: group[0], label: group[1], order: group[2] };
  }
  if (id === 'consumables') {
    const type = item.system?.type?.value;
    const labels = {
      potion: ['potions', 'Potions', 0],
      scroll: ['scrolls', 'Scrolls', 1],
      ammo: ['ammunition', 'Ammunition', 2],
      food: ['food', 'Food', 3]
    };
    const group = labels[type] ?? ['other', 'Other Consumables', 9];
    return { id: group[0], label: group[1], order: group[2] };
  }
  if (id === 'equipment') {
    return item.system?.equipped
      ? { id: 'equipped', label: 'Equipped', order: 0 }
      : { id: 'unequipped', label: 'Other Equipment', order: 1 };
  }
  if (id === 'inventory') {
    return ['backpack', 'container'].includes(item.type)
      ? { id: 'containers', label: 'Containers', order: 0 }
      : { id: 'other', label: 'Other Inventory', order: 1 };
  }
  return { id: 'all', label: 'All Items', order: 0 };
}

/** D&D5e 5.x stores spent/max; older Items may expose value/max. */
function resourceUses(uses) {
  return remainingUses(uses);
}

function previewItem(item, favorites, activeItemIds, action = null, actor = null) {
  const id = action?.id ?? item.id;
  const uses = resourceUses(action?.activity?.uses) ?? resourceUses(item.system?.uses);
  return {
    id,
    name: action?.name ?? item.name,
    img: action?.img || item.img || 'icons/svg/item-bag.svg',
    itemState: action?.id && String(action.id).startsWith('cast:') ? null : dnd5eItemControls(item, actor),
    itemStateId: item.id,
    toolCheck: item.type === 'tool' ? getDnd5eToolPresentation(actor,item) : null,
    sourceLabel: action?.sourceLabel || (item.type === 'spell' && Number(item.system?.level) > 0 &&
      item.system?.method === 'spell' && Number(item.system?.prepared) === 0 ? 'Unprepared' : ''),
    favorite: favorites.has(id),
    active: activeItemIds.has(item.id),
    hasUses: Boolean(uses),
    uses: uses?.remaining ?? null,
    maxUses: uses?.maximum ?? null
  };
}

function resolveSource(actor, id) {
  const cast = parseCastActionId(id);
  if (!cast) {
    const item = actor?.items?.get(id);
    return item ? { item, activity: null, cast: false } : null;
  }
  const item = actor?.items?.get(cast.itemId);
  const activity = item && findActivity(item, cast.activityId);
  if (!item || activity?.type !== 'cast') return null;
  return { item, activity, cast: true };
}

function sourceCastName(item) {
  return `${isFeatureSpellSource(item) ? 'Feature' : 'Item'} casting: ${item.name}`;
}

export const dnd5eAdapter = Object.freeze({
  systemId: 'dnd5e',
  actionHelpText: 'Click to use with the game system · Right-click for Item sheet · Drag to Favorites or Custom Hotbar.',
  inventorySettings: Object.freeze(['showUnchargedItems', ...Object.values(EQUIPPABLE_CATEGORY_SETTINGS)]),
  inventoryFilterOptions: Object.freeze([
    { key: 'showUnchargedItems', label: 'Show Uncharged Items' },
    { key: 'showUnequippedWeapons', label: 'Show Unequipped Weapons' },
    { key: 'showUnequippedEquipment', label: 'Show Unequipped Equipment' },
    { key: 'showUnequippedConsumables', label: 'Show Unequipped Consumables' },
    { key: 'showUnequippedTools', label: 'Show Unequipped Tools' },
    { key: 'showUnequippedContainers', label: 'Show Unequipped Containers' }
  ]),
  capabilities: Object.freeze({ health: true, inspiration: true, inventoryFilters: true }),
  getHealth(actor) {
    const hp = actor?.system?.attributes?.hp;
    const value = Number(hp?.value), max = Number(hp?.max);
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return null;
    return { label: 'Hit Points', value, max, temp: Math.max(0, Number(hp?.temp) || 0),
      percent: Math.max(0, Math.min(100, Math.round(value / max * 100))) };
  },
  adjustHp: adjustDnd5eHp,
  /** Generic category-resource section contract implemented by this RPG adapter. */
  getCategoryResourceSection(actor, categoryId) {
    if (categoryId !== 'spells') return null;
    const items = getDnd5eSpellSlots(actor);
    return items.length ? { label: 'Spell Slots', icon: 'fa-solid fa-wand-magic-sparkles', items } : null;
  },
  adjustResource: adjustDnd5eSpellSlot,
  toggleItemState: toggleDnd5eItemState,
  getInspiration: getDnd5eInspiration,
  setInspiration: setDnd5eInspiration,
  getActorSummary(actor) { return this.getHealth(actor); },
  getActiveEffects(actor) {
    const definitions = globalThis.CONFIG?.statusEffects ?? [];
    return getActiveEffects(actor, definitions);
  },
  /** Preserve Favorites/Recent across changes to the spellcasting browser.
   * Former equipment Cast shortcuts become the parent Item, which is still
   * exposed in its normal inventory category. Feature Cast shortcuts remain.
   */
  resolveActionId(actor, id) {
    const spell = actor?.items?.get(id);
    const sourceId = spell && cachedForActivity(spell);
    const castId = sourceId || id;
    const resolved = resolveSource(actor, castId);
    if (!resolved?.cast) return id;
    return isFeatureSpellSource(resolved.item) ? castId : resolved.item.id;
  },
  /** Action IDs may denote Items or exact source Cast Activities. */
  hasAction(actor, id) {
    const resolved = resolveSource(actor, id);
    return Boolean(resolved) || Boolean(actor?.items?.get(id));
  },
  rollCheck: rollDnd5eCheck,
  getCategories(actor, favoriteIds = []) {
    if (!actor?.items) return [];
    const favorites = new Set(favoriteIds);
    const items = Array.from(actor.items.values());
    const preferences = {};
    for (const setting of this.inventorySettings) {
      preferences[setting] = game.settings.get('zft-action-hud', setting);
    }
    const activeItemIds = this.getActiveEffects(actor).activeItemIds;
    const knownTypes = new Set(CATEGORY_DEFS.flatMap(category => category.types));
    const definitions = [...CATEGORY_DEFS];
    if (items.some(item => !knownTypes.has(item.type))) {
      definitions.push({ id: 'other', label: 'Other', icon: 'fa-solid fa-ellipsis', types: [] });
    }
    const spellActions = collectSpellActions(items);
    const itemCategories = definitions.map(def => {
      const categoryItems = def.id === 'spells' ? [] : items.filter(item =>
        def.id === 'other' ? !knownTypes.has(item.type) : def.types.includes(item.type));
      const settingKey = EQUIPPABLE_CATEGORY_SETTINGS[def.id];
      // Only display the filter if this category actually has equipped data.
      const equippableItems = categoryItems.filter(item => typeof item.system?.equipped === 'boolean');
      const equippedFilter = equippableItems.length > 0 ? {
        setting: settingKey, checked: preferences[settingKey] !== false,
        label: 'Show Unequipped'
      } : null;
      const matches = def.id === 'spells' ? spellActions : categoryItems
        .filter(item => shouldShowInventoryItem(item, def.id, preferences))
        .map(item => ({ id: item.id, item, group: subcategoryFor(item, def.id) }));
      const groupMap = new Map();
      for (const action of matches) {
        const group = action.group;
        if (!groupMap.has(group.id)) groupMap.set(group.id, { ...group, items: [] });
        groupMap.get(group.id).items.push(previewItem(action.item, favorites, activeItemIds, action, actor));
      }
      // Slot badges attach to their native spell-level header; generate an empty header if
      // slots exist at a level for which no spell is currently prepared.
      if (def.id === 'spells') {
        const pools = getDnd5eSpellSlots(actor);
        for (const pool of pools) {
          const key = pool.id === 'pact' ? 'pact-slots' : `level-${Number(pool.id.slice(5))}`;
          if (!groupMap.has(key)) {
            const level = pool.id === 'pact' ? 10 : Number(pool.id.slice(5));
            groupMap.set(key, { id: key, label: pool.id === 'pact' ? 'Pact Magic' :
              ['Cantrips','1st Level','2nd Level','3rd Level','4th Level','5th Level','6th Level','7th Level','8th Level','9th Level'][level],
              order: pool.id === 'pact' ? 20 : 3 + level, items: [] });
          }
          const group = groupMap.get(key);
          group.slotPool = { id: pool.id, label: pool.label, tooltip: pool.tooltip,
            shields: Array.from({length:pool.max}, (_,index) => ({
              available: index < pool.current, delta: index < pool.current ? -1 : 1,
              title: index < pool.current ? pool.decreaseLabel : pool.increaseLabel,
              disabled: !pool.canEdit
            })) };
        }
      }
      if (def.id === 'tools') {
        const toolChecks = getDnd5eToolChecks(actor);
        if (toolChecks.length) groupMap.set('actor-tool-checks', {
          id:'actor-tool-checks', label:'Tool Checks', order:-1,
          items:[], checks:toolChecks, checkGroup:true, rollKind:'tool', rollLabel:'tool check', showPassive:false
        });
      }
      const groups = [...groupMap.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
      groups.forEach(group => group.items.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)));
      return { id: def.id, label: def.label, shortLabel: def.shortLabel ?? null, icon: def.icon, count: matches.length + (def.id === 'tools' ? getDnd5eToolChecks(actor).length : 0), groups, equippedFilter, secondary: def.id === 'tools' };
    }).filter(category => category.count > 0 || category.id === 'tools' || category.equippedFilter ||
      (category.id === 'spells' && getDnd5eSpellSlots(actor).length > 0));
    return [...itemCategories, ...getDnd5eRollCategories(actor)];
  },
  async inspectItem(actor, id) {
    const resolved = resolveSource(actor, id);
    if (!resolved || !resolved.item.isOwner) return false;
    const sheet = resolved.item.sheet;
    if (!sheet) return false;
    // ApplicationV2 and legacy ApplicationV1 Item sheets expose bringToFront().
    // Rendering is asynchronous in ApplicationV2; bring to front afterwards.
    await sheet.render(true);
    sheet.bringToFront?.();
    return true;
  },
  getItemPreview(actor, id) {
    const resolved = resolveSource(actor, id);
    if (!resolved || !resolved.item.isOwner) return null;
    const { item, activity, cast } = resolved;
    const cache = cast ? Array.from(actor.items.values()).find(spell => spell.type === 'spell' && cachedForActivity(spell) === id) : null;
    const system = (cache ?? item).system ?? {};
    const activation = system.activation ?? {};
    const range = system.range ?? {};
    const uses = (cast ? (activity?.uses ?? item.system?.uses) : system.uses) ?? {};
    const labels = { spell: 'Spell', weapon: 'Weapon', feat: 'Feature', equipment: 'Equipment', consumable: 'Consumable', tool: 'Tool', loot: 'Inventory', backpack: 'Container' };
    const level = Number(system.level);
    const method = String(system.method ?? 'spell').toLowerCase();
    const spellKind = level === 0 ? 'Cantrip' : `Level ${level} spell`;
    const methodName = { atwill: 'At-Will', innate: 'Innate', ritual: 'Ritual-Only' }[method];
    const subtype = (cache ?? item).type === 'spell' && Number.isInteger(level) && level >= 0
      ? (methodName ? `${methodName} · ${spellKind}` : spellKind) : (labels[item.type] ?? item.type ?? 'Item');
    const amount = resourceUses(uses);
    return {
      id, name: (cache?.name ?? (cast ? (String(activity.name ?? '').trim() || item.name) : item.name)) ?? 'Unnamed Item',
      img: cache?.img || activity?.img || item.img || 'icons/svg/item-bag.svg',
      kind: cast ? sourceCastName(item) : subtype,
      activation: activation.type ? `${activation.cost || 1} ${activation.type}` : '',
      range: formatDnd5eRange(range),
      uses: amount ? `${amount.remaining} / ${amount.maximum}` : '',
      activities: collectActivitySummaries(item, cast ? activity : null,
        { ...(actor.getRollData?.() ?? {}), ...((cache ?? item).getRollData?.() ?? {}) }),
      description: String(system.description?.value ?? ''),
      document: cache ?? item,
      rollData: (cache ?? item).getRollData?.() ?? actor.getRollData?.() ?? {}
    };
  },
  /** Native D&D5e Item use: one Activity activates directly; multiple use the system chooser. */
  async executeItem(actor, id) {
    id = this.resolveActionId(actor, id);
    const resolved = resolveSource(actor, id);
    if (!resolved || !resolved.item.isOwner) return { status: 'denied' };
    const { item, activity, cast } = resolved;
    // Never invoke a cached spell clone as an independent cast. Use its
    // original source Activity so native resource/slot handling stays intact.
    if (!cast && cachedForActivity(item)) return { status: 'source-missing' };
    if (cast && (typeof activity.use !== 'function' || activity.canUse === false)) return { status: 'unsupported' };
    if (!cast && typeof item.use !== 'function') return { status: 'unsupported' };
    // Activity selection, targeting, configuration, consumption, and automation
    // remain owned by D&D5e and its installed workflow modules.
    const result = cast ? await activity.use() : await item.use();
    return { status: result == null ? 'cancelled' : 'used', result };
  }
});
