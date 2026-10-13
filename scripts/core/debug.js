import { MODULE_ID, VERSION } from './settings.js';
/** Console-only diagnostics. World setting affects clients, but does not upload logs. */
export function isDebugEnabled() {
  try { return Boolean(game.settings.get(MODULE_ID, 'clientDebugLogging') || game.settings.get(MODULE_ID, 'gmDebugLogging')); }
  catch { return false; }
}
export function debugLog(...details) {
  if (isDebugEnabled()) console.debug(`[ZFT] 🔍 v${VERSION} | Action HUD |`, ...details);
}
