import { registerSettings, MODULE_ID, VERSION } from './core/settings.js';
import { registerSystemAdapter, getSystemAdapter } from './adapters/registry.js';
import { dnd5eAdapter } from './adapters/dnd5e.js';
import { ZFTActionHud } from './core/hud-app.js';
import { debugLog } from './core/debug.js';
import { hasPendingHotbarSelection } from './core/actor-quick-access.js';

const LOG = `[ZFT] 🛠️ v${VERSION} | Action HUD`;
let app;

Hooks.once('init', () => {
  registerSettings();
  registerSystemAdapter(dnd5eAdapter);
  debugLog('Settings and system adapters registered');
});

Hooks.once('ready', async () => {
  const adapter = getSystemAdapter();
  if (!adapter) {
    console.warn(`${LOG} | No adapter registered for ${game.system?.id}; skipping HUD`);
    return;
  }
  app = new ZFTActionHud();
  window.ZFTActionHud = Object.freeze({
    refresh: () => app?.refresh(),
    refreshHotbar: () => { app?._customHotbar?.render(app?._actor); app?.syncHotbarToggle?.(); app?._settingsWindow?.syncPreferences?.(); },
    syncCombatProfile: () => app?._customHotbar?.syncCombatProfile(),
    refreshMacroLibraries: () => { app?._macroLibraries?.refresh(); app?.refresh(); },
    applyAppearance: () => app?.applyAppearance(),
    applyCategoryButtonColors: () => app?.applyCategoryButtonColors?.(),
    setPositionMode: mode => app?._setPositionMode(mode),
    syncHudPositionLock: () => { app?._syncPositionControl?.(); app?._settingsWindow?.syncPreferences?.(); }
  });

  // Migrate/synchronize the new visible position control with the existing
  // saved mode. This preserves the user's dev.11 locked/unlocked preference.
  const savedMode = game.settings.get(MODULE_ID, 'hudPosition')?.mode;
  if (['docked', 'floating'].includes(savedMode) &&
      game.settings.get(MODULE_ID, 'hudPositionMode') !== savedMode) {
    await game.settings.set(MODULE_ID, 'hudPositionMode', savedMode);
  }

  const update = () => app?.refresh();
  Hooks.on('controlToken', () => { void (async () => {
    await app?.refresh();
    await app?._customHotbar?.syncCombatProfile();
  })(); });
  Hooks.on('updateActor', (actor, changes) => {
    if (actor?.id !== app?._actor?.id) return;
    // HP-only updates can happen frequently. Never rebuild the action browser for these.
    const keys = Object.keys(changes || {});
    // Profile flag writes must not force a complete HUD or hotbar rebuild.
    // Optimistic tab switching already updates the visible grid immediately.
    if (keys.length && keys.every(key => key === '_id' || key === 'flags' ||
        key.startsWith('flags.zft-action-hud.hotbarProfiles')) &&
        (changes.flags?.[MODULE_ID]?.hotbarProfiles !== undefined ||
         keys.some(key => key.startsWith('flags.zft-action-hud.hotbarProfiles')))) {
      // Local optimistic switching has already updated its UI. Remote Actor
      // profile edits should still refresh the custom hotbar on this client.
      if (!hasPendingHotbarSelection(actor)) app?._customHotbar?.render(actor);
      return;
    }
    const system = changes?.system || {};
    const sysKeys = Object.keys(system);
    const flattenedHp = keys.some(key => /^system\.attributes\.(hp|death)(\.|$)/.test(key));
    const hpOnly = keys.every(key => ['system','_id'].includes(key) ||
      /^system\.attributes\.(hp|death)(\.|$)/.test(key)) &&
      sysKeys.every(key => key === 'attributes' || key === 'attributes.hp' || key === 'attributes.death') &&
      Object.keys(system.attributes || {}).every(key => key === 'hp' || key === 'death') &&
      (sysKeys.length > 0 || flattenedHp);
    const inspirationOnly = keys.every(key => ['system', '_id', 'system.attributes.inspiration'].includes(key)) &&
      Object.keys(system).every(key => key === 'attributes') &&
      Object.keys(system.attributes || {}).every(key => key === 'inspiration') &&
      (keys.includes('system') || keys.includes('system.attributes.inspiration'));
    if (hpOnly) app?._refreshActorSummary();
    else if (inspirationOnly) app?._refreshInspiration();
    else update();
  });
  for (const hook of ['createItem', 'updateItem', 'deleteItem']) {
    Hooks.on(hook, item => {
      if (item?.parent?.id === app?._actor?.id) update();
    });
  }
  // Native Actor effects, statuses, combat rounds, and game-time duration updates.
  for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect']) {
    Hooks.on(hook, effect => {
      if (effect?.parent?.uuid === app?._actor?.uuid ||
          (effect?.parent?.id && effect.parent.id === app?._actor?.id)) update();
    });
  }
  const combatChange = () => {
    app?._refreshEffectsDurations();
    void app?._customHotbar?.syncCombatProfile();
  };
  for (const name of ['createCombat','updateCombat','deleteCombat','createCombatant','deleteCombatant','updateCombatant'])
    Hooks.on(name, combatChange);
  Hooks.on('updateWorldTime', () => {
    if (app?._actor && game.settings.get(MODULE_ID, 'showActiveEffects')) app?._refreshEffectsDurations();
  });
  // Foundry Macro Directory edits reflect in open floating libraries immediately.
  for (const hook of ['createMacro','updateMacro','deleteMacro','createFolder','updateFolder','deleteFolder']) {
    Hooks.on(hook, () => {
      app?._macroLibraries?.refresh();
      if (hook.endsWith('Folder')) app?._settingsWindow?.syncPreferences?.();
    });
  }
  Hooks.on('canvasReady', update);
  // Foundry's Configure Player Character assignment can change while the HUD
  // remains open. Only refresh the current client's HUD for their own User.
  Hooks.on('updateUser', user => {
    if (user?.id === game.user?.id) update();
  });

  try {
    if (game.settings.get(MODULE_ID, 'enabled')) {
      await app.render(true);
      await app._customHotbar.syncCombatProfile();
    }
    debugLog(`Preview ready (Foundry ${game.version}, ${game.system.id} ${game.system.version})`);
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
    console.error(`[ZFT] ❌ v${VERSION} | HUD preview failed to initialize | ${detail}`, error);
    ui.notifications?.error('ZFT Action HUD could not initialize. See browser console for error.');
  }
});
