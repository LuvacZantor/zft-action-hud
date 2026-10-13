/**
 * Portable Actor-based quick-access references. Item IDs are a fast path within a
 * world, while name/type/image allow conservative re-linking after Actor import.
 * Ambiguous matches are left unassigned rather than executing the wrong Item.
 */
import { MODULE_ID } from './settings.js';
import { uniqueIds } from './quick-access.js';

export const FAVORITES_FLAG = 'favorites';
export const HOTBAR_FLAG = 'hotbarSlots';
export const HOTBAR_DIVIDERS_FLAG = 'hotbarDividers';
export const HOTBAR_ROW_DIVIDERS_FLAG = 'hotbarRowDividers';
export const MAX_HOTBAR_SLOTS = 400;
export const HOTBAR_PROFILES_FLAG = 'hotbarProfiles';
export const MAX_HOTBAR_PROFILES = 15; // Three permanent profiles plus up to 12 user profiles.
export const BUILTIN_PROFILES = Object.freeze([
  { id: 'combat', name: 'Combat', accent: '#D9666B' },
  { id: 'exploration', name: 'Exploration', accent: '#57BF85' },
  { id: 'support', name: 'Support', accent: '#5BADE5' }
]);
export const isBuiltinHotbarProfile = id => BUILTIN_PROFILES.some(p => p.id === id);

function entries(collection) {
  if (!collection) return [];
  if (typeof collection.values === 'function') return Array.from(collection.values());
  return Array.from(collection.contents || []);
}

export function actionReference(actor, id, adapter) {
  if (typeof id !== 'string' || !id) return null;
  const item = actor?.items?.get?.(id);
  // Native action IDs and synthetic cast/activity IDs are both supported.
  const preview = adapter?.getItemPreview?.(actor, id);
  if (!item && !preview) return null;
  return {
    id,
    name: String(preview?.name ?? item?.name ?? '').trim(),
    type: item?.type ?? null,
    img: String(preview?.img ?? item?.img ?? ''),
    // Synthetic activities are resolved through the adapter, never treated as Items.
    synthetic: !item
  };
}

export function resolveActionReference(actor, ref, adapter) {
  if (!actor || !ref) return null;
  if (typeof ref === 'string') ref = { id: ref };
  if (typeof ref !== 'object') return null;
  const name = String(ref.name ?? '').trim();
  const image = String(ref.img ?? '').trim();
  const id = typeof ref.id === 'string' ? ref.id : '';
  if (id && adapter?.hasAction?.(actor, id)) {
    const preview = adapter?.getItemPreview?.(actor, id);
    const item = actor.items?.get?.(id);
    if ((!name || name === (preview?.name ?? item?.name)) &&
        (!ref.type || ref.type === item?.type)) {
      return adapter?.resolveActionId?.(actor, id) ?? id;
    }
  }
  if (!name) return null;
  // Synthetic cast actions must remain exact Activities, not fall back to a
  // coincidentally identically named embedded Item.
  if (ref.synthetic && typeof adapter?.getCategories === 'function') {
    const actions = adapter.getCategories(actor, []).flatMap(category => category.groups || [])
      .flatMap(group => group.items || []).filter(action => action.name === name);
    const best = actions.filter(action => !image || action.img === image);
    if (best.length === 1) return best[0].id;
    if (actions.length === 1) return actions[0].id;
    return null;
  }
  const candidates = entries(actor.items).filter(item => item?.name === name &&
    (!ref.type || item.type === ref.type));
  if (candidates.length === 1) return candidates[0].id;
  const imageMatches = candidates.filter(item => item.img === image);
  if (image && imageMatches.length === 1) return imageMatches[0].id;
  return null;
}

export function resolveFavoriteIds(actor, adapter) {
  const raw = actor?.getFlag?.(MODULE_ID, FAVORITES_FLAG);
  if (!Array.isArray(raw)) return null; // null indicates un-migrated Actor
  return uniqueIds(raw.map(ref => resolveActionReference(actor, ref, adapter)).filter(Boolean));
}

