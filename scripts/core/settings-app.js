import { themeOptions } from '../themes/registry.js';
import { MODULE_ID, VERSION } from './settings.js';
import { debugLog } from './debug.js';
import { activeHotbarProfile, saveHotbarDimensions, resetAllHotbarColors } from './actor-quick-access.js';
import { getSystemAdapter } from '../adapters/registry.js';
import { performHotbarMaintenance } from './hotbar-maintenance.js';
import { macroFolders } from './shared-macro-library.js';

const Base = foundry.applications.api.ApplicationV2;
const Mixin = foundry.applications.api.HandlebarsApplicationMixin;
const LOG = `[ZFT] v${VERSION} | HUD Settings`;
const THEME_TOKENS = [
  '--zft-panel','--zft-bg','--zft-panel2','--zft-panel3','--zft-border',
  '--zft-muted','--zft-text','--zft-accent-bright','--zft-shadow'
];

/** A free-floating, non-modal window independent of the action browser. */
export class ZFTActionHudSettings extends Mixin(Base) {
  static DEFAULT_OPTIONS = {
    id: 'zft-action-hud-settings', classes: ['zft-action-hud-settings-app'],
    tag: 'div',
    window: { frame: false, positioned: false, resizable: false, minimizable: false },
    position: { width: 'auto', height: 'auto' }, actions: {}
  };

  static PARTS = {
    content: { template: 'modules/zft-action-hud/templates/settings.hbs' }
  };

  constructor(hud) {
    super();
    this.hud = hud;
    this._drag = null;
    this._activeTab = 'general';
    this._boundMove = this._dragMove.bind(this);
    this._boundEnd = this._dragEnd.bind(this);
    this._boundResize = this._clampPosition.bind(this);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const get = k => game.settings.get(MODULE_ID, k);
    const clientTheme = get('clientTheme');
    const size = get('categoryButtonSize');
    const profile = activeHotbarProfile(this.hud?._actor);
    const sharedFolder=game.folders?.get?.(get('sharedMacroFolderId'));
    const gmFolder=game.folders?.get?.(get('gmMacroFolderId'));
    return {
      ...context,
      showRecentButton: get('showRecentButton'),
      showCustomHotbar: get('showCustomHotbar'),
      showHotbarLabels: get('showHotbarLabels'),
      hotbarLocked: get('hotbarLocked'),
      hotbarPositionLocked: get('hotbarPositionLocked'),
      hotbarDockMode: get('hotbarDockMode'),
      hotbarDockAuto: get('hotbarDockMode') === 'auto',
      hotbarDockDocked: get('hotbarDockMode') === 'docked',
      hotbarDockFloating: get('hotbarDockMode') === 'floating',
      autoCombatProfile: get('autoCombatProfile'),
      hotbarRows: profile.rows,
      hotbarWritable: Boolean(this.hud?._actor?.isOwner),
      hotbarColumns: profile.columns,
      hotbarUiScale: get('hotbarUiScale'),
      hotbarScalePercent: Math.round(get('hotbarUiScale') * 100),
      sharedMacroFolderId:get('sharedMacroFolderId'),
      gmMacroFolderId:get('gmMacroFolderId'),
      sharedSortAlpha:sharedFolder?.sorting!=='m',
      sharedSortManual:sharedFolder?.sorting==='m',
      sharedFolderSelected:Boolean(sharedFolder),
      gmSortAlpha:gmFolder?.sorting!=='m',
      gmSortManual:gmFolder?.sorting==='m',
      gmFolderSelected:Boolean(gmFolder),
      macroFolders: macroFolders().map(f=>({ id:f.id,name:f.name,selectedShared:f.id===get('sharedMacroFolderId'),selectedGm:f.id===get('gmMacroFolderId') })),
      showHud: get('enabled'),
      hudFloatingLocked: get('hudFloatingLocked'),
      supportsInventoryFilters: Boolean(getSystemAdapter()?.capabilities?.inventoryFilters && getSystemAdapter()?.inventoryFilterOptions?.length),
      inventoryFilters: (getSystemAdapter()?.capabilities?.inventoryFilters
        ? getSystemAdapter()?.inventoryFilterOptions || [] : []).map(option => ({
          key: option.key, label: option.label, checked: Boolean(get(option.key))
        })),
      showUnchargedItems: get('showUnchargedItems'),
      showUnequippedWeapons: get('showUnequippedWeapons'),
      showUnequippedEquipment: get('showUnequippedEquipment'),
      showUnequippedConsumables: get('showUnequippedConsumables'),
      showUnequippedTools: get('showUnequippedTools'),
      showUnequippedContainers: get('showUnequippedContainers'),
      showActiveEffects: get('showActiveEffects'),
      clientDebugLogging: get('clientDebugLogging'),
      gmDebugLogging: get('gmDebugLogging'),
      settings: {
        isGM: Boolean(game.user?.isGM),
        clientThemeIsZftDefault: clientTheme === 'zft-default',
        clientThemeIsGothicArcane: clientTheme === 'gothic-arcane',
        clientThemeOptions: themeOptions(clientTheme),
        showThemeTextures: get('showThemeTextures'),
        categoryButtonSizeIsTiny: size === 'tiny',
        categoryButtonSizeIsSmall: size === 'small',
        categoryButtonSizeIsMedium: size === 'medium',
        categoryButtonSizeIsLarge: size === 'large',
        hudBackgroundOpacity: get('hudBackgroundOpacity'),
        browserBackgroundOpacity: get('browserBackgroundOpacity'),
        uiScale: get('uiScale'),
        scalePercent: Math.round(get('uiScale') * 100),
        hudPositionLocked: get('hudPosition')?.mode !== 'floating'
      }
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!this.element) return;
    this.syncTheme();
    this._applyPosition();
    this._wireControls();
    this._activateTab(this._activeTab);
    this._updatePositionControl();
    window.removeEventListener('resize', this._boundResize);
    window.addEventListener('resize', this._boundResize);
    debugLog('Floating settings rendered');
  }

