/**
 * D&D5e 5.x Activity presentation only. It never rolls, consumes, or estimates
 * conditional automation results. Display stored dice/formulae and native labels.
 * Core HUD renders adapter-supplied summaries without knowing D&D mechanics.
 */
function values(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.values === 'function') return Array.from(collection.values());
  return Object.values(collection);
}

export function diceExpression(part) {
  if (!part || typeof part !== 'object') return '';
  const custom = part.custom;
  if (custom?.enabled && String(custom.formula ?? '').trim()) return String(custom.formula).trim();
  const n = Number(part.number);
  const faces = Number(part.denomination);
  const base = Number.isFinite(n) && n > 0 && Number.isFinite(faces) && faces > 0
    ? `${n}d${faces}` : '';
  const bonus = String(part.bonus ?? '').trim();
  if (!base) return bonus;
  if (!bonus) return base;
  return `${base}${bonus.startsWith('-') ? ' - ' + bonus.slice(1).trim() : ' + ' + bonus.replace(/^\+\s*/, '')}`;
}

/** Replace D&D5e roll-data references without making a die roll. We only
 * evaluate deterministic numeric functions (min, max, floor, ceil, abs).
 * Dice terms remain literal, e.g. "1d12 + 5". */
export function resolveActivityFormula(formula, rollData = {}) {
  let text = String(formula ?? '').trim();
  if (!text) return '';
  const native = globalThis.Roll?.replaceFormulaData;
  if (typeof native === 'function') {
    try { text = native.call(globalThis.Roll, text, rollData, { missing: null }); }
    catch (error) { console.warn('[ZFT] Could not resolve native Activity formula', error); }
  }
  // Fallback for the rollData paths supported by the current system. Never
  // replace unknown references with zero or guess character modifiers.
  text = text.replace(/@([a-zA-Z_][\w.]*)/g, (token, path) => {
    const value = path.split('.').reduce((object, key) => object?.[key], rollData);
    return Number.isFinite(Number(value)) && value !== undefined && value !== null && value !== ''
      ? String(Number(value)) : token;
  });
  // Reduce numeric functions only. In particular, max(@abilities.str.mod,
  // @attributes.spell.mod) becomes max(3,5) -> 5, never a random roll.
  const funcs = {max: Math.max, min: Math.min, floor: Math.floor, ceil: Math.ceil, abs: Math.abs};
  for (let pass = 0; pass < 8; pass++) {
    const updated = text.replace(/\b(max|min|floor|ceil|abs)\(\s*(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*)\s*\)/gi,
      (raw, name, args) => {
        const nums = args.split(',').map(Number);
        if (!nums.length || nums.some(n => !Number.isFinite(n))) return raw;
        const value = funcs[name.toLowerCase()](...nums);
        return Number.isFinite(value) ? String(value) : raw;
      });
    if (updated === text) break;
    text = updated;
  }
  return text;
}

function damageText(part, data) {
  const formula = resolveActivityFormula(diceExpression(part), data);
  if (!formula) return '';
  const types = values(part.types).filter(Boolean).map(String);
  return `${formula}${types.length ? ` ${types.join('/')} ` : ''}`.trim();
}

function formatActivation(a) {
  if (!a?.type || ['none', 'special'].includes(a.type)) return a?.type === 'special' ? 'Special' : '';
  const amount = Number(a.value ?? a.cost);
  const count = Number.isFinite(amount) && amount > 0 ? amount : 1;
  const types = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', minute: 'Minute', hour: 'Hour', day: 'Day', legendary: 'Legendary Action', lair: 'Lair Action', crew: 'Crew Action' };
  const label = types[a.type] ?? String(a.type);
  return count === 1 ? label : `${count} ${label}${label.endsWith('s') ? '' : 's'}`;
}

export function formatDnd5eRange(range) {
  if (!range) return '';
  const value = range.value;
  const long = Number(range.long);
  const units = String(range.units ?? '').trim();
  if (value !== undefined && value !== null && String(value).trim()) {
    const distance = String(value).trim() + (Number.isFinite(long) && long > 0 ? `/${long}` : '');
    return `${distance}${units && units !== 'none' ? ` ${units}` : ''}`;
  }
  if (range.special) return String(range.special);
  if (units && !['none', 'ft'].includes(units)) return { self: 'Self', touch: 'Touch', any: 'Any' }[units] ?? units;
  return '';
}

function chooseActivityValue(override, value, fallback) {
  // D&D5e activities use an explicit override toggle for inherited Item fields.
  return override === true ? value : (fallback ?? value);
}

function activityDamage(activity, item, data) {
  const parts = [];
  const includeBase = activity.damage?.includeBase === true;
  const explicitParts = values(activity.damage?.parts).map(part => damageText(part, data)).filter(Boolean);
  if (includeBase && item.system?.damage?.base) {
    const base = damageText(item.system.damage.base, data);
    // Inherited base may already be represented in the native Activity parts.
    if (base && !explicitParts.includes(base)) parts.push(base);
  }
  parts.push(...explicitParts);
  const result = parts.join(' + ');
  const versatile = includeBase ? damageText(item.system?.damage?.versatile, data) : '';
  return { result, versatile };
}