export async function saveFavorites(actor, ids, adapter) {
  if (!actor?.isOwner || typeof actor.setFlag !== 'function') throw new Error('Actor ownership required to save Favorites');
  const refs = uniqueIds(ids).map(id => actionReference(actor, id, adapter)).filter(Boolean);
  await actor.setFlag(MODULE_ID, FAVORITES_FLAG, refs);
  return refs;
}

/** One-way, idempotent migration. Never overwrite an existing Actor flag. */
export async function migrateFavorites(actor, local, adapter) {
  if (!actor?.isOwner || actor.getFlag?.(MODULE_ID, FAVORITES_FLAG) !== undefined) return false;
  const keys = [actor.uuid, actor.id].filter(Boolean);
  const legacy = keys.map(key => local?.[key]).find(value => Array.isArray(value) && value.length);
  if (!legacy) return false;
  await saveFavorites(actor, legacy, adapter);
  return true;
}

/** Persist profiles together so switching never mixes rows, slots, and dividers. */
export function normalizeHotbarDividers(values) {
  return Array.isArray(values) ? [...new Set(values.filter(v => Number.isInteger(v) && v >= 1 && v < 20))].sort((a,b) => a-b) : [];
}
const clampDimension = (v, max, fallback) => Number.isFinite(Number(v)) ? Math.max(1, Math.min(max, Math.round(Number(v)))) : fallback;
function legacyDimensions() {
  // Used once for the first profile; subsequently profile dimensions live on the Actor.
  try {
    return { rows: clampDimension(game.settings.get(MODULE_ID, 'hotbarRows'), 20, 2),
      columns: clampDimension(game.settings.get(MODULE_ID, 'hotbarColumns'), 20, 6) };
  } catch { return { rows: 2, columns: 6 }; }
}
export const normalizeButtonColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
  ? value.toUpperCase() : null;
function cleanColors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, color]) =>
    /^(?:0|[1-9]\d{0,2})$/.test(key) && Number(key) < MAX_HOTBAR_SLOTS && normalizeButtonColor(color))
    .map(([key, color]) => [key, normalizeButtonColor(color)]));
}
function cleanSlots(values) {
  return Array.isArray(values) ? values.slice(0, MAX_HOTBAR_SLOTS).map(ref =>
    ref && typeof ref === 'object' && typeof ref.id === 'string' ? { ...ref } : null) : [];
}
const canonicalName = name => String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
/** Human-readable labels belong to an existing divider boundary, never a grid slot. */
export const normalizeDividerLabel = value => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 32);
function cleanDividerLabels(value, columns, rows) {
  const cleaned = {columns:{}, rows:{}};
  for (const [axis, boundaries] of [['columns',columns],['rows',rows]]) {
    const data = value?.[axis];
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
    for (const boundary of boundaries) {
      const label = normalizeDividerLabel(data[String(boundary)]);
      if (label) cleaned[axis][String(boundary)] = label;
    }
  }
  return cleaned;
}
function normalizeProfile(value, index) {
  if (!value || typeof value !== 'object') return null;
  const defaults = legacyDimensions();
  return { id: String(value.id || `profile-${index}`).slice(0, 48),
    name: canonicalName(value.name) || `Profile ${index + 1}`,
    rows: clampDimension(value.rows, 20, defaults.rows),
    columns: clampDimension(value.columns, 20, defaults.columns),
    slots: cleanSlots(value.slots), dividers: normalizeHotbarDividers(value.dividers),
    rowDividers: normalizeHotbarDividers(value.rowDividers), colors: cleanColors(value.colors),
    dividerLabels: cleanDividerLabels(value.dividerLabels,
      normalizeHotbarDividers(value.dividers),normalizeHotbarDividers(value.rowDividers)),
    accent: normalizeButtonColor(value.accent) };
}
/** Normalize legacy layout on read. Never drop existing custom profiles or change IDs
 * unless they were previously named after a built-in profile. */