  /** Follow the HUD theme while keeping the settings dialog a separate DOM root. */
  syncTheme() {
    if (!this.element || !this.hud?.element) return;
    this.element.dataset.theme = this.hud.element.dataset.theme;
    const computed = getComputedStyle(this.hud.element);
    for (const property of THEME_TOKENS) {
      const value = computed.getPropertyValue(property);
      if (value) this.element.style.setProperty(property, value.trim());
    }
  }

  _applyPosition() {
    if (!this.element) return;
    const position = game.settings.get(MODULE_ID, 'settingsWindowPosition') || {};
    const bounds = this.element.getBoundingClientRect();
    // First opening is at the top-left, away from the default bottom-center HUD.
    const x = Number.isFinite(position.x) ? position.x : 24;
    const y = Number.isFinite(position.y) ? position.y : 70;
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this._clampPosition();
  }

  _clampPosition() {
    if (!this.element) return;
    const rect = this.element.getBoundingClientRect();
    const maxX = Math.max(8, innerWidth - rect.width - 8);
    const maxY = Math.max(8, innerHeight - rect.height - 8);
    const x = Math.max(8, Math.min(maxX, rect.left));
    const y = Math.max(8, Math.min(maxY, rect.top));
    this.element.style.left = `${Math.round(x)}px`;
    this.element.style.top = `${Math.round(y)}px`;
  }

  /** Tabs only change visibility, never settings values or current form state. */
  _activateTab(tab, { focus = false } = {}) {
    const root = this.element;
    if (!root) return;
    const available = [...root.querySelectorAll('[data-settings-tab]')].map(node => node.dataset.settingsTab);
    this._activeTab = available.includes(tab) ? tab : 'general';
    for (const button of root.querySelectorAll('[data-settings-tab]')) {
      const selected = button.dataset.settingsTab === this._activeTab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    }
    for (const panel of root.querySelectorAll('[data-settings-tab-panel]'))
      panel.hidden = panel.dataset.settingsTabPanel !== this._activeTab;
    const content = root.querySelector('.zft-hud-settings-content');
    if (content) content.scrollTop = 0;
    // Switching from a long panel to a shorter one must not strand the window.
    this._clampPosition();
  }

