import { THEME_CHOICES } from '../themes/registry.js';
export const MODULE_ID = 'zft-action-hud';
export const VERSION = '0.1.1';
export const DEFAULT_POSITION = Object.freeze({ mode: 'docked', x: null, y: null }); // New clients anchor beside Foundry controls.

export function registerSettings() {
  game.settings.register(MODULE_ID, 'enabled', {
    name: 'Show Action HUD',
    hint: 'Show or hide the HUD for your browser only. Re-enable it here under Module Settings at any time; your HUD preferences, positions, and Favorites are preserved.',
    scope: 'client', config: true, type: Boolean, default: true,
    onChange: () => window.ZFTActionHud?.refresh?.()
  });
  game.settings.register(MODULE_ID, 'sharedMacroFolderId', {
    name: 'Shared Macro Library Folder', hint: 'GM-selected Macro Directory folder visible in the Shared Macros library. Players still need native Macro permissions.',
    scope: 'world', config: false, type: String, default: '',
    onChange: () => window.ZFTActionHud?.refreshMacroLibraries?.()
  });
  game.settings.register(MODULE_ID, 'gmMacroFolderId', {
    name: 'Personal GM Macro Folder', hint: 'Your private selection of Macro Directory folder for the GM utility library.',
    scope: 'client', config: false, type: String, default: '',
    onChange: () => window.ZFTActionHud?.refreshMacroLibraries?.()
  });
  // Macro sorting lives on the Foundry Folder (sorting 'a'/'m'), not in ZFT settings.
  for (const key of ['sharedMacroPosition', 'gmMacroPosition']) {
    game.settings.register(MODULE_ID, key, {scope:'client',config:false,type:Object,default:{x:null,y:null}});
  }
  game.settings.register(MODULE_ID, 'worldTheme', {
    name: 'Legacy Campaign HUD Theme (unused)',
    hint: 'Retained only to preserve old saved settings. Theme selection is personal-only.',
    scope: 'world', config: false, type: String, default: 'zft-default',
    choices: THEME_CHOICES,
    onChange: () => window.ZFTActionHud?.applyAppearance?.()
  });
  game.settings.register(MODULE_ID, 'allowThemeOverride', {
    name: 'Legacy Player Theme Override (unused)',
    hint: 'Retained only for backwards compatibility. Personal themes are always enabled.',
    scope: 'world', config: false, type: Boolean, default: true,
    onChange: () => window.ZFTActionHud?.applyAppearance?.()
  });
  game.settings.register(MODULE_ID, 'clientTheme', {
    name: 'Personal HUD Theme',
    hint: 'Choose a personal appearance. ZFT Default has no WebP texture overlay.',
    scope: 'client', config: true, type: String, default: 'zft-default',
    choices: THEME_CHOICES,
    onChange: () => window.ZFTActionHud?.applyAppearance?.()
  });
  // Legacy value retained to avoid destroying existing client preferences.
  // The HUD always uses the assigned character when no token is controlled.
  game.settings.register(MODULE_ID, 'useAssignedCharacterFallback', {
    scope: 'client', config: false, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, 'showThemeTextures', {
    name: 'Show Theme Background Textures',
    hint: 'Show or hide decorative artwork and patterns on both the Action HUD and Custom Hotbar. Theme colors and panel opacity are unchanged.',
    scope: 'client', config: true, type: Boolean, default: true,
    onChange: () => window.ZFTActionHud?.applyAppearance?.()
  });
  // Expose the existing lock/unlock behavior in Foundry Module Settings too.
  // hudPosition remains the authoritative stored state, including screen coordinates.
  game.settings.register(MODULE_ID, 'hudPositionMode', {
    name: 'HUD Position',
    hint: 'Dock Action HUD at the upper-left Foundry controls, or float it independently. Floating has a separate movement lock. Existing saved positions are preserved.',
    scope: 'client', config: true, type: String, default: 'docked',
    choices: { docked: 'Docked (upper left)', floating: 'Floating (draggable)' },
    onChange: mode => window.ZFTActionHud?.setPositionMode?.(mode)
  });
  game.settings.register(MODULE_ID, 'hudPosition', {
    scope: 'client', config: false, type: Object, default: { ...DEFAULT_POSITION }
  });
  // Floating movement lock is distinct from docking mode and from hotbar locks.
  game.settings.register(MODULE_ID, 'hudFloatingLocked', {
    name: 'Lock Floating Action HUD Position',
    hint: 'Prevent dragging when the HUD is floating. Docking and saved coordinates are unchanged.',
    scope: 'client', config: true, type: Boolean, default: false,
    onChange: () => window.ZFTActionHud?.syncHudPositionLock?.()
  });
  // The last floating coordinates survive a temporary switch to docked mode.
  game.settings.register(MODULE_ID, 'lastFloatingPosition', {
    scope: 'client', config: false, type: Object, default: { x: null, y: null }
  });
  game.settings.register(MODULE_ID, 'settingsWindowPosition', {
    scope: 'client', config: false, type: Object, default: { x: null, y: null }
  });
  game.settings.register(MODULE_ID, 'hudCollapsed', {
    scope: 'client', config: false, type: Boolean, default: false
  });
  game.settings.register(MODULE_ID, 'favoritesCollapsed', {
    scope: 'client', config: false, type: Boolean, default: true
  });
  // Legacy Favorites retained read-only for one-way migration to Actor flags.
  game.settings.register(MODULE_ID, 'favoritesByActor', {
    scope: 'client', config: false, type: Object, default: {}
  });
  // Recent actions share the collapsible quick-access area with Favorites.
  // Hotbar layout belongs to the Actor. Only presentation remains client-specific.
  for (const [key, name, hint, defaultValue] of [
    ['showCustomHotbar', 'Show Custom Hotbar', 'Display the independent, movable grid of Actor actions.', true],
    ['showHotbarLabels', 'Show Hotbar Item Labels', 'Show small white names on dark backgrounds over Item artwork.', true],
    ['hotbarLocked', 'Lock Hotbar Layout', 'Prevent action rearrangement and grid resizing. Position lock is separate.', true],
    ['hotbarPositionLocked', 'Lock Hotbar Position', 'Prevent hotbar movement without locking slot assignments. Both locks remain accessible on the hotbar.', true]
  ]) {
    game.settings.register(MODULE_ID, key, { name, hint, scope: 'client', config: true, type: Boolean,
      default: defaultValue, onChange: () => window.ZFTActionHud?.refreshHotbar?.() });
  }
  // Legacy per-client grid dimensions remain as migration defaults. New edits are Actor-profile scoped.
  for (const [key, label, maximum, initial] of [
    ['hotbarRows', 'Custom Hotbar Rows', 20, 2],
    ['hotbarColumns', 'Custom Hotbar Columns', 20, 6]
  ]) {
    game.settings.register(MODULE_ID, key, { name: label, hint: `Number from 1 to ${maximum}. Shrinking hides slots without deleting their assignments.`,
      scope: 'client', config: false, type: Number, default: initial,
      range: { min: 1, max: maximum, step: 1 }, onChange: () => window.ZFTActionHud?.refreshHotbar?.() });
  }
  game.settings.register(MODULE_ID, 'autoCombatProfile', {
    name: 'Automatically Switch to Combat Profile',
    hint: 'Enabled by default. When this character enters active combat, switch to the built-in Combat profile. Restore the previous profile afterward unless you switch manually.',
    scope: 'client', config: true, type: Boolean, default: true,
    onChange: () => window.ZFTActionHud?.syncCombatProfile?.()
  });
  game.settings.register(MODULE_ID, 'hotbarCollapsed', {
    name: 'Minimize Custom Hotbar',
    hint: 'Show only the hotbar header and profile tabs without removing saved actions.',
    scope: 'client', config: false, type: Boolean, default: false,
    onChange: () => window.ZFTActionHud?.refreshHotbar?.()
  });
  game.settings.register(MODULE_ID, 'hotbarUiScale', {
    name: 'Custom Hotbar UI Scale',
    hint: 'Resize only the custom hotbar. Independent of the main HUD UI Scale.',
    scope: 'client', config: true, type: Number, default: 1,
    range: { min: 0.5, max: 1.5, step: 0.05 },
    onChange: () => window.ZFTActionHud?.refreshHotbar?.()
  });
  // New clients always start docked; legacy 'auto' values still preserve existing float coordinates.
  game.settings.register(MODULE_ID, 'hotbarDockMode', {
    name: 'Custom Hotbar Docking',
    hint: 'New clients dock bottom-center. The first undock starts in that location; previously saved floating positions remain available.',
    scope: 'client', config: true, type: String, default: 'docked',
    choices: { auto: 'Automatic (preserve previous layout)', docked: 'Docked (bottom center)', floating: 'Floating (draggable)' },
    onChange: () => window.ZFTActionHud?.refreshHotbar?.()
  });
  game.settings.register(MODULE_ID, 'hotbarFloatingPosition', {
    scope: 'client', config: false, type: Object, default: { x: null, y: null }
  });
  game.settings.register(MODULE_ID, 'categoryButtonColors', {
    scope: 'client', config: false, type: Object, default: {},
    onChange: () => window.ZFTActionHud?.applyCategoryButtonColors?.()
  });
  game.settings.register(MODULE_ID, 'recentByActor', {
    scope: 'client', config: false, type: Object, default: {}
  });
  game.settings.register(MODULE_ID, 'showRecentButton', {
    name: 'Show Recent Actions Button',
    hint: 'Show or hide the Recent Actions shortcut without deleting saved history.',
    scope: 'client', config: true, type: Boolean, default: true,
    onChange: () => window.ZFTActionHud?.refresh?.()
  });
  // Action-browser search visibility belongs to each client, not the Actor.
  game.settings.register(MODULE_ID, 'showBrowserSearch', {
    name: 'Show Action Browser Search',
    hint: 'Show the search field in category browser panels. Also controlled by the Show Search checkbox beside Show Unequipped.',
    scope: 'client', config: true, type: Boolean, default: true,
    onChange: () => window.ZFTActionHud?.refresh?.()
  });
  // Remember manually opened/closed action groups per client, Actor, category and group.
  game.settings.register(MODULE_ID, 'browserExpandedGroups', {
    scope: 'client', config: false, type: Object, default: {}
  });
  // All visibility preferences apply to the current user's HUD, never Actor data.
  const filters = [
    ['showUnchargedItems', 'Show Uncharged Items', 'Show inventory Items with no remaining charges; Items with alternative executable Activities are not hidden.', true],
    ['showUnequippedWeapons', 'Show Unequipped Weapons', 'Include weapons that are not equipped.', false],
    ['showUnequippedEquipment', 'Show Unequipped Equipment', 'Include unequipped armor and equipment.', true],
    ['showUnequippedConsumables', 'Show Unequipped Consumables', 'Include consumables marked unequipped.', true],
    ['showUnequippedTools', 'Show Unequipped Tools', 'Include tools marked unequipped.', true],
    ['showUnequippedContainers', 'Show Unequipped Containers', 'Include backpacks and containers marked unequipped.', true],
    ['showActiveEffects', 'Show Active Effects Strip', 'Display Foundry Active Effects and conditions above the HUD. Right-click an effect to request removal where permitted.', true],
    ['clientDebugLogging', 'Client Debug Logging', 'Detailed diagnostic logs in this browser console. Errors always remain visible.', false]
  ];
  for (const [key, name, hint, initial] of filters) {
    game.settings.register(MODULE_ID, key, {
      name, hint, scope: 'client', config: true, type: Boolean, default: initial,
      onChange: () => window.ZFTActionHud?.refresh?.()
    });
  }
  game.settings.register(MODULE_ID, 'gmDebugLogging', {
    name: 'GM Debug Logging (World)',
    hint: 'GM-only setting. When enabled, additional Action HUD diagnostics appear in each connected client browser console; no logs are collected centrally.',
    scope: 'world', config: true, type: Boolean, default: false,
    onChange: () => window.ZFTActionHud?.refresh?.()
  });
  game.settings.register(MODULE_ID, 'activeEffectsCollapsed', {
    scope: 'client', config: false, type: Boolean, default: false
  });
  game.settings.register(MODULE_ID, 'quickAccessTab', {
    scope: 'client', config: false, type: String, default: 'favorites'
  });
  game.settings.register(MODULE_ID, 'hudBackgroundOpacity', {
    name: 'HUD Background Opacity',
    hint: 'Transparency of the main HUD panel only. Character art, text, and action controls remain fully opaque.',
    scope: 'client', config: true, type: Number, default: 90,
    range: { min: 0, max: 100, step: 5 },
    onChange: () => window.ZFTActionHud?.applyAppearance?.()
  });
  game.settings.register(MODULE_ID, 'browserBackgroundOpacity', {
    name: 'Action Browser Background Opacity',
    hint: 'Transparency of the expanded category browser panel. Action icons, labels, and buttons remain legible.',
    scope: 'client', config: true, type: Number, default: 90,
    range: { min: 0, max: 100, step: 5 },
    onChange: () => window.ZFTActionHud?.applyAppearance?.()
  });
  game.settings.register(MODULE_ID, 'categoryButtonSize', {
    name: 'Category Button Size',
    hint: 'Size of the category buttons in the compact HUD. Small is the default.',
    scope: 'client', config: true, type: String, default: 'small',
    choices: { tiny: 'Tiny', small: 'Small', medium: 'Medium', large: 'Large' },
    onChange: () => window.ZFTActionHud?.applyAppearance?.()
  });
  game.settings.register(MODULE_ID, 'uiScale', {
    name: 'HUD UI Scale',
    hint: 'Scale the primary HUD and action browser. The custom hotbar has its own independent scale.',
    scope: 'client', config: true, type: Number, default: 1,
    range: { min: 0.75, max: 1.25, step: 0.05 },
    onChange: () => window.ZFTActionHud?.applyAppearance?.()
  });
}