function withBuiltins(state) {
  const profiles = state.profiles || [];
  const remapped = new Map();
  for (const builtin of BUILTIN_PROFILES) {
    const existing = profiles.find(p => p.id === builtin.id) ||
      profiles.find(p => p.name.toLowerCase() === builtin.name.toLowerCase());
    if (existing) {
      if (existing.id !== builtin.id) {
        remapped.set(existing.id, builtin.id);
        existing.id = builtin.id;
      }
      existing.name = builtin.name;
    } else {
      const base = profiles.find(p => p.id === 'default') || profiles[0];
      profiles.push({id:builtin.id, name:builtin.name, rows:base?.rows ?? 2,
        columns:base?.columns ?? 6, slots:[], dividers:[], rowDividers:[], dividerLabels:{columns:{},rows:{}}, colors:{}, accent:null});
    }
  }
  if (remapped.has(state.active)) state.active = remapped.get(state.active);
  // Built-ins stay pinned and cannot be moved into the scrolling custom region.
  state.profiles = [...BUILTIN_PROFILES.map(b => profiles.find(p => p.id === b.id)),
    ...profiles.filter(p => !isBuiltinHotbarProfile(p.id))];
  // Preserve the active existing layout when upgrading. Fresh actors start on Combat.
  if (!profiles.some(p => p.id === state.active)) state.active = 'combat';
  state.schema = 2;
  return state;
}
const optimisticProfile = new WeakMap();
const pendingSelection = new WeakMap();
/** A provisional active profile is visible immediately, before the Actor flag write. */
export function hotbarProfiles(actor) {
  if (actor && optimisticProfile.has(actor)) return structuredClone(optimisticProfile.get(actor));
  const stored = actor?.getFlag?.(MODULE_ID, HOTBAR_PROFILES_FLAG);
  if (stored && Array.isArray(stored.profiles) && stored.profiles.length) {
    const ids = new Set();
    const profiles = stored.profiles.slice(0, MAX_HOTBAR_PROFILES).map(normalizeProfile)
      .filter(p => p && !ids.has(p.id) && ids.add(p.id));
    if (profiles.length) return withBuiltins({schema:2,
      active: profiles.some(p => p.id === stored.active) ? stored.active : profiles[0].id, profiles});
  }
  const defaults = legacyDimensions();
  const slots = cleanSlots(actor?.getFlag?.(MODULE_ID, HOTBAR_FLAG));
  const dividers = normalizeHotbarDividers(actor?.getFlag?.(MODULE_ID, HOTBAR_DIVIDERS_FLAG));
  const rowDividers = normalizeHotbarDividers(actor?.getFlag?.(MODULE_ID, HOTBAR_ROW_DIVIDERS_FLAG));
  const legacyPresent = slots.some(Boolean) || dividers.length || rowDividers.length;
  const profiles = legacyPresent ? [{id:'default', name:'Default', ...defaults,
    slots, dividers, rowDividers, colors:{}}] : [];
  return withBuiltins({schema:2, active:legacyPresent?'default':'combat', profiles});
}
export const activeHotbarProfile = actor => {
  const state = hotbarProfiles(actor);
  return state.profiles.find(p => p.id === state.active) || state.profiles[0];
};
export async function ensureHotbarProfiles(actor) {
  if (!actor?.isOwner || typeof actor.setFlag !== 'function') return false;
  const stored = actor.getFlag?.(MODULE_ID, HOTBAR_PROFILES_FLAG);
  if (stored?.schema === 2 && BUILTIN_PROFILES.every(p =>
    stored.profiles?.some(s => s.id === p.id && s.name === p.name))) return false;
  await actor.setFlag(MODULE_ID, HOTBAR_PROFILES_FLAG, hotbarProfiles(actor));
  return true;
}
async function updateProfiles(actor, change) {
  if (!actor?.isOwner || typeof actor.setFlag !== 'function') throw new Error('Actor ownership required to edit hotbar profiles');
  // Editing slot assignments after a fast profile switch must never write into
  // the previous profile. Wait for pending selection before preparing changes.
  if (pendingSelection.has(actor)) await pendingSelection.get(actor);
  const state = hotbarProfiles(actor);
  change(state);
  await actor.setFlag(MODULE_ID, HOTBAR_PROFILES_FLAG, state);
  return state;
}
function currentProfile(state) { return state.profiles.find(p => p.id === state.active) || state.profiles[0]; }
function ensureName(state, name, exceptId = null) {
  const clean = canonicalName(name);
  if (!clean) throw new Error('Enter a profile name.');
  if (state.profiles.some(p => p.id !== exceptId && p.name.toLocaleLowerCase() === clean.toLocaleLowerCase()))
    throw new Error('A profile with that name already exists.');
  return clean;
}
export async function createHotbarProfile(actor, name, { duplicate = false, sourceId = null } = {}) {
  return updateProfiles(actor, state => {
    if (state.profiles.length >= MAX_HOTBAR_PROFILES) throw new Error(`Maximum ${MAX_HOTBAR_PROFILES} profiles.`);
    const label = ensureName(state, name);
    const current = sourceId ? state.profiles.find(p => p.id === sourceId) : currentProfile(state);
    if (!current) throw new Error('Source hotbar profile no longer exists.');
    let counter = 1;
    while (state.profiles.some(p => p.id === `profile-${counter}`)) counter++;
    const fresh = { id: `profile-${counter}`, name: label, rows: current.rows, columns: current.columns,
      slots: duplicate ? cleanSlots(current.slots) : [],
      dividers: duplicate ? [...current.dividers] : [],
      rowDividers: duplicate ? [...current.rowDividers] : [],
      dividerLabels: duplicate ? structuredClone(current.dividerLabels || {columns:{},rows:{}}) : {columns:{},rows:{}},
      colors: duplicate ? {...current.colors} : {}, accent: duplicate ? current.accent : null };
    state.profiles.push(fresh);
    state.active = fresh.id;
  });
}
export async function renameHotbarProfile(actor, name, profileId = null) {
  return updateProfiles(actor, state => {
    const id = profileId ?? state.active;
    const profile = state.profiles.find(profile => profile.id === id);
    if (!profile) throw new Error('This hotbar profile no longer exists.');
    if (isBuiltinHotbarProfile(id)) throw new Error('Built-in profiles cannot be renamed.');
    profile.name = ensureName(state, name, id);
  });
}
export async function deleteHotbarProfile(actor, profileId = null) {
  return updateProfiles(actor, state => {
    if (state.profiles.length < 2) throw new Error('The last hotbar profile cannot be deleted.');
    const id = profileId ?? state.active;
    const index = state.profiles.findIndex(p => p.id === id);
    if (index < 0) throw new Error('This hotbar profile no longer exists.');
    if (isBuiltinHotbarProfile(id)) throw new Error('Built-in profiles cannot be deleted.');
    state.profiles.splice(index, 1);
    if (state.active === id) state.active = state.profiles[Math.max(0, index - 1)].id;
  });
}
export const defaultHotbarProfileAccent = id => BUILTIN_PROFILES.find(profile => profile.id === id)?.accent ?? null;
export const hotbarProfileAccent = (actor, id) => {
  const profile = hotbarProfiles(actor).profiles.find(profile => profile.id === id);
  return profile?.accent || defaultHotbarProfileAccent(id);
};
export async function setHotbarProfileAccent(actor, id, color) {
  const normalized = color === null ? null : normalizeButtonColor(color);
  if (color !== null && !normalized) throw new Error('Use a six-digit HEX color.');
  return updateProfiles(actor, state => {
    const profile = state.profiles.find(profile => profile.id === id);
    if (!profile) throw new Error('This hotbar profile no longer exists.');
    profile.accent = normalized;
  });
}
/** Move a custom profile; built-ins always remain pinned at the left. */
export async function reorderHotbarProfile(actor, id, beforeId = null) {
  return updateProfiles(actor, state => {
    if (isBuiltinHotbarProfile(id) || (beforeId !== null && isBuiltinHotbarProfile(beforeId)))
      throw new Error('Built-in profiles cannot be reordered.');
    const from = state.profiles.findIndex(p => p.id === id);
    if (from < 0) throw new Error('Unknown hotbar profile.');
    const [moving] = state.profiles.splice(from,1);
    const to = beforeId === null ? state.profiles.length : state.profiles.findIndex(p => p.id === beforeId);
    if (to < 0) throw new Error('Target hotbar profile no longer exists.');
    state.profiles.splice(to,0,moving);
  });
}
/** Optimistic, serialized profile activation. Rapid changes coalesce to the
 * latest requested profile and never race saves into an older selection. */
