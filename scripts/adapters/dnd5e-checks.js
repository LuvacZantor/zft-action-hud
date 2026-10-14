/** D&D5e skill/save presentation and native execution. No game rules live in HUD core. */
const ABILITIES = Object.freeze({
  str: { label:'Strength', color:'#DC5A5A', icon:'fa-solid fa-hand-fist' },
  dex: { label:'Dexterity', color:'#48B56A', icon:'fa-solid fa-shoe-prints' },
  con: { label:'Constitution', color:'#D68A3E', icon:'fa-solid fa-shield' },
  int: { label:'Intelligence', color:'#4A90E2', icon:'fa-solid fa-brain' },
  wis: { label:'Wisdom', color:'#35A6A0', icon:'fa-solid fa-eye' },
  cha: { label:'Charisma', color:'#A56CC1', icon:'fa-solid fa-masks-theater' }
});

const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const signed = value => value == null ? '—' : (value >= 0 ? `+${value}` : `${value}`);
const localize = value => typeof value === 'string' && value ? (globalThis.game?.i18n?.localize?.(value) || value) : '';
const labelFor = (id, configured, stored) => {
  const name = stored?.label ?? stored?.name ?? configured?.label ?? configured?.name;
  return localize(name) || id.replace(/[_-]/g, ' ').replace(/\b\w/g, match => match.toUpperCase());
};

