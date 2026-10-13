/**
 * D&D5e spell slots are native Actor data (remaining .value / derived .max).
 * No module flags or secondary resource tracker. D&D5e 5.2.5 / Foundry V13
 * is the development target; verify separately under D&D5e 6 / Foundry V14.
 */
const SLOT_KEYS = Object.freeze([...Array.from({ length: 9 }, (_, i) => `spell${i + 1}`), 'pact']);
const ORDINALS = Object.freeze(['', '1st', '2nd', '3rd', ...Array.from({ length: 6 }, (_, i) => `${i + 4}th`)]);

/** Return only native pools with a positive maximum. Never invent capacity. */
export function getDnd5eSpellSlots(actor) {
  const pools = actor?.system?.spells;
  if (!pools || typeof pools !== 'object') return [];
  return SLOT_KEYS.flatMap(key => {
    const pool = pools[key];
    const max = Number(pool?.max);
    if (!Number.isSafeInteger(max) || max <= 0) return [];
    const rawValue = Number(pool.value);
    const value = Number.isFinite(rawValue) ? Math.max(0, Math.min(max, Math.trunc(rawValue))) : 0;
    const level = key === 'pact' ? Number(pool?.level) : Number(key.slice(5));
    const label = key === 'pact'
      ? `Pact${Number.isInteger(level) && level > 0 ? ` (Lv ${level})` : ''}`
      : `Lv ${level}`;
    return [{ id: key, label, current: value, max, atMaximum: value >= max,
      canEdit: Boolean(actor?.isOwner),
      decreaseLabel: `Expend one ${label} spell slot`,
      increaseLabel: `Restore one ${label} spell slot`,
      tooltip: `${key === 'pact' ? 'Pact Magic' : `${ORDINALS[level] || level} level`} slots: ${value} of ${max} available` }];
  });
}

/** Updates only the native value. The system retains authority over max and uses. */
export async function adjustDnd5eSpellSlot(actor, slotId, delta) {
  if (!actor?.isOwner) throw new Error('Actor ownership is required to change spell slots.');
  if (!SLOT_KEYS.includes(slotId) || (delta !== 1 && delta !== -1)) throw new Error('Invalid spell slot adjustment.');
  const pool = getDnd5eSpellSlots(actor).find(slot => slot.id === slotId);
  if (!pool) throw new Error('That spell slot pool is not available.');
  const next = Math.max(0, Math.min(pool.max, pool.current + delta));
  if (next === pool.current) return false;
  await actor.update({ [`system.spells.${slotId}.value`]: next });
  return true;
}