function formatSave(save, data) {
  if (!save) return '';
  const abilities = typeof save.ability === 'string'
    ? [save.ability] : values(save.ability).filter(Boolean).map(String);
  const dc = save.dc ?? {};
  const dcText = resolveActivityFormula(String(dc.formula ?? dc.value ?? '').trim(), data);
  const label = abilities.length ? `${abilities.join('/').toUpperCase()} save` : 'Save';
  return dcText ? `${label} · DC ${dcText}` : label;
}

/** Mirrors D&D5e 5.2.x BaseActorSheet._prepareActivity:
 * it takes the deterministic `labels.modifier` from prepareSheetContext() and
 * displays it through dnd5e-formatModifier. No attack bonus calculation here.
 * Save DC and ability likewise come from the native Activity sheet context. */
export function nativeActivityRoll(activity) {
  let context;
  try { context = typeof activity?.prepareSheetContext === 'function'
    ? activity.prepareSheetContext() : null; }
  catch (error) { console.warn('[ZFT] ⚠️ Could not read native D&D5e Activity sheet context', error); }
  if (String(activity?.type) === 'attack') {
    const raw = context?.labels?.modifier ?? activity?.labels?.modifier;
    const total = parseInt(String(raw ?? ''), 10);
    // Match D&D5e 5.2.x BaseActorSheet._prepareActivity: it takes parseInt
    // from the system-derived labels.modifier, rather than recomputing to-hit.
    if (Number.isFinite(total))
      return { label: 'Roll', value: total >= 0 ? `+${total}` : String(total) };
    return null;
  }
  if (String(activity?.type) === 'save') {
    const save = context?.save;
    const dc = Number(save?.dc?.value);
    if (!Number.isFinite(dc) || save?.dc?.value == null) return null;
    const ability = typeof save.ability === 'string' ? save.ability
      : (typeof save.ability?.values === 'function' ? [...save.ability.values()].join('/') : '');
    return {label:'Roll',value:`${ability ? ability.toUpperCase()+' Save · ' : ''}DC ${dc}`};
  }
  return null;
}

function typeName(type) {
  return ({ attack: 'Attack', damage: 'Damage', heal: 'Healing', save: 'Saving Throw', utility: 'Utility', cast: 'Cast Spell', summon: 'Summon', enchant: 'Enchantment', check: 'Ability Check' })[type] ?? String(type || 'Activity');
}

export function summarizeActivity(activity, item, data = {}) {
  const type = String(activity.type ?? 'utility');
  const activation = chooseActivityValue(activity.activation?.override, activity.activation, item.system?.activation);
  const range = chooseActivityValue(activity.range?.override, activity.range, item.system?.range);
  const stats = [];
  const add = (label, value) => { if (value) stats.push({ label, value: String(value) }); };
  add('Activation', formatActivation(activation));
  add('Range', formatDnd5eRange(range));
  const { result: damage, versatile } = activityDamage(activity, item, data);
  add('Damage', damage);
  if (versatile) add('Versatile', versatile);
  if (type === 'heal') add('Healing', damageText(activity.healing, data));
  const nativeRoll = nativeActivityRoll(activity);
  if (nativeRoll) add(nativeRoll.label, nativeRoll.value);
  else if (type === 'save') add('Save', formatSave(activity.save, data));
  // Only show the raw activity bonus when the native calculated Roll column
  // isn't available; raw attack.bonus by itself is NOT the to-hit total.
  if (type === 'attack' && !nativeRoll && activity.attack?.bonus)
    add('Additional attack bonus (not total)', resolveActivityFormula(activity.attack.bonus, data));
  if (type === 'cast') {
    const spell = activity.spell;
    const label = spell?.level != null && spell.level !== '' ? `Level ${spell.level}` : '';
    add('Spell', label);
  }
  const usages = values(activity.consumption?.targets)
    .filter(target => target?.type === 'itemUses' && Number(target.value) > 0)
    .map(target => `${target.value} use${Number(target.value) === 1 ? '' : 's'}`);
  if (usages.length) add('Cost', usages.join(', '));
  const uses = activity.uses;
  if (uses?.max != null && String(uses.max).trim() && Number.isFinite(Number(uses.max))) {
    const remaining = Math.max(0, Number(uses.max) - Number(uses.spent ?? 0));
    add('Activity uses', `${remaining}/${uses.max}`);
  }
  return {
    id: activity.id ?? activity._id ?? '',
    name: String(activity.name ?? '').trim() || typeName(type),
    kind: typeName(type), stats
  };
}

export function collectActivitySummaries(item, selectedActivity = null, data = null) {
  const rollData = data || item?.getRollData?.() || item?.parent?.getRollData?.() || {};
  const activities = selectedActivity ? [selectedActivity] : values(item?.system?.activities);
  return activities.map(activity => summarizeActivity(activity, item, rollData));
}