  _wireControls() {
    const root = this.element;
    const tabs = [...root.querySelectorAll('[data-settings-tab]')];
    tabs.forEach((button, index) => {
      button.addEventListener('click', () => this._activateTab(button.dataset.settingsTab));
      button.addEventListener('keydown', event => {
        const shift = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!shift && !['Home','End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + shift + tabs.length) % tabs.length;
        this._activateTab(tabs[next].dataset.settingsTab, { focus: true });
      });
    });
    root.querySelector('[data-hud-control="close-settings"]')?.addEventListener('click', event => {
      event.preventDefault();
      this.close();
    });
    root.querySelector('[data-settings-drag-handle]')?.addEventListener('pointerdown', event => this._dragStart(event));
    root.querySelectorAll('[data-hud-setting]').forEach(input => {
      const key = input.dataset.hudSetting;
      if (input.type === 'range') {
        input.addEventListener('input', () => {
          const value = Number(input.value);
          const output = root.querySelector(`[data-hud-setting-value="${key}"]`);
          if (output) output.textContent = (key === 'uiScale' || key === 'hotbarUiScale') ? `${Math.round(value * 100)}%` : `${Math.round(value)}%`;
          if (key === 'hotbarUiScale') this.hud?._customHotbar?.previewScale(value);
          else this.hud?.applyAppearance({ previewKey: key, previewValue: value });
        });
      }
      input.addEventListener('change', async () => {
        if (input.dataset.worldSetting === 'true' && !game.user?.isGM) return;
        try {
          const value = input.type === 'checkbox' ? input.checked :
            (input.type === 'range' || input.type === 'number') ? Number(input.value) : input.value;
          if (key === 'hotbarRows' || key === 'hotbarColumns') {
            const actor = this.hud?._actor;
            if (!actor?.isOwner) throw new Error('Actor ownership is required to resize this profile.');
            await saveHotbarDimensions(actor, key === 'hotbarRows' ? { rows: value } : { columns: value });
            this.hud?._customHotbar?.render(actor);
            return;
          }
          await game.settings.set(MODULE_ID, key, value);
          // Hiding the HUD closes this window too. Re-enable from Module Settings.
          if (['sharedMacroFolderId','gmMacroFolderId'].includes(key)) {
            await this.render(true);
            return;
          }
          if (key === 'enabled' || key === 'hudFloatingLocked' || key.startsWith('hotbar') || ['showCustomHotbar','showHotbarLabels'].includes(key)) return;
          // These settings already invoke HUD.refresh via their registered
          // onChange callback; don't queue a second full render.
          if (['showRecentButton','showUnchargedItems','showUnequippedWeapons','showUnequippedEquipment',
            'showUnequippedConsumables','showUnequippedTools','showUnequippedContainers',
            'showActiveEffects','clientDebugLogging','gmDebugLogging'].includes(key)) return;
          this.hud?.applyAppearance();
        } catch (error) {
          console.error(`${LOG} | ❌ Cannot save ${key}`, error);
          ui.notifications?.warn('Could not save HUD setting; see console.');
          this.hud?.applyAppearance();
          await this.render(true);
        }
      });
    });
    // These controls update the actual Macro Directory Folder's sorting mode.
    // There is no parallel ZFT preference that can disagree with its sidebar.
    root.querySelectorAll('[data-macro-folder-sorting]').forEach(input=>{
      input.addEventListener('change',async()=>{
        if(!game.user?.isGM)return;
        const kind=input.dataset.macroFolderSorting;
        const folderKey=kind==='shared'?'sharedMacroFolderId':'gmMacroFolderId';
        const folder=game.folders?.get?.(game.settings.get(MODULE_ID,folderKey));
        if(!folder || folder.type!=='Macro')return;
        try {
          if(input.value!==folder.sorting)await folder.update({sorting:input.value});
          this.hud?._macroLibraries?.refresh();
          this.syncPreferences();
        } catch(error) {
          console.error(`${LOG} | ❌ Cannot set native Macro folder sorting`,error);
          ui.notifications?.error('Could not change Macro folder sorting; see console.');
          this.syncPreferences();
        }
      });
    });
    root.querySelectorAll('[data-settings-command]').forEach(button => {
      button.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        if (this._maintenanceBusy) return;
        try {
          switch (button.dataset.settingsCommand) {
            case 'dock': await this.hud?._setPositionMode('docked'); this._updatePositionControl(); break;
            case 'float': await this.hud?._setPositionMode('floating'); this._updatePositionControl(); break;
            case 'favorites': await this.hud?._toggleQuickAccess('favorites'); break;
            case 'recent': await this.hud?._toggleQuickAccess('recent'); break;
            case 'maintenance-clean-current':
            case 'maintenance-reset-current':
            case 'maintenance-clean-all':
            case 'maintenance-reset-all': {
              const command=button.dataset.settingsCommand;
              if (this._maintenanceBusy) return;
              this._maintenanceBusy=true;
              try {
                await performHotbarMaintenance({
                  operation:command.includes('clean') ? 'cleanup' : 'reset',
                  scope:command.endsWith('all') ? 'all' : 'current',
                  actor:this.hud?._actor,
                  onComplete:()=>{this.hud?._customHotbar?.render(this.hud?._actor);this.syncPreferences();}
                });
              } finally {this._maintenanceBusy=false;}
              break;
            }
            case 'reset-button-colors': {
              const actor=this.hud?._actor;
              const confirmed=await foundry.applications.api.DialogV2.confirm({
                window:{title:'Reset All Button Colors'},modal:true,
                content:'Restore ZFT default colors to all category, Favorites and Recent buttons, and theme colors to custom hotbar slots on the current character (across every profile)?'
              });
              if(!confirmed)return;
              if(actor?.isOwner) await resetAllHotbarColors(actor);
              await game.settings.set(MODULE_ID,'categoryButtonColors',{});
              this.hud?.applyCategoryButtonColors?.();
              if(actor?.isOwner)this.hud?._customHotbar?.render(actor);
              if(actor && !actor.isOwner)ui.notifications?.warn('Character slot colors require Actor ownership; category colors were reset.');
              break;
            }
          }
        } catch (error) {
          console.error(`${LOG} | ❌ HUD command failed`, error);
          ui.notifications?.warn('HUD control failed; see console.');
        }
      });
    });
  }

  /** Keep this open window synchronized with Foundry Module Settings and browser filters. */
  syncPreferences() {
    if (!this.element) return;
    this.element.querySelectorAll('[data-hud-setting]').forEach(input => {
      if (input.dataset.worldSetting === 'true' && !game.user?.isGM) return;
      const key = input.dataset.hudSetting;
      const value = key === 'hotbarRows' ? activeHotbarProfile(this.hud?._actor).rows
        : key === 'hotbarColumns' ? activeHotbarProfile(this.hud?._actor).columns
        : game.settings.get(MODULE_ID, key);
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else if (input.type !== 'range') input.value = String(value);
    });
    for(const input of this.element.querySelectorAll('[data-macro-folder-sorting]')){
      const key=input.dataset.macroFolderSorting==='shared'?'sharedMacroFolderId':'gmMacroFolderId';
      const folder=game.folders?.get?.(game.settings.get(MODULE_ID,key));
      input.disabled=!folder || !game.user?.isGM;
      input.value=folder?.sorting==='m'?'m':'a';
    }
  }

  _updatePositionControl() {
    if (!this.element) return;
    const locked = game.settings.get(MODULE_ID, 'hudPosition')?.mode !== 'floating';
    for (const button of this.element.querySelectorAll('[data-settings-command="dock"], [data-settings-command="float"]')) {
      const current = button.dataset.settingsCommand === (locked ? 'dock' : 'float');
      button.setAttribute('aria-pressed', String(current));
      button.classList.toggle('is-active', current);
    }
  }

  _dragStart(event) {
    if (event.button !== 0 || event.target.closest('button') || !this.element) return;
    event.preventDefault();
    const rect = this.element.getBoundingClientRect();
    this._drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    document.addEventListener('pointermove', this._boundMove);
    document.addEventListener('pointerup', this._boundEnd, { once: true });
    document.addEventListener('pointercancel', this._boundEnd, { once: true });
  }

  _dragMove(event) {
    if (!this._drag || !this.element) return;
    const rect = this.element.getBoundingClientRect();
    const maxX = Math.max(8, innerWidth - rect.width - 8);
    const maxY = Math.max(8, innerHeight - rect.height - 8);
    this.element.style.left = `${Math.round(Math.max(8, Math.min(maxX, event.clientX - this._drag.dx)))}px`;
    this.element.style.top = `${Math.round(Math.max(8, Math.min(maxY, event.clientY - this._drag.dy)))}px`;
  }

  async _dragEnd() {
    document.removeEventListener('pointermove', this._boundMove);
    document.removeEventListener('pointerup', this._boundEnd);
    document.removeEventListener('pointercancel', this._boundEnd);
    if (!this._drag || !this.element) return;
    this._drag = null;
    try {
      await game.settings.set(MODULE_ID, 'settingsWindowPosition', {
        x: parseFloat(this.element.style.left), y: parseFloat(this.element.style.top)
      });
    } catch (error) { console.warn(`${LOG} | ⚠️ Could not remember settings position`, error); }
  }

  async _onClose(options) {
    window.removeEventListener('resize', this._boundResize);
    document.removeEventListener('pointermove', this._boundMove);
    document.removeEventListener('pointerup', this._boundEnd);
    document.removeEventListener('pointercancel', this._boundEnd);
    this._drag = null;
    await super._onClose(options);
  }
}