export function getDnd5eChecksCategory(actor) {
  if (!actor?.system?.skills || !actor?.system?.abilities) return null;
  const definitions = globalThis.CONFIG?.DND5E?.skills ?? {};
  const skills = Object.entries(actor.system.skills).map(([id, skill]) => {
    if (!skill || typeof skill !== 'object') return null;
    const config = definitions[id];
    const ability = String(skill.ability || config?.ability || '').toLowerCase();
    const appearance = ABILITIES[ability] || { color:'#93A4B8', icon:'fa-solid fa-dice-d20' };
    // Derived values include feats, effects, proficiencies, and other modules.
    // Never invent a modifier by recalculating from raw Actor exports.
    const modifier = numeric(skill.total);
    const passive = numeric(skill.passive);
    const name = labelFor(id, config, skill);
    return {
      id, name, ability: ability ? ability.toUpperCase() : '—',
      abilityName: ABILITIES[ability]?.label || ability.toUpperCase() || 'Unknown',
      ...appearance, modifier: signed(modifier), passive: passive == null ? '—' : `${passive}`,
      passiveHint: passive == null ? 'Unavailable from derived Actor data' : `Passive ${name}: ${passive}`
    };
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const saves = Object.entries(ABILITIES).filter(([id]) => actor.system.abilities[id]).map(([id, appearance]) => {
    const save = actor.system.abilities[id]?.save;
    const total = numeric(save?.total) ?? numeric(save?.value) ?? numeric(save);
    return {
      id, name: `${appearance.label} Save`, ability: id.toUpperCase(), abilityName: appearance.label,
      icon: appearance.icon, color: appearance.color, modifier: signed(total)
    };
  });
  const total = skills.length + saves.length;
  return {
    id: 'checks', label: 'Checks', icon: 'fa-solid fa-dice-d20', count: total,
    isChecks: true,
    groups: [
      { id:'skills', label:'Skills', order:0, items:[], checks:skills, checkGroup:true, showPassive:true },
      { id:'saving-throws', label:'Saving Throws', order:1, items:[], checks:saves, checkGroup:true, showPassive:false }
    ]
  };
}

/** Three independent categories use the same Actor-derived values and fixed ability palette. */
export function getDnd5eRollCategories(actor) {
  const existing = getDnd5eChecksCategory(actor);
  if (!existing) return [];
  const abilities = Object.entries(ABILITIES).filter(([id]) => actor.system.abilities[id]).map(([id, appearance]) => {
    const data = actor.system.abilities[id];
    // D&D5e computes ability checks separately from saves. Never display the save total.
    const total = numeric(data?.check?.total) ?? numeric(data?.check?.value) ?? numeric(data?.mod);
    return { id, name: `${appearance.label} Check`, ability:id.toUpperCase(), abilityName:appearance.label,
      icon: appearance.icon, color:appearance.color, modifier:signed(total) };
  });
  const checkCategory = (id, label, icon, checkKind, group) => ({
    id, label, icon, count:group.checks.length, secondary:true, isChecks:true,
    groups:[{...group, id, label, showPassive:checkKind==='skill', rollKind:checkKind,
      rollLabel: checkKind === 'save' ? 'saving throw' : `${checkKind} check` }]
  });
  return [
    checkCategory('abilities','Abilities','fa-solid fa-dice-d20','ability',
      {checks:abilities,items:[],checkGroup:true}),
    checkCategory('saves','Saves','fa-solid fa-shield','save',existing.groups[1]),
    checkCategory('skills','Skills','fa-solid fa-list-check','skill',existing.groups[0])
  ];
}

/** Registered, Actor-owned tool proficiencies, including custom tool identifiers.
 * These are separate from physical Tool Items and use the native Actor roll API. */
export function getDnd5eToolChecks(actor) {
  const tools = actor?.system?.tools || {};
  const definitions = { ...(globalThis.CONFIG?.DND5E?.tools || {}), ...(globalThis.CONFIG?.DND5E?.vehicleTypes || {}) };
  return Object.entries(tools).filter(([,data]) => data && typeof data === 'object').map(([id, data]) => {
    const config = definitions[id];
    const ability = String(data.ability || config?.ability || '').toLowerCase();
    const appearance = ABILITIES[ability] || {icon:'fa-solid fa-screwdriver-wrench',color:'#93A4B8'};
    const proficiency = numeric(data.value);
    return {
      id, name:labelFor(id, config, data), ability:ability ? ability.toUpperCase() : '—',
      abilityName:ABILITIES[ability]?.label || 'Variable ability',
      ...appearance, modifier:signed(numeric(data.total)),
      proficiency:proficiency == null ? 'Proficiency not listed' : proficiency >= 2 ? 'Expertise' : proficiency >= 1 ? 'Proficient' : proficiency > 0 ? 'Half proficiency' : 'Not proficient'
    };
  }).sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Display tool Item data only when the Actor/system supplies a governing ability.
 * The activity may offer an alternate ability in the native dialog. The displayed
 * ability is a default, not a restriction or a prediction of the chosen roll. */
export function getDnd5eToolPresentation(actor, item) {
  if (item?.type !== 'tool') return null;
  const type = item.system?.type || {};
  const id = type.baseItem || item.system?.identifier;
  const tool = id ? actor?.system?.tools?.[id] : null;
  const activities = item.system?.activities;
  const activity = Array.from(typeof activities?.values === 'function' ? activities.values() : Object.values(activities || {}))
    .find(entry => entry?.type === 'check' && entry?.check?.ability);
  const ability = String(item.system?.ability || activity?.check?.ability || tool?.ability || '').toLowerCase();
  const appearance = ABILITIES[ability];
  // Tool modifiers depend on the chosen ability and Actor effects. Unavailable
  // derived values display a dash instead of fabricating proficiency arithmetic.
  const total = !tool?.ability || ability === String(tool.ability).toLowerCase() ? numeric(tool?.total) : null;
  const prof = numeric(tool?.value) ?? numeric(item.system?.proficient);
  const proficiency = prof == null ? 'Not listed' : prof >= 2 ? 'Expertise' : prof >= 1 ? 'Proficient' : prof > 0 ? 'Half proficiency' : 'Not proficient';
  return {
    ability:appearance ? ability.toUpperCase() : '—',
    icon:appearance?.icon || 'fa-solid fa-screwdriver-wrench',
    color:appearance?.color || '#93A4B8',
    name:appearance?.label || 'Variable ability',
    modifier:signed(total), proficiency,
    hint:appearance ? `Default ${appearance.label}. Native activity may offer another ability.` : 'Ability depends on the native tool check.'
  };
}

/** Adapter presentation of shortcuts for the general-purpose character hotbar.
 * Reuse the exact menu values so new features never recalculate check bonuses. */
export function getDnd5eCheckShortcuts(actor) {
  if (!actor?.system) return [];
  const categories = getDnd5eRollCategories(actor);
  const entries = categories.flatMap(category => (category.groups || []).flatMap(group =>
    (group.checks || []).map(check => ({...check, kind: group.rollKind}))));
  return [...entries, ...getDnd5eToolChecks(actor).map(check => ({...check, kind: 'tool'}))];
}

export function getDnd5eCheckShortcut(actor, kind, id) {
  return getDnd5eCheckShortcuts(actor).find(check => check.kind === kind && check.id === id) || null;
}

/** Invoke the native D&D5e roll API, including its dialogs, hooks and permissions. */
export async function rollDnd5eCheck(actor, kind, id) {
  if (!actor?.isOwner) return { status:'denied' };
  if (kind === 'ability' && Object.hasOwn(ABILITIES, id) && actor.system?.abilities?.[id]) {
    if (typeof actor.rollAbilityCheck !== 'function') return { status:'unsupported' };
    const result = await actor.rollAbilityCheck({ ability:id });
    return { status:result == null ? 'cancelled' : 'used', result };
  }
  if (kind === 'tool' && Object.hasOwn(actor.system?.tools ?? {}, id)) {
    if (typeof actor.rollToolCheck !== 'function') return { status:'unsupported' };
    const result = await actor.rollToolCheck({ tool:id });
    return { status:result == null ? 'cancelled' : 'used', result };
  }
  if (kind === 'skill' && Object.hasOwn(actor.system?.skills ?? {}, id)) {
    if (typeof actor.rollSkill !== 'function') return { status:'unsupported' };
    const result = await actor.rollSkill({ skill:id });
    return { status:result == null ? 'cancelled' : 'used', result };
  }
  if (kind === 'save' && Object.hasOwn(ABILITIES, id) && actor.system?.abilities?.[id]) {
    if (typeof actor.rollSavingThrow !== 'function') return { status:'unsupported' };
    const result = await actor.rollSavingThrow({ ability:id });
    return { status:result == null ? 'cancelled' : 'used', result };
  }
  return { status:'unsupported' };
}
