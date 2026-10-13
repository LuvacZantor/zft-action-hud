/** System adapters provide only game-specific data, group definitions and execution. */
const adapters = new Map();

export function registerSystemAdapter(adapter) {
  if (!adapter?.systemId || typeof adapter.getCategories !== 'function') {
    throw new TypeError('Action HUD adapter must supply systemId and getCategories(actor).');
  }
  adapters.set(adapter.systemId, adapter);
}

export function getSystemAdapter(systemId = game.system?.id) {
  return adapters.get(systemId) ?? null;
}