export function hasPendingHotbarSelection(actor) {
  return Boolean(actor && pendingSelection.has(actor));
}
/** Wait for a rapid-switch save before maintenance replaces profile state. */
export async function awaitHotbarSelection(actor) {
  if (actor && pendingSelection.has(actor)) await pendingSelection.get(actor);
}
export function switchHotbarProfileFast(actor, id) {
  if (!actor?.isOwner || typeof actor.setFlag !== 'function')
    return Promise.reject(new Error('Actor ownership required to switch profiles'));
  const next = hotbarProfiles(actor);
  if (!next.profiles.some(profile => profile.id === id))
    return Promise.reject(new Error('This hotbar profile no longer exists.'));
  next.active = id;
  optimisticProfile.set(actor, next);
  if (pendingSelection.has(actor)) return pendingSelection.get(actor);
  const task = (async () => {
    // Batch rapid tab clicks into one save whenever possible.
    await Promise.resolve();
    while (optimisticProfile.has(actor)) {
      const target = optimisticProfile.get(actor);
      await actor.setFlag(MODULE_ID, HOTBAR_PROFILES_FLAG, target);
      if (optimisticProfile.get(actor) === target) optimisticProfile.delete(actor);
    }
  })();
  pendingSelection.set(actor, task);
  void task.finally(() => {
    pendingSelection.delete(actor);
    // On failure the next render reads the authoritative Actor flag.
    optimisticProfile.delete(actor);
  }).catch(() => {});
  return task;
}

