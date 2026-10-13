/** D&D5e HP adjustments. Keep all system-dependent mutation out of HUD core.
 * Damage consumes temporary HP before regular HP. Healing cannot exceed effective max.
 * Manual Temp HP setting replaces the current value (including lower values or zero).
 * Never change defeated/death saves.
 */
export function calculateHpUpdate(hp, mode, amount = 0) {
  const value = Number(hp?.value);
  const max = Number(hp?.max);
  const temp = Number(hp?.temp ?? 0);
  const tempmax = Number(hp?.tempmax ?? 0);
  if (![value, max, temp, tempmax].every(Number.isFinite) || max < 0 || temp < 0) return null;
  const number = Number(amount);
  if (!['damage','heal','temp','full','zero'].includes(mode)) return null;
  if (['damage','heal'].includes(mode) && (!Number.isSafeInteger(number) || number < 1 || number > 999999)) return null;
  if (mode === 'temp' && (!Number.isSafeInteger(number) || number < 0 || number > 999999)) return null;
  const limit = Math.max(0, max + tempmax);
  const updates = {};
  switch (mode) {
    case 'damage': {
      const consumedTemp = Math.min(temp, number);
      updates['system.attributes.hp.temp'] = temp - consumedTemp;
      updates['system.attributes.hp.value'] = Math.max(0, value - (number - consumedTemp));
      break;
    }
    case 'heal':
      updates['system.attributes.hp.value'] = Math.min(limit, value + number);
      break;
    case 'temp':
      updates['system.attributes.hp.temp'] = number;
      break;
    case 'full':
      updates['system.attributes.hp.value'] = limit;
      break;
    case 'zero':
      updates['system.attributes.hp.value'] = 0;
      updates['system.attributes.hp.temp'] = 0;
      break;
  }
  return updates;
}

export async function adjustDnd5eHp(actor, mode, amount) {
  if (!actor?.isOwner || !actor?.system?.attributes?.hp || typeof actor.update !== 'function') {
    return { status: 'denied' };
  }
  const updates = calculateHpUpdate(actor.system.attributes.hp, mode, amount);
  if (!updates) return { status: 'invalid' };
  await actor.update(updates);
  return { status: 'updated' };
}
