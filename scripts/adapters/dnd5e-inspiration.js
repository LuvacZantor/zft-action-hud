/** D&D5e inspiration read/write adapter. GM can grant or remove; players can only spend. */
export function getDnd5eInspiration(actor) {
  const value = actor?.system?.attributes?.inspiration;
  if (typeof value !== 'boolean') return null;
  return value;
}

export function canChangeDnd5eInspiration(actor, nextValue, isGM = Boolean(globalThis.game?.user?.isGM)) {
  const current = getDnd5eInspiration(actor);
  if (current === null || !actor?.isOwner || typeof nextValue !== 'boolean') return false;
  return Boolean(isGM) || (current === true && nextValue === false);
}

export async function setDnd5eInspiration(actor, nextValue) {
  if (!canChangeDnd5eInspiration(actor, nextValue)) return { status: 'denied' };
  if (getDnd5eInspiration(actor) === nextValue) return { status: 'unchanged' };
  await actor.update({ 'system.attributes.inspiration': nextValue });
  return { status: 'updated', value: nextValue };
}