export async function selectHotbarProfile(actor, id) {
  return updateProfiles(actor, state => {
    if (!state.profiles.some(p => p.id === id)) throw new Error('This hotbar profile no longer exists.');
    state.active = id;
  });
}
export async function saveHotbarDimensions(actor, { rows, columns }) {
  return updateProfiles(actor, state => {
    const profile = currentProfile(state);
    if (rows !== undefined) profile.rows = clampDimension(rows, 20, profile.rows);
    if (columns !== undefined) profile.columns = clampDimension(columns, 20, profile.columns);
  });
}
export function hotbarSlotColor(actor, slot) {
  return activeHotbarProfile(actor).colors?.[String(slot)] || null;
}
export async function setHotbarSlotColor(actor, slot, color) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_HOTBAR_SLOTS) throw new Error('Invalid hotbar slot.');
  const normalized = color === null ? null : normalizeButtonColor(color);
  if (color !== null && !normalized) throw new Error('Use a six-digit HEX color, for example #AABBCC.');
  return updateProfiles(actor, state => {
    const profile = currentProfile(state);
    profile.colors ||= {};
    if (normalized) profile.colors[String(slot)] = normalized;
    else delete profile.colors[String(slot)];
  });
}
export async function resetAllHotbarColors(actor) {
  return updateProfiles(actor, state => {
    for (const profile of state.profiles) profile.colors = {};
  });
}
export function storedHotbarSlots(actor) { return activeHotbarProfile(actor).slots.slice(); }
export async function saveHotbarSlots(actor, slots, { from = null, to = null } = {}) {
  if (!Array.isArray(slots)) throw new TypeError('Hotbar slots must be an array');
  const clean = cleanSlots(slots);
  await updateProfiles(actor, state => {
    const profile = currentProfile(state);
    if (Number.isInteger(to)) {
      profile.colors ||= {};
      if (Number.isInteger(from) && from !== to) {
        const first = profile.colors[String(from)];
        const second = profile.colors[String(to)];
        if (first) profile.colors[String(to)] = first; else delete profile.colors[String(to)];
        if (second) profile.colors[String(from)] = second; else delete profile.colors[String(from)];
      } else delete profile.colors[String(to)]; // Replacing/removing an action resets its slot color.
    }
    profile.slots = clean;
  });
  return clean;
}
export function storedHotbarRowDividers(actor) { return [...activeHotbarProfile(actor).rowDividers]; }
/** Safe/read-only per-profile divider names; legacy profiles default to unnamed. */
export function hotbarDividerLabels(actor) {
  const profile = activeHotbarProfile(actor);
  return cleanDividerLabels(profile?.dividerLabels, profile?.dividers || [], profile?.rowDividers || []);
}
export async function setHotbarDividerLabel(actor, axis, boundary, text) {
  if (!['columns','rows'].includes(axis) || !Number.isInteger(boundary) || boundary < 1 || boundary >= 20)
    throw new Error('Invalid divider boundary.');
  const label = normalizeDividerLabel(text);
  return updateProfiles(actor, state => {
    const profile = currentProfile(state);
    const boundaries = axis === 'columns' ? profile.dividers : profile.rowDividers;
    if (!boundaries.includes(boundary)) throw new Error('This divider no longer exists.');
    profile.dividerLabels ||= {columns:{},rows:{}};
    profile.dividerLabels[axis] ||= {};
    if (label) profile.dividerLabels[axis][String(boundary)] = label;
    else delete profile.dividerLabels[axis][String(boundary)];
  });
}
async function saveDividerAxis(actor, axis, values, {moveFrom = null, moveTo = null} = {}) {
  const normalized = normalizeHotbarDividers(values);
  await updateProfiles(actor, state => {
    const profile = currentProfile(state);
    const field = axis === 'columns' ? 'dividers' : 'rowDividers';
    const labels = cleanDividerLabels(profile.dividerLabels,profile.dividers,profile.rowDividers);
    const existing = labels[axis];
    // Dragging a divider carries its label. Removing a divider removes its label.
    if (Number.isInteger(moveFrom) && Number.isInteger(moveTo) && moveFrom !== moveTo) {
      const label = existing[String(moveFrom)];
      delete existing[String(moveFrom)];
      if (label) existing[String(moveTo)] = label;
    }
    profile[field] = normalized;
    profile.dividerLabels = cleanDividerLabels(labels,profile.dividers,profile.rowDividers);
  });
  return normalized;
}
export const saveHotbarRowDividers = (actor, values, options={}) => saveDividerAxis(actor,'rows',values,options);
export function hotbarRowTracks(rows, dividers, labels = {}) {
  const selected = new Set(normalizeHotbarDividers(dividers));
  return Array.from({length: rows}, (_, index) => {
    if (!selected.has(index)) return 'var(--zft-button-height)';
    const extra = labels[String(index)] ? '--zft-divider-label-extra' : '--zft-divider-extra';
    return `calc(var(--zft-button-height) + var(${extra}))`;
  }).join(' ');
}
export function storedHotbarDividers(actor) { return [...activeHotbarProfile(actor).dividers]; }
export const saveHotbarDividers = (actor, values, options={}) => saveDividerAxis(actor,'columns',values,options);
export function hotbarColumnTracks(columns, dividers) {
  const selected = new Set(normalizeHotbarDividers(dividers));
  return Array.from({length: columns}, (_, index) => index > 0 && selected.has(index)
    ? 'calc(var(--zft-button-width) + var(--zft-divider-extra))' : 'var(--zft-button-width)').join(' ');
}

/** Fixed slots. Swaps on slot-to-slot drops; external actions replace a slot. */
export function assignHotbarSlot(slots, to, ref, from = null) {
  if (!Number.isInteger(to) || to < 0 || to >= MAX_HOTBAR_SLOTS) return slots.slice();
  const next = slots.slice(0, MAX_HOTBAR_SLOTS);
  if (from !== null && (!Number.isInteger(from) || from < 0 || from >= MAX_HOTBAR_SLOTS)) return next;
  if (from === to) return next;
  if (from !== null) {
    const displaced = next[to] || null;
    next[to] = next[from] || null;
    next[from] = displaced;
  } else next[to] = ref || null;
  return next;
}
