/** Read-only D&D5e resource presentation. Values always come from native
 * Actor/Item/Activity data; never store or modify consumable counters.
 */
import { remainingUses } from './dnd5e-visibility.js';

function finite(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function values(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.values === 'function') return [...collection.values()];
  return Object.values(collection);
}
function usesResource(source, label, kind) {
  const value = remainingUses(source);
  if (!value) return null;
  const display = `${value.remaining}/${value.maximum}`;
  return {kind, label, display, compact:display,
    detail:`${label}: ${value.remaining} of ${value.maximum} remaining`,
    depleted:value.remaining === 0};
}

/** Item and Activity use pools are independent in native D&D5e.
 * Show all genuine pools and meaningful quantities, not inferred consumption.
 */
export function getDnd5eItemResources(item, selectedActivity = null) {
  if (!item) return [];
  const result = [];
  const subType = String(item.system?.type?.value ?? '').toLowerCase();
  // Not every limited-use piece of equipment spends "charges". Only use
  // that label for recognizable charged types; otherwise show neutral Uses.
  const isCharged = ['wand','rod','staff'].includes(subType);
  const itemUses = usesResource(item.system?.uses, isCharged ? 'Charges' : 'Uses', 'itemUses');
  if (itemUses) result.push(itemUses);

  // Only summarize Activity uses when one Activity is selected or the Item
  // has exactly one Activity. Never attribute one activity's pool to all others.
  const available = values(item.system?.activities);
  const activity = selectedActivity ?? (available.length === 1 ? available[0] : null);
  const activityUses = usesResource(activity?.uses, 'Activity Uses', 'activityUses');
  if (activityUses) result.push(activityUses);

  const quantity = finite(item.system?.quantity?.value ?? item.system?.quantity);
  const ammo = item.type === 'consumable' && subType === 'ammo';
  const expendable = item.type === 'consumable';
  // Stack quantity=1 on non-consumable gear is ordinary ownership, not a
  // resource worth showing. Multi-item stacks can be useful in Inventory.
  if (quantity !== null && (expendable || quantity > 1)) {
    const label = ammo ? 'Ammunition' : 'Quantity';
    result.push({kind:'quantity',label,display:String(quantity),compact:`×${quantity}`,
      detail:`${label}: ${quantity} remaining`,depleted:quantity === 0});
  }
  return result;
}

/** Native Actor resource pools with an explicit name and numeric value/max. */
export function getDnd5eActorResources(actor) {
  const pools = actor?.system?.resources;
  if (!pools || typeof pools !== 'object') return [];
  return values(pools).flatMap(pool => {
    if (!pool || typeof pool !== 'object') return [];
    const label = String(pool.label ?? pool.name ?? '').trim();
    const max = finite(pool.max), value = finite(pool.value);
    if (!label || !max || value === null) return [];
    return [{label:label.slice(0,80),current:Math.min(value,max),max,
      title:`${label}: ${Math.min(value,max)} of ${max} remaining`,depleted:value === 0}];
  });
}
