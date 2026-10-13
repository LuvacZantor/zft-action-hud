/** D&D5e 5.2.x Item equipment & attunement data. No core dependence on D&D fields. */
export function dnd5eItemControls(item, actor) {
  const data = item?.system ?? {};
  const owned = Boolean(actor?.isOwner && item?.isOwner);
  const equip = typeof data.equipped === 'boolean';
  // D&D5e 5.x: attunement = "required" | "optional" | ""; attuned is Boolean.
  const canAttune = ['required', 'optional'].includes(data.attunement) && typeof data.attuned === 'boolean';
  return {
    equip: equip ? { state: Boolean(data.equipped), editable: owned,
      title: data.equipped ? 'Unequip item' : 'Equip item' } : null,
    attune: canAttune ? { state: Boolean(data.attuned), editable: owned,
      title: data.attuned ? 'End attunement' : 'Attune to item' } : null
  };
}

/** Update the embedded Item using the native D&D5e field; never keep a duplicate in HUD flags. */
export async function toggleDnd5eItemState(actor, id, kind) {
  const item = actor?.items?.get(id);
  if (!actor?.isOwner || !item?.isOwner) throw new Error('Item ownership is required.');
  const controls = dnd5eItemControls(item, actor);
  const control = kind === 'equip' ? controls.equip : kind === 'attune' ? controls.attune : null;
  if (!control?.editable) throw new Error('That Item state cannot be changed.');
  if (kind === 'attune' && !control.state) {
    const slots = actor.system?.attributes?.attunement;
    const current = Number(slots?.value), max = Number(slots?.max);
    if (Number.isFinite(max) && max >= 0 && Number.isFinite(current) && current >= max)
      throw new Error('No available attunement slots.');
  }
  await item.update({ [`system.${kind === 'equip' ? 'equipped' : 'attuned'}`]: !control.state });
  return true;
}
