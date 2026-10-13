import { MODULE_ID, VERSION, DEFAULT_POSITION } from './settings.js';
import { resolveTheme, nextClientTheme } from '../themes/registry.js';
import { getActiveActor, getPortrait } from './compatibility.js';
import { getSystemAdapter } from '../adapters/registry.js';
import { choosePanelPlacement, choosePanelHorizontalPlacement } from './panel-placement.js';
import { upperLeftDockPosition, foundryDockObstacles } from './docking.js';
import { currentPositionState, nextPositionState, positionControlPresentation } from './position-control.js';
import { toggleId, placeFavorite, pushRecent, uniqueIds } from './quick-access.js';
import { ZFTActionHudSettings } from './settings-app.js';
import { ZFTCustomHotbar } from './custom-hotbar.js';
import { ZFTMacroLibraries } from './shared-macro-library.js';
import { ZFTScalePopover } from './scale-popover.js';
import { ZFTButtonColors, applyButtonColor, DEFAULT_CATEGORY_COLORS } from './button-colors.js';
import { resolveFavoriteIds, saveFavorites, migrateFavorites } from './actor-quick-access.js';
import { ItemPreview } from './item-preview.js';
import { EffectTooltip } from './effect-tooltip.js';
import { debugLog } from './debug.js';

const AppV2 = foundry.applications.api.ApplicationV2;
const HandlebarsMixin = foundry.applications.api.HandlebarsApplicationMixin;
const LOG = `[ZFT] v${VERSION} | Action HUD`;

/** RPG-agnostic HUD: categories, favorite previews and actions come from the adapter. */
export class ZFTActionHud extends HandlebarsMixin(AppV2) {
  static DEFAULT_OPTIONS = {
    id: 'zft-action-hud',
    classes: ['zft-action-hud-app'],
    tag: 'div',
    window: { frame: false, positioned: false, resizable: false, minimizable: false },
    position: { width: 'auto', height: 'auto' },
    actions: {}
  };

  static PARTS = {
    content: { template: 'modules/zft-action-hud/templates/hud.hbs' }
  };

  constructor(options = {}) {
    super(options);
    this._actor = null;
    this._activeCategory = null;
    this._browserOpen = false;
    this._browserState = new Map();
    this._browserSearchQueries = new Map();
    this._expandedSave = Promise.resolve();
    this._resourcePending = new Set();
    this._itemStatePending = new Set();
    this._sidebarResizeObserver = null;
    this._hpPanelOpen = false;
    this._settingsWindow = null;
    this._customHotbar = new ZFTCustomHotbar(this);
    this._macroLibraries = new ZFTMacroLibraries(this);
    this._colorUI = new ZFTButtonColors();
    this._hudScaleControl = new ZFTScalePopover({
      id:'zft-action-hud-scale',label:'Action HUD Scale',setting:'uiScale',min:0.75,max:1.25,
      trigger:() => this.element?.querySelector('[data-hud-control="scale"]'),
      source:() => this.element,preview:value => this.applyAppearance({previewKey:'uiScale',previewValue:value}),
      onSaved:() => this.applyAppearance()
    });
    this._favoriteMigrationPending = new Set();
    this._drag = null;
    this._itemDrag = null;
    this._dragSuppressUntil = 0;
    this._activeUses = new Set();
    this._effectTooltips = new EffectTooltip();
    this._itemPreview = new ItemPreview({
      getAdapter: () => getSystemAdapter(),
      getActor: () => this._actor,
      getHudRoot: () => this.element
    });
    this._boundOutside = this._outsidePointer.bind(this);
    this._boundEscape = this._escape.bind(this);
    this._boundDragMove = this._dragMove.bind(this);
    this._boundDragEnd = this._dragEnd.bind(this);
    this._boundViewportResize = this._onViewportResize.bind(this);
  }

  _actorKey(actor = this._actor) {
    return actor?.uuid || actor?.id || null;
  }

  _favoriteIds(actor = this._actor) {
    if (!actor) return [];
    const adapter = getSystemAdapter();
    const saved = resolveFavoriteIds(actor, adapter);
    if (saved !== null) return saved;
    // Read legacy Favorites until their Actor flag has been migrated.
    const stored = game.settings.get(MODULE_ID, 'favoritesByActor') || {};
    const ids = stored[this._actorKey(actor)] || stored[actor.id] || [];
    return uniqueIds(ids.map(id => adapter?.resolveActionId?.(actor, id) ?? id));
  }

  async _migrateFavorites(actor) {
    const key = this._actorKey(actor);
    if (!actor?.isOwner || !key || this._favoriteMigrationPending.has(key)) return;
    const stored = game.settings.get(MODULE_ID, 'favoritesByActor') || {};
    if (!Array.isArray(stored[key]) && !Array.isArray(stored[actor.id])) return;
    this._favoriteMigrationPending.add(key);
    try { await migrateFavorites(actor, stored, getSystemAdapter()); }
    catch (error) { console.warn(`${LOG} | Could not migrate Favorites to Actor`, error); }
    finally { this._favoriteMigrationPending.delete(key); }
  }

  _recentIds(actor = this._actor) {
    const key = this._actorKey(actor);
    const stored = game.settings.get(MODULE_ID, 'recentByActor') || {};
    const ids = key ? uniqueIds(stored[key]) : [];
    const adapter = getSystemAdapter();
    return uniqueIds(ids.map(id => adapter?.resolveActionId?.(actor, id) ?? id));
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = getActiveActor();
    const adapter = getSystemAdapter();
    this._actor = actor;
    await this._migrateFavorites(actor);
    const favoriteIds = this._favoriteIds(actor);
    const recentIds = this._recentIds(actor);
    const showBrowserSearch = game.settings.get(MODULE_ID, 'showBrowserSearch');
    const categories = (adapter?.getCategories(actor, favoriteIds) ?? []).map(category => ({
      ...category, showBrowserSearch,
      // RPG adapters own resource labels, fields and storage semantics.
      resourceSection: adapter?.getCategoryResourceSection?.(actor, category.id) ?? null
    }));
    const effectsData = adapter?.getActiveEffects?.(actor) ?? { effects: [], activeItemIds: new Set() };
    const showActiveEffects = Boolean(game.settings.get(MODULE_ID, 'showActiveEffects'));
    const inspiration = adapter?.getInspiration?.(actor) ?? null;
    const health = adapter?.getHealth?.(actor) ?? adapter?.getActorSummary?.(actor) ?? null;
    const tempHp = Math.max(0, Number(health?.temp) || 0);
    const availableItems = new Map(categories.flatMap(c => c.groups).flatMap(g => g.items).map(item => [item.id, item]));
    const usableFavorites = favoriteIds.map(id => availableItems.get(id)).filter(Boolean);
    const usableRecent = recentIds.map(id => availableItems.get(id)).filter(Boolean);
    const quickAccessExpanded = !game.settings.get(MODULE_ID, 'favoritesCollapsed');
    const showRecentButton = game.settings.get(MODULE_ID, 'showRecentButton');
    const activeTab = showRecentButton && game.settings.get(MODULE_ID, 'quickAccessTab') === 'recent' ? 'recent' : 'favorites';
    if (this._activeCategory && !categories.some(cat => cat.id === this._activeCategory)) {
      this._activeCategory = null;
      this._browserOpen = false;
    }
    return {
      ...context,
      hasActor: Boolean(actor),
      actorName: actor?.name ?? 'No character selected',
      actorSubtitle: actor ? 'Select a category to browse' : 'Select a token to browse actions',
      portrait: getPortrait(actor),
      resourceSummary: health,
      actionHelpText: adapter?.actionHelpText || 'Click to use · Right-click to inspect · Drag to Favorites or Custom Hotbar.',
      categories,
      primaryCategoryCount:Math.max(1,categories.filter(category => !category.secondary).length),
      // Include every lower-row control in the width calculation (including
      // optional Recent) so Actors with few Items don't squash the HUD.
      secondaryCategoryCount:categories.filter(category => category.secondary).length
        + 2 + Number(showRecentButton),
      hotbarVisible:Boolean(game.settings.get(MODULE_ID, 'showCustomHotbar')),
      sharedMacroConfigured:this._macroLibraries.configured('shared'),
      gmMacroConfigured:this._macroLibraries.configured('gm'),
      primaryCategories:categories.filter(category => !category.secondary),
      secondaryCategories:categories.filter(category => category.secondary).sort((a,b) =>
        ["saves","abilities","skills","tools"].indexOf(a.id) - ["saves","abilities","skills","tools"].indexOf(b.id)),
      activeEffects: showActiveEffects ? effectsData.effects : [],
      showActiveEffects: showActiveEffects && Boolean(actor) && effectsData.effects.length > 0,
      canEditHP: Boolean(actor?.isOwner && adapter?.capabilities?.health && adapter?.adjustHp),
      canViewActorSheet: Boolean(actor && (actor.testUserPermission?.(game.user, 'OBSERVER') ?? (actor.isOwner || game.user?.isGM))),
      tempHp,
      hasTempHp: tempHp > 0,
      showInspiration: inspiration !== null,
      inspirationActive: inspiration === true,
      canToggleInspiration: inspiration !== null && Boolean(actor?.isOwner) && (Boolean(game.user?.isGM) || inspiration === true),
      inspirationHint: inspiration === null ? '' : game.user?.isGM
        ? (inspiration ? 'Remove Inspiration' : 'Grant Inspiration')
        : (inspiration ? 'Spend Inspiration' : 'Inspiration not available (only GM can grant)'),
      activeEffectsCount: effectsData.effects.length,
      favorites: usableFavorites,
      recent: usableRecent,
      favoriteCount: usableFavorites.length,
      recentCount: usableRecent.length,
      showRecentButton,
      settings: {
        isGM: Boolean(game.user?.isGM),
        clientTheme: game.settings.get(MODULE_ID, 'clientTheme'),
        categoryButtonSize: game.settings.get(MODULE_ID, 'categoryButtonSize'),
        uiScale: game.settings.get(MODULE_ID, 'uiScale'),
        scalePercent: Math.round((game.settings.get(MODULE_ID, 'uiScale') || 1) * 100),
        clientThemeIsZftDefault: game.settings.get(MODULE_ID, 'clientTheme') === 'zft-default',
        clientThemeIsGothicArcane: game.settings.get(MODULE_ID, 'clientTheme') === 'gothic-arcane',
        categoryButtonSizeIsTiny: game.settings.get(MODULE_ID, 'categoryButtonSize') === 'tiny',
        categoryButtonSizeIsSmall: game.settings.get(MODULE_ID, 'categoryButtonSize') === 'small',
        categoryButtonSizeIsMedium: game.settings.get(MODULE_ID, 'categoryButtonSize') === 'medium',
        categoryButtonSizeIsLarge: game.settings.get(MODULE_ID, 'categoryButtonSize') === 'large',
        hudBackgroundOpacity: game.settings.get(MODULE_ID, 'hudBackgroundOpacity'),
        browserBackgroundOpacity: game.settings.get(MODULE_ID, 'browserBackgroundOpacity')
      },
      quickAccessExpanded,
      favoritesSelected: quickAccessExpanded && activeTab === 'favorites',
      recentSelected: quickAccessExpanded && activeTab === 'recent',
      collapsed: game.settings.get(MODULE_ID, 'hudCollapsed')
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!this.element) return;
    const root = this.element;
    this._effectTooltips.hide(true); // A render replaces the effect icons.
    this._itemPreview.hide(true); // A render replaces the action buttons; avoid stale preview state.
    this._colorUI.close();
    root.classList.add('zft-hud-root');
    // Foundry V13's #interface/#ui-left can impose a transformed or bottom-
    // anchored containing block. fixed coordinates inside it are not viewport
    // coordinates. Host the AppV2 root directly under body like the hotbar.
    if (root.parentElement !== document.body) document.body.append(root);
    root.dataset.theme = resolveTheme({
      clientTheme: game.settings.get(MODULE_ID, 'clientTheme')
    });
    root.dataset.textures = String(Boolean(game.settings.get(MODULE_ID, 'showThemeTextures')));
    root.dataset.hasActor = String(Boolean(this._actor));
    root.dataset.buttonSize = game.settings.get(MODULE_ID, 'categoryButtonSize') || 'small';
    root.style.setProperty('--zft-scale', String(game.settings.get(MODULE_ID, 'uiScale') || 1));
    const percent = key => `${Math.max(0, Math.min(100, Number(game.settings.get(MODULE_ID, key))))}%`;
    root.style.setProperty('--zft-hud-opacity', percent('hudBackgroundOpacity'));
    root.style.setProperty('--zft-browser-opacity', percent('browserBackgroundOpacity'));
    this._applyPosition();
    this._watchSidebarPosition();
    this._wireControls();
    this.applyCategoryButtonColors();
    const effects = getSystemAdapter()?.getActiveEffects?.(this._actor)?.effects ?? [];
    void this._effectTooltips.wire(root, effects, root.dataset.theme).catch(error =>
      console.warn(`${LOG} | Could not render enriched effect tooltips`, error));
    this._setBrowserOpen(this._browserOpen, { resetSearch: false });
    this._restoreBrowserState();
    this._placeEffectDock();
    this._setHpPanelOpen(this._hpPanelOpen);
    this._customHotbar.render(this._actor);
    this._macroLibraries.refresh();
    this._hudScaleControl.sync();
    this._syncPositionControl();
    this._settingsWindow?.syncTheme();
    this._settingsWindow?.syncPreferences();

    document.removeEventListener('pointerdown', this._boundOutside, true);
    document.removeEventListener('keydown', this._boundEscape);
    document.addEventListener('pointerdown', this._boundOutside, true);
    document.addEventListener('keydown', this._boundEscape);
    window.removeEventListener('resize', this._boundViewportResize);
    window.addEventListener('resize', this._boundViewportResize);
    debugLog(`v${VERSION} | Category HUD rendered`, {
      actor: this._actor?.name ?? 'none',
      system: game.system?.id,
      categories: context.categories?.length ?? 0,
      theme: root.dataset.theme
    });
  }

  /** Client-specific optional colors, applied without changing category metadata or theme rules. */
  applyCategoryButtonColors() {
    const colors=game.settings.get(MODULE_ID,'categoryButtonColors') || {};
    for(const button of this.element?.querySelectorAll('[data-hud-category], [data-hud-control="favorites"], [data-hud-control="recent"]') || []) {
      const key=button.dataset.hudCategory || button.dataset.hudControl;
      // Slim action/quick-access buttons follow the theme unless the user explicitly colored them.
      const secondary = ['abilities','saves','skills','tools','favorites','recent'].includes(key);
      applyButtonColor(button, colors[key] || (secondary ? null : DEFAULT_CATEGORY_COLORS[key]));
    }
    this._applyContextAccents();
  }

  /** Keep the slim hotbar visibility control synchronized with Module Settings. */
  syncHotbarToggle() {
    const visible = Boolean(game.settings.get(MODULE_ID, 'showCustomHotbar'));
    const button = this.element?.querySelector('[data-hud-control="hotbar"]');
    button?.classList.toggle('is-active', visible);
    button?.setAttribute('aria-pressed', String(visible));
  }

  /** Active category popup and Favorites/Recent strip follow their actual button tint. */
  _applyContextAccents() {
    const root = this.element;
    if (!root) return;
    const overrides = game.settings.get(MODULE_ID,'categoryButtonColors') || {};
    const colorFor = key => overrides[key] ||
      (['abilities','saves','skills','tools','favorites','recent'].includes(key) ? null : DEFAULT_CATEGORY_COLORS[key]) || null;
    const browser = root.querySelector('[data-hud-browser]');
    const browserColor = this._browserOpen ? colorFor(this._activeCategory) : null;
    if (browserColor) browser?.style.setProperty('--zft-context-accent',browserColor);
    else browser?.style.removeProperty('--zft-context-accent');
    const quickAccess = root.querySelector('[data-quick-access-dropzone]');
    const selected = game.settings.get(MODULE_ID,'quickAccessTab') === 'recent' &&
      game.settings.get(MODULE_ID,'showRecentButton') ? 'recent' : 'favorites';
    const quickColor = colorFor(selected);
    if (quickColor) quickAccess?.style.setProperty('--zft-context-accent',quickColor);
    else quickAccess?.style.removeProperty('--zft-context-accent');
  }

  _wireControls() {
    const root = this.element;
    root.querySelectorAll('[data-hud-control]').forEach(button => {
      button.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        try {
          switch (button.dataset.hudControl) {
            case 'theme': await this._cycleTheme(); break;
            case 'settings': await this._toggleSettingsWindow(); break;
            case 'scale': this._hudScaleControl.toggle(); break;
            case 'move': await this._togglePosition(); break;
            case 'collapse': await this._toggleCollapsed(); break;
            case 'favorites': await this._toggleQuickAccess('favorites'); break;
            case 'recent': await this._toggleQuickAccess('recent'); break;
            case 'shared-macros': this._macroLibraries.toggle('shared'); break;
            case 'gm-macros': this._macroLibraries.toggle('gm'); break;
            case 'hotbar': await game.settings.set(MODULE_ID, 'showCustomHotbar', !game.settings.get(MODULE_ID, 'showCustomHotbar')); break;
            case 'close-browser': this._setBrowserOpen(false); break;
            case 'hp': this._setHpPanelOpen(!this._hpPanelOpen); break;
            case 'inspiration': await this._toggleInspiration(); break;
          }
        } catch (error) {
          console.error(`${LOG} | ❌ HUD control failed`, error);
          ui.notifications?.warn('ZFT Action HUD control failed; see console.');
        }
      });
      if (button.dataset.hudControl === 'theme') {
        button.addEventListener('contextmenu', async event => {
          event.preventDefault();
          event.stopPropagation();
          try { await this._cycleTheme(-1); }
          catch (error) {
            console.error(`${LOG} | ❌ Reverse theme control failed`, error);
            ui.notifications?.warn('Could not change HUD theme; see console.');
          }
        });
      }
      if (button.dataset.hudControl === 'move') {
        button.addEventListener('contextmenu', async event => {
          event.preventDefault();
          event.stopPropagation();
          try { await this._togglePosition(-1); }
          catch (error) {
            console.error(`${LOG} | ❌ Reverse HUD position control failed`, error);
            ui.notifications?.warn('ZFT Action HUD position change failed; see console.');
          }
        });
      }
    });

    // A pointer double-click opens the native Actor sheet. Single click does
    // nothing; keyboard users can use Enter/Space to open it directly.
    const portrait = root.querySelector('[data-hud-portrait]');
    portrait?.addEventListener('dblclick', event => {
      event.preventDefault();
      event.stopPropagation();
      void this._openActorSheet();
    });
    portrait?.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      void this._openActorSheet();
    });

    root.querySelectorAll('[data-hud-show-search]').forEach(input => {
      input.addEventListener('change', async () => {
        // A hidden search must never leave an invisible active filter behind.
        if (!input.checked) {
          root.querySelectorAll('[data-hud-search]').forEach(search => { search.value = ''; });
          this._captureBrowserState();
        }
        try { await game.settings.set(MODULE_ID, 'showBrowserSearch', Boolean(input.checked)); }
        catch (error) {
          console.error(`${LOG} | ❌ Could not save Show Search`, error);
          ui.notifications?.warn('Could not save search visibility.');
          input.checked = !input.checked;
        }
      });
    });
    root.querySelectorAll('[data-hud-filter-setting]').forEach(input => {
      input.addEventListener('change', async () => {
        const key = input.dataset.hudFilterSetting;
        try {
          await game.settings.set(MODULE_ID, key, Boolean(input.checked));
        } catch (error) {
          console.error(`${LOG} | Cannot save inventory filter ${key}`, error);
          ui.notifications?.warn('Could not update inventory visibility; see console.');
        }
      });
    });
    const colorButtons = root.querySelectorAll('[data-hud-category], [data-hud-control="favorites"], [data-hud-control="recent"]');
    for (const button of colorButtons) {
      const key=button.dataset.hudCategory || button.dataset.hudControl;
      if(button.dataset.hudCategory)button.addEventListener('click',event=>{
        event.preventDefault();this._selectCategory(key);
      });
      button.addEventListener('contextmenu',event=>{
        event.preventDefault();event.stopPropagation();
        const current=(game.settings.get(MODULE_ID,'categoryButtonColors')||{})[key]||null;
        const defaultColor=DEFAULT_CATEGORY_COLORS[key];
        const label=key[0].toUpperCase()+key.slice(1);
        this._colorUI.openMenu({target:button,title:label,current,defaultColor,event,
          onApply:async color=>{
            const values={...(game.settings.get(MODULE_ID,'categoryButtonColors')||{}),[key]:color};
            try{await game.settings.set(MODULE_ID,'categoryButtonColors',values);this.applyCategoryButtonColors();}
            catch(error){console.error('[ZFT] Could not save category color',error);ui.notifications?.warn('Could not save button color.');this.applyCategoryButtonColors();}
          },
          onReset:async()=>{
            const values={...(game.settings.get(MODULE_ID,'categoryButtonColors')||{})};delete values[key];
            try{await game.settings.set(MODULE_ID,'categoryButtonColors',values);this.applyCategoryButtonColors();}
            catch(error){console.error('[ZFT] Could not reset category color',error);ui.notifications?.warn('Could not reset button color.');this.applyCategoryButtonColors();}
          }
        });
      });
    }

    // Each tile is clickable across its entire visible surface, including the
    // unused space below a short name. Trailing Equip/Attune/Favorite controls
    // retain independent behavior and do not accidentally activate the Item.
    root.querySelectorAll('[data-hud-action-card]').forEach(card => {
      const primary = card.querySelector('[data-use-item]');
      if (!primary) return;
      card.addEventListener('click', async event => {
        if (event.button !== 0 || event.target.closest('button')) return;
        event.preventDefault();
        if (performance.now() < this._dragSuppressUntil) return;
        await this._executeItem(primary.dataset.useItem);
      });
      // Native buttons often focus after right-click; listen on the enclosing
      // tile instead, so right-clicking the lower half works consistently.
      card.addEventListener('contextmenu', async event => {
        if (event.target.closest('[data-hud-item-state], [data-favorite-item]')) return;
        event.preventDefault();
        event.stopPropagation();
        await this._inspectItem(primary.dataset.useItem);
      });
      primary.addEventListener('click', async event => {
        event.preventDefault();
        if (performance.now() < this._dragSuppressUntil) return;
        await this._executeItem(primary.dataset.useItem);
      });
    });
    // Checks are not Items: keep them out of Favorites and hotbar dragging.
    // The D&D5e adapter owns the roll API and all game-specific rules.
    root.querySelectorAll('[data-hud-roll-check]').forEach(button => {
      button.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        if (!this._actor) return;
        try {
          const outcome = await getSystemAdapter()?.rollCheck?.(this._actor, button.dataset.hudRollCheck, button.dataset.checkId);
          if (outcome?.status === 'denied') ui.notifications?.warn('You do not own this Actor.');
          else if (outcome?.status === 'unsupported') ui.notifications?.warn('This check is not available for the selected Actor.');
        } catch (error) {
          console.error(`${LOG} | ❌ Native check roll failed`, error);
          ui.notifications?.error('Check roll failed; see console.');
        }
      });
    });
    root.querySelectorAll('[data-hud-effect]').forEach(icon => {
      icon.addEventListener('contextmenu', async event => {
        event.preventDefault();
        event.stopPropagation();
        await this._removeEffect(icon.dataset.hudEffect);
      });
    });
    root.querySelectorAll('[data-hp-action]').forEach(button => {
      button.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        await this._adjustHp(button.dataset.hpAction);
      });
    });
    root.querySelector('[data-hp-amount]')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); void this._adjustHp('damage'); }
    });
    this._wireFavoriteDragging();
    this._itemPreview.wire(root);

    root.querySelectorAll('[data-favorite-item]').forEach(button => {
      button.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        try { await this._toggleFavorite(button.dataset.favoriteItem); }
        catch (error) {
          console.error(`${LOG} | ❌ Favorite update failed`, error);
          ui.notifications?.warn('Cannot update Favorite; see console.');
        }
      });
    });

    root.querySelectorAll('[data-hud-item-state]').forEach(button => {
      button.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        await this._toggleBrowserItemState(button.dataset.itemId, button.dataset.hudItemState);
      });
    });
    root.querySelectorAll('[data-hud-resource-adjust]').forEach(button => {
      button.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        const delta = Number(button.dataset.hudResourceAdjust);
        await this._adjustCategoryResource(button.dataset.resourceId, delta);
      });
    });
    // Shields are nested in <summary>; their controls must not toggle the group.
    root.querySelectorAll('.zft-hud-slot-shield').forEach(button => {
      button.addEventListener('pointerdown', event => event.stopPropagation());
    });
    // Native <details> toggle fires on programmatic search expansion as well.
    // Persist only intentional user changes from the summary click.
    root.querySelectorAll('[data-hud-group] > summary').forEach(summary => {
      summary.addEventListener('click', event => {
        if (event.target.closest('button[data-hud-resource-adjust]')) { event.preventDefault(); return; }
        event.preventDefault();
        const group = summary.closest('[data-hud-group]');
        const panel = summary.closest('[data-category-panel]');
        if (!group || !panel) return;
        group.open = !group.open;
        this._captureBrowserState();
        void this._saveExpandedGroups(panel);
      });
    });
    root.querySelectorAll('[data-hud-expand]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        const panel = button.closest('[data-category-panel]');
        if (!panel || panel.dataset.categoryPanel !== this._activeCategory) return;
        const expand = button.dataset.hudExpand === 'all';
        for (const group of panel.querySelectorAll('[data-hud-group]')) {
          // Hidden search results are not expanded accidentally.
          if (!group.hidden) group.open = expand;
        }
        this._captureBrowserState();
        void this._saveExpandedGroups(panel);
      });
    });
    root.querySelectorAll('[data-hud-search]').forEach(search => {
      search.addEventListener('input', () => this._filterActiveCategory(true));
    });
    root.querySelector('[data-drag-handle]')?.addEventListener('pointerdown', event => this._dragStart(event));
  }

  async _toggleBrowserItemState(id, kind) {
    const actor = this._actor, adapter = getSystemAdapter();
    if (!actor?.isOwner || !adapter?.toggleItemState || !['equip', 'attune'].includes(kind)) return;
    const key = `${this._actorKey(actor)}:${id}:${kind}`;
    if (this._itemStatePending.has(key)) return;
    this._itemStatePending.add(key);
    for (const button of this.element?.querySelectorAll('[data-hud-item-state]') || []) {
      if (button.dataset.itemId === id && button.dataset.hudItemState === kind) button.disabled = true;
    }
    try { await adapter.toggleItemState(actor, id, kind); await this.refresh(); }
    catch (error) { console.warn(`${LOG} | ⚠️ Item ${kind} update denied`, error); ui.notifications?.warn(error.message || 'Cannot update item.'); }
    finally { this._itemStatePending.delete(key); }
  }

  async _adjustCategoryResource(resourceId, delta) {
    const actor = this._actor;
    const adapter = getSystemAdapter();
    if (!actor?.isOwner || !adapter?.adjustResource || (delta !== 1 && delta !== -1)) {
      ui.notifications?.warn('You cannot adjust this resource.');
      return;
    }
    // Validate the resource against the current category supplied by the adapter.
    const pool = (adapter.getCategoryResourceSection?.(actor, this._activeCategory)?.items || [])
      .find(entry => entry.id === resourceId && entry.canEdit);
    if (!pool) { ui.notifications?.warn('Resource is unavailable.'); return; }
    const key = `${this._actorKey(actor)}:${resourceId}`;
    if (this._resourcePending.has(key)) return;
    this._resourcePending.add(key);
    const buttons = [...(this.element?.querySelectorAll('[data-hud-resource-adjust]') || [])]
      .filter(button => button.dataset.resourceId === resourceId);
    buttons.forEach(button => { button.disabled = true; });
    try {
      await adapter.adjustResource(actor, resourceId, delta);
      await this.refresh();
    } catch (error) {
      console.error(`${LOG} | ❌ Resource adjustment failed`, error);
      ui.notifications?.warn('Could not adjust resource. See console.');
    } finally {
      this._resourcePending.delete(key);
      buttons.forEach(button => {
        if (!button.isConnected) return;
        const value = delta < 0 ? pool.current <= 0 : pool.current >= pool.max;
        button.disabled = value;
      });
    }
  }

  async _removeEffect(key) {
    const actor = this._actor;
    if (!actor?.isOwner || !key || typeof key !== 'string') {
      ui.notifications?.warn('You do not have permission to remove that effect.');
      return false;
    }
    const adapter = getSystemAdapter();
    // Only act on an effect still exposed by the active Actor's HUD.
    const entry = adapter?.getActiveEffects?.(actor)?.effects?.find(effect => effect.id === key);
    if (!entry) return false;
    const realEffectId = key.startsWith('effect:') ? key.slice(7) : null;
    const statusId = key.startsWith('status:') ? key.slice(7) : null;
    const effect = realEffectId ? actor.effects?.get?.(realEffectId) : null;
    if ((!effect && !statusId) || (effect && effect.isOwner === false && !game.user?.isGM)) {
      ui.notifications?.warn('You do not have permission to remove that effect.');
      return false;
    }
    const name = entry.name || 'this effect';
    // Dialog content is authored, but names may come from untrusted actor data.
    const escapeHtml = value => String(value).replace(/[&<>"']/g,
      ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Remove Active Effect' },
      content: `<p>Remove <strong>${escapeHtml(name)}</strong> from ${escapeHtml(actor.name)}?</p><p>This removes the active instance, not the originating Item or Feature. Some automation may reapply it.</p>`,
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return false;
    try {
      // Lookup again after the confirmation: it may have expired meanwhile.
      if (realEffectId) {
        const current = actor.effects?.get?.(realEffectId);
        if (!current || (current.isOwner === false && !game.user?.isGM)) return false;
        await current.delete();
      } else if (statusId && typeof actor.toggleStatusEffect === 'function') {
        await actor.toggleStatusEffect(statusId, { active: false });
      } else return false;
      debugLog(`Removed effect ${key}`, { actor: actor.uuid });
      await this.refresh();
      return true;
    } catch (error) {
      console.error(`${LOG} | Could not remove active effect`, error);
      ui.notifications?.warn('Cannot remove that effect. See console.');
      return false;
    }
  }

  async _toggleSettingsWindow() {
    if (!this._settingsWindow) this._settingsWindow = new ZFTActionHudSettings(this);
    if (this._settingsWindow.rendered) await this._settingsWindow.close();
    else await this._settingsWindow.render(true);
  }

  _syncPositionControl() {
    const mode = (game.settings.get(MODULE_ID, 'hudPosition') || DEFAULT_POSITION).mode;
    const state = currentPositionState(mode, game.settings.get(MODULE_ID, 'hudFloatingLocked'));
    const info = positionControlPresentation(state, 'Action HUD');
    const button = this.element?.querySelector('[data-hud-control="move"]');
    if (button) {
      button.title = info.label;
      button.setAttribute('aria-label', info.label);
      button.dataset.positionState = state;
      const icon = button.querySelector('i');
      if (icon) icon.className = `fa-solid fa-${info.icon}`;
    }
    const handle = this.element?.querySelector('[data-drag-handle]');
    if (handle) handle.title = state === 'docked' ? 'Use the position button to float the HUD'
      : state === 'locked' ? 'Floating HUD position is locked' : 'Drag to move HUD';
  }

  syncMacroLibraryButtons() {
    for (const kind of ['shared','gm']) {
      const button=this.element?.querySelector(`[data-hud-control="${kind}-macros"]`);
      if(!button)continue;
      const active=this._macroLibraries.windows.has(kind);
      button.setAttribute('aria-pressed',String(active));
      button.classList.toggle('is-active',active);
    }
  }

  /** Apply visual settings without replacing the browser, preserving search, groups and scroll. */
  applyAppearance({ previewKey = null, previewValue = null } = {}) {
    if (!this.element) return;
    const root = this.element;
    const get = key => previewKey === key ? previewValue : game.settings.get(MODULE_ID, key);
    root.dataset.theme = resolveTheme({
      clientTheme: get('clientTheme')
    });
    root.dataset.textures = String(Boolean(get('showThemeTextures')));
    this._effectTooltips.setTheme(root.dataset.theme);
    root.dataset.buttonSize = get('categoryButtonSize') || 'small';
    root.style.setProperty('--zft-scale', String(get('uiScale') || 1));
    const opacity = key => `${Math.max(0, Math.min(100, Number(get(key))))}%`;
    root.style.setProperty('--zft-hud-opacity', opacity('hudBackgroundOpacity'));
    root.style.setProperty('--zft-browser-opacity', opacity('browserBackgroundOpacity'));
    this._applyPosition();
    this._placeEffectDock();
    this._placeBrowser();
    this._settingsWindow?.syncTheme();
    this._settingsWindow?.syncPreferences();
    if (previewKey !== 'uiScale') this._customHotbar?.render(this._actor);
    this._macroLibraries.refresh();
  }

  _selectCategory(id) {
    this._itemPreview.hide(true);
    if (this._browserOpen && this._activeCategory === id) {
      this._setBrowserOpen(false);
      return;
    }
    this._activeCategory = id;
    this._setBrowserOpen(true);
  }

  _setBrowserOpen(open, { resetSearch = false } = {}) {
    if (!open) this._itemPreview.hide(true);
    const popup = this.element?.querySelector('[data-hud-browser]');
    if (!popup) { this._browserOpen = false; return; }
    const hasCategory = Array.from(this.element.querySelectorAll('[data-hud-category]'))
      .some(button => button.dataset.hudCategory === this._activeCategory);
    this._browserOpen = Boolean(open && hasCategory && !game.settings.get(MODULE_ID, 'hudCollapsed'));
    popup.hidden = !this._browserOpen;
    for (const button of this.element.querySelectorAll('[data-hud-category]')) {
      const active = this._browserOpen && button.dataset.hudCategory === this._activeCategory;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-expanded', String(active));
    }
    for (const panel of popup.querySelectorAll('[data-category-panel]')) {
      panel.hidden = !this._browserOpen || panel.dataset.categoryPanel !== this._activeCategory;
    }
    this._applyContextAccents();
    if (this._browserOpen) {
      this._placeBrowser();
      const search = popup.querySelector('[data-category-panel]:not([hidden]) [data-hud-search]');
      if (search && resetSearch) search.value = '';
      this._filterActiveCategory();
    }
  }

  /** Snapshot current DOM before any refresh; retains manually expanded groups and scroll. */
  _captureBrowserState() {
    if (!this.element) return;
    const key = this._actorKey();
    if (!key) { this._browserState.clear(); return; }
    for (const panel of this.element.querySelectorAll('[data-category-panel]')) {
      const id = panel.dataset.categoryPanel;
      const scroll = panel.querySelector('.zft-hud-groups');
      this._browserState.set(`${key}:${id}`, {
        search: panel.querySelector('[data-hud-search]')?.value ?? '',
        groups: [...panel.querySelectorAll('[data-hud-group]')].map(group => ({
          key: group.dataset.groupId || group.querySelector('summary span')?.textContent?.trim(),
          open: group.open
        })),
        scrollTop: scroll?.scrollTop ?? 0
      });
    }
  }

  _savedGroupsFor(panel) {
    const key = this._actorKey();
    const id = panel?.dataset?.categoryPanel;
    if (!key || !id) return {};
    const saved = game.settings.get(MODULE_ID, 'browserExpandedGroups') || {};
    const groups = saved[key]?.[id];
    return groups && typeof groups === 'object' && !Array.isArray(groups) ? groups : {};
  }

  _applySavedGroupState(panel) {
    const lookup = this._savedGroupsFor(panel);
    const defaultOpen = !['spells', 'features'].includes(panel?.dataset?.categoryPanel);
    for (const group of panel.querySelectorAll('[data-hud-group]')) {
      const id = group.dataset.groupId;
      group.open = id && typeof lookup[id] === 'boolean' ? lookup[id] : defaultOpen;
    }
  }

  async _saveExpandedGroups(panel) {
    const actorKey = this._actorKey();
    const category = panel?.dataset.categoryPanel;
    if (!actorKey || !category) return;
    const states = Object.fromEntries([...panel.querySelectorAll('[data-hud-group]')]
      .filter(group => Boolean(group.dataset.groupId))
      .map(group => [group.dataset.groupId, group.open]));
    // Serialize settings writes, so rapid clicks cannot lose earlier categories.
    const operation = async () => {
      const saved = game.settings.get(MODULE_ID, 'browserExpandedGroups') || {};
      await game.settings.set(MODULE_ID, 'browserExpandedGroups', {
        ...saved, [actorKey]: { ...(saved[actorKey] || {}), [category]: states }
      });
    };
    this._expandedSave = this._expandedSave.catch(() => {}).then(operation);
    try { await this._expandedSave; }
    catch (error) { console.warn(`${LOG} | ⚠️ Could not save browser group states`, error); }
  }

  _restoreBrowserState() {
    const key = this._actorKey();
    if (!key || !this.element) return;
    for (const panel of this.element.querySelectorAll('[data-category-panel]')) {
      const stored = this._browserState.get(`${key}:${panel.dataset.categoryPanel}`);
      if (!stored) { this._applySavedGroupState(panel); continue; }
      const search = panel.querySelector('[data-hud-search]');
      if (search) search.value = stored.search;
      // Saved manual states take priority over temporary search auto-expansion.
      this._applySavedGroupState(panel);
      if (this._browserOpen && panel.dataset.categoryPanel === this._activeCategory) this._filterActiveCategory();
      const scroll = panel.querySelector('.zft-hud-groups');
      if (scroll) scroll.scrollTop = stored.scrollTop;
    }
  }

  _positionHpPanel() {
    const panel = this.element?.querySelector('[data-hp-panel]');
    if (!panel || panel.hidden) return;
    const main = this.element?.querySelector('[data-hud-main]')?.getBoundingClientRect();
    const panelHeight = panel.getBoundingClientRect().height;
    const above = main?.top ?? 0;
    const below = window.innerHeight - (main?.bottom ?? window.innerHeight);
    // An HP popup must adapt to the HUD's chosen location, never relocate the
    // docked HUD. Prefer the top when it fits, otherwise choose the available
    // bottom space. When neither fits, use whichever side has more room.
    const fitsAbove = above >= panelHeight + 12;
    const fitsBelow = below >= panelHeight + 12;
    panel.dataset.side = fitsAbove ? 'above' : fitsBelow ? 'below' : above >= below ? 'above' : 'below';
    // The panel can be wider than the HUD. Keep it inside the browser viewport.
    panel.style.left = '0px';
    const bounds = panel.getBoundingClientRect();
    const minX = 8, maxX = window.innerWidth - 8;
    const scale = this._scale?.() ?? 1; // CSS zoom converts local offsets to screen pixels.
    if (bounds.right > maxX) panel.style.left = `${(maxX - bounds.right) / scale}px`;
    if (panel.getBoundingClientRect().left < minX) {
      const rect = panel.getBoundingClientRect();
      panel.style.left = `${Number.parseFloat(panel.style.left) + (minX - rect.left) / scale}px`;
    }
  }

  _setHpPanelOpen(open) {
    const panel = this.element?.querySelector('[data-hp-panel]');
    const trigger = this.element?.querySelector('[data-hud-control="hp"]');
    this._hpPanelOpen = Boolean(open && panel && this._actor?.isOwner);
    if (!panel) { this._hpPanelOpen = false; return; }
    panel.hidden = !this._hpPanelOpen;
    trigger?.setAttribute('aria-expanded', String(this._hpPanelOpen));
    if (this._hpPanelOpen) this._positionHpPanel();
    this._customHotbar?.place();
  }

  /** Use the native document sheet, including bringing an existing window forward. */
  async _openActorSheet() {
    const actor = this._actor;
    if (!actor) return;
    const allowed = actor.testUserPermission?.(game.user, 'OBSERVER') ?? (actor.isOwner || game.user?.isGM);
    if (!allowed) {
      ui.notifications?.warn('You do not have permission to view this character sheet.');
      return;
    }
    try {
      const sheet = actor.sheet;
      if (!sheet || typeof sheet.render !== 'function') {
        ui.notifications?.warn('This character does not have an available sheet.');
        return;
      }
      if (!sheet.rendered) await sheet.render(true);
      sheet.bringToFront?.();
    } catch (error) {
      console.error(`${LOG} | Could not open character sheet`, error);
      ui.notifications?.warn('Could not open character sheet; see console.');
    }
  }

  /** HP mutation always delegates to the active system adapter and Actor permissions. */
  async _adjustHp(mode) {
    const actor = this._actor;
    if (!actor?.isOwner) { ui.notifications?.warn('You do not have permission to modify this Actor.'); return; }
    const input = this.element?.querySelector('[data-hp-amount]');
    // A blank field must never silently become 0 and clear Temporary HP.
    const amount = input?.value?.trim() ? Number(input.value) : NaN;
    if (['damage', 'heal', 'temp'].includes(mode) &&
        (!Number.isSafeInteger(amount) || amount < (mode === 'temp' ? 0 : 1) || amount > 999999)) {
      ui.notifications?.warn(mode === 'temp'
        ? 'Enter a whole number between 0 and 999999 to set Temporary HP.'
        : 'Enter a whole number between 1 and 999999.');
      return;
    }
    if (mode === 'zero') {
      const escapeHtml = value => String(value).replace(/[&<>"']/g,
        ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: 'Set Hit Points to Zero' },
        content: `<p>Set <strong>${escapeHtml(actor.name)}</strong> to 0 HP and clear temporary HP?</p><p>This does not automatically change Defeated or death saves.</p>`,
        modal: true, rejectClose: false
      });
      if (!confirmed) return;
    }
    const buttons = [...(this.element?.querySelectorAll('[data-hp-action]') || [])];
    buttons.forEach(button => { button.disabled = true; });
    try {
      const outcome = await getSystemAdapter()?.adjustHp?.(actor, mode, amount);
      if (outcome?.status !== 'updated') ui.notifications?.warn('HP adjustment unavailable or not permitted.');
      else { this._refreshActorSummary(); debugLog('HP adjusted', { actor: actor.uuid, mode }); }
    } catch (error) {
      console.error(`${LOG} | HP adjustment failed`, error);
      ui.notifications?.error('HP adjustment failed. See console.');
    } finally { buttons.forEach(button => { button.disabled = false; }); }
  }

  /** GM can grant/remove Inspiration; players can only spend their own Inspiration. */
  async _toggleInspiration() {
    const actor = this._actor;
    const adapter = getSystemAdapter();
    if (!actor?.isOwner || !adapter?.setInspiration) return;
    const current = adapter.getInspiration?.(actor);
    if (typeof current !== 'boolean') return;
    if (!current && !game.user?.isGM) {
      ui.notifications?.warn('Only the GM can grant Inspiration.');
      return;
    }
    try {
      const outcome = await adapter.setInspiration(actor, !current);
      if (outcome?.status === 'denied') ui.notifications?.warn('You cannot change Inspiration for this Actor.');
      else if (outcome?.status === 'updated') {
        this._refreshInspiration();
        debugLog('Inspiration changed', { actor: actor.uuid, inspired: !current });
      }
    } catch (error) {
      console.error(`${LOG} | Inspiration update failed`, error);
      ui.notifications?.error('Could not change Inspiration. See console.');
    }
  }

  _refreshInspiration() {
    const button = this.element?.querySelector('[data-hud-control="inspiration"]');
    if (!button) return;
    const active = getSystemAdapter()?.getInspiration?.(this._actor);
    if (typeof active !== 'boolean') return;
    button.classList.toggle('is-inspired', active);
    button.setAttribute('aria-pressed', String(active));
    const title = game.user?.isGM ? (active ? 'Remove Inspiration' : 'Grant Inspiration')
      : (active ? 'Spend Inspiration' : 'Inspiration not available (only GM can grant)');
    button.title = title;
    button.setAttribute('aria-label', title);
    button.disabled = !this._actor?.isOwner || (!active && !game.user?.isGM);
    const icon = button.querySelector('i');
    if (icon) { icon.classList.toggle('fa-solid', active); icon.classList.toggle('fa-regular', !active); }
  }

  /** Update HP without rebuilding actions or losing category-panel state. */
  _refreshActorSummary() {
    if (!this.element || !this._actor) return;
    const health = getSystemAdapter()?.getActorSummary?.(this._actor);
    if (!health) return;
    const label = this.element.querySelector('[data-hp-current]');
    const bar = this.element.querySelector('[data-hp-fill]');
    const panelValue = this.element.querySelector('[data-hp-panel-current]');
    if (label) label.textContent = `${health.value} / ${health.max}`;
    if (bar) bar.style.width = `${health.percent}%`;
    if (panelValue) panelValue.textContent = `${health.value} / ${health.max}`;
    const tempValue = Math.max(0, Number(health.temp) || 0);
    const tempLabel = this.element.querySelector('[data-hp-temp-label]');
    const tempBadge = this.element.querySelector('[data-hp-temp-badge]');
    if (tempLabel) tempLabel.textContent = `+${tempValue}`;
    if (tempBadge) {
      tempBadge.hidden = tempValue <= 0;
      tempBadge.title = `Temporary Hit Points: ${tempValue}`;
      tempBadge.setAttribute('aria-label', `${tempValue} temporary hit points`);
    }
    const miniFill = this.element.querySelector('[data-hp-panel-fill]');
    if (miniFill) miniFill.style.width = `${health.percent}%`;
    const miniMeter = this.element.querySelector('[data-hp-panel-meter]');
    miniMeter?.setAttribute('aria-valuemax', String(health.max));
    miniMeter?.setAttribute('aria-valuenow', String(health.value));
    const panelTemp = this.element.querySelector('[data-hp-panel-temp]');
    if (panelTemp) panelTemp.textContent = `+${tempValue}`;
    const panelTempBadge = this.element.querySelector('[data-hp-panel-temp-badge]');
    if (panelTempBadge) {
      panelTempBadge.hidden = tempValue <= 0;
      panelTempBadge.title = `Current Temporary Hit Points: ${tempValue}`;
    }
  }

  /** Time and combat hooks should not destroy the category browser. */
  _refreshEffectsDurations() {
    if (!this.element || !this._actor ||
        !game.settings.get(MODULE_ID, 'showActiveEffects')) return;
    const effects = getSystemAdapter()?.getActiveEffects?.(this._actor)?.effects ?? [];
    const lookup = new Map(effects.map(effect => [effect.id, effect]));
    const icons = [...this.element.querySelectorAll('[data-hud-effect]')];
    if (icons.length !== effects.length || icons.some(icon => !lookup.has(icon.dataset.hudEffect))) {
      void this.refresh(); // Only rebuild if the set of effects actually changed.
      return;
    }
    // Refresh compact time labels only when they change. World-time hooks may
    // fire frequently and should never rebuild action lists or flood HTML enrichment.
    const changedTooltips = new Set();
    for (const icon of icons) {
      const effect = lookup.get(icon.dataset.hudEffect);
      const badge = icon.querySelector('[data-effect-duration]');
      if (!badge) continue;
      const next = effect.durationShort || '';
      if (badge.textContent !== next || badge.hidden !== !next) {
        badge.textContent = next;
        badge.hidden = !next;
        icon.setAttribute('aria-label', `${effect.name}; ${next ? `${next} remaining; ` : ''}right-click to remove`);
      }
      // The tooltip may change from 2h15m to 2h14m even while a compact badge
      // still displays 3h. Only re-enrich the affected icon, never all effects.
      if ((icon.dataset.zftDurationLabel || '') !== (effect.durationLabel || ''))
        changedTooltips.add(effect.id);
    }
    if (changedTooltips.size) void this._effectTooltips.wire(this.element, effects, this.element.dataset.theme, changedTooltips).catch(error =>
      console.warn(`${LOG} | Could not refresh effect tooltips`, error));
  }

  /** Automatic placement follows the HUD's viewport position; theme and system agnostic. */
  _placeBrowser() {
    const root = this.element;
    const hud = root?.querySelector('[data-hud-main]');
    const popup = root?.querySelector('[data-hud-browser]');
    if (!this._browserOpen || !hud || !popup) return;

    const bounds = root.getBoundingClientRect();
    const scale = Math.max(.5, Number(game.settings.get(MODULE_ID, 'uiScale')) || 1);
    const placement = choosePanelPlacement({
      hudTop: bounds.top,
      hudBottom: bounds.bottom,
      viewportHeight: window.innerHeight
    });

    root.classList.toggle('zft-menu-down', placement.side === 'bottom');
    root.dataset.panelSide = placement.side;
    // The root is zoomed for UI scaling, but available space is measured in viewport pixels.
    popup.style.maxHeight = `${Math.floor(placement.maxHeight / scale)}px`;

    // Keep floating HUD popups horizontally inside the viewport too.
    // Read the rendered width after limiting it for users with increased HUD scaling.
    popup.style.width = '';
    let popupWidth = popup.getBoundingClientRect().width;
    const maxWidth = Math.max(100, window.innerWidth - 16);
    if (popupWidth > maxWidth) {
      popup.style.width = `${Math.floor(maxWidth / scale)}px`;
      popupWidth = popup.getBoundingClientRect().width;
    }
    const rootBounds = root.getBoundingClientRect();
    const constrainedLeft = choosePanelHorizontalPlacement({
      hudLeft: bounds.left,
      hudRight: bounds.right,
      popupWidth,
      viewportWidth: window.innerWidth
    });
    popup.style.right = 'auto';
    popup.style.left = `${(constrainedLeft - rootBounds.left) / scale}px`;
  }

  _watchSidebarPosition() {
    this._sidebarResizeObserver?.disconnect();
    const leftControls = document.querySelector('#controls') || document.querySelector('#ui-left');
    const navigation = [document.querySelector('#navigation'), document.querySelector('#scene-navigation')].filter(Boolean);
    if (typeof ResizeObserver !== 'function' || (!leftControls && !navigation.length)) return;
    this._sidebarResizeObserver = new ResizeObserver(() => {
      const position = game.settings.get(MODULE_ID, 'hudPosition') || DEFAULT_POSITION;
      if (position.mode !== 'floating') {
        this._applyPosition();
        this._placeBrowser();
        this._placeEffectDock();
        if (this._hpPanelOpen) this._positionHpPanel();
      }
    });
    // V13 tool rails and scene menus may change their visible buttons without
    // resizing the full-height parent wrapper. Observe the controls themselves
    // so docking follows UI layout changes without a timer/polling loop.
    const children = document.querySelectorAll(
      '#controls button, #controls .control-tool, #controls [data-tool], '
      + '#ui-left .control-tool, #ui-left [data-tool], '
      + '#navigation .scene, #navigation .scene-name, #scene-navigation button'
    );
    for (const element of new Set([leftControls, ...navigation, ...Array.from(children).slice(0, 100)].filter(Boolean)))
      this._sidebarResizeObserver.observe(element);
  }

  _onViewportResize() {
    if ((game.settings.get(MODULE_ID, 'hudPosition') || DEFAULT_POSITION).mode !== 'floating') this._applyPosition();
    this._clampFloatingPosition();
    this._placeEffectDock();
    this._placeBrowser();
    if (this._hpPanelOpen) this._positionHpPanel();
    this._hudScaleControl.position();
    this._customHotbar?.place();
  }

  /** Keep the effect icons attached without altering the HUD's saved coordinates. */
  _placeEffectDock() {
    const dock = this.element?.querySelector('.zft-hud-effects-strip');
    const main = this.element?.querySelector('[data-hud-main]');
    if (!dock || !main) return;
    const rect = main.getBoundingClientRect();
    const dockHeight = dock.getBoundingClientRect().height;
    const below = rect.top < dockHeight + 10;
    dock.dataset.side = below ? 'below' : 'above';
    this.element.style.setProperty('--zft-effects-bottom-offset', below ? `${dockHeight + 7}px` : '0px');
  }

  _filterActiveCategory(autoExpand = false) {
    const panel = this.element?.querySelector(`[data-category-panel="${this._activeCategory}"]`);
    if (!panel) return;
    const query = (panel.querySelector('[data-hud-search]')?.value || '').trim().toLocaleLowerCase();
    const key = `${this._actorKey()}:${this._activeCategory}`;
    const prior = this._browserSearchQueries.get(key) || '';
    this._browserSearchQueries.set(key, query);
    if (!query && prior) this._applySavedGroupState(panel);
    let totalVisible = 0;
    for (const group of panel.querySelectorAll('[data-hud-group]')) {
      let count = 0;
      group.querySelectorAll('[data-filter-name]').forEach(item => {
        const visible = !query || item.dataset.filterName.toLocaleLowerCase().includes(query);
        item.hidden = !visible;
        if (visible) count += 1;
      });
      // Empty spell-level headings still carry actionable slot shields.
      group.hidden = count === 0 && (!group.querySelector('[data-hud-resource-adjust]') || Boolean(query));
      if (autoExpand && query && count) group.open = true;
      totalVisible += count;
    }
    const empty = panel.querySelector('[data-hud-empty-filter]');
    if (empty) empty.hidden = totalVisible !== 0;
  }

  _outsidePointer(event) {
    if (!this.element) return;
    // Do not dismiss attached windows when the user grabs the HUD to move it.
    if (this.element.contains(event.target) && event.target.closest('[data-drag-handle]')) return;
    // HUD utility windows are persistent. Only explicit close/Escape, hiding
    // their parent HUD, or changing characters should dismiss them.
    // Clicking canvas, token controls or other Foundry windows is not a close action.
  }

  _escape(event) {
    if (event.key !== 'Escape') return;
    if (this._effectTooltips.isVisible) { this._effectTooltips.hide(true); return; }
    if (this._hpPanelOpen) { this._setHpPanelOpen(false); return; }
    if (this._itemPreview.isVisible) {
      this._itemPreview.hide(true);
      return;
    }
    if (this._settingsWindow?.rendered) this._settingsWindow.close();
    else if (this._browserOpen) this._setBrowserOpen(false);
  }

  async _inspectItem(id) {
    this._itemPreview.hide(true);
    try {
      const ok = await getSystemAdapter()?.inspectItem?.(this._actor, id);
      if (!ok) ui.notifications?.warn('Cannot inspect this Item with your current permissions.');
    } catch (error) {
      console.error(`${LOG} | ❌ Item inspection failed`, error);
      ui.notifications?.warn('Could not open Item sheet; see console.');
    }
  }

  async _executeItem(id) {
    this._itemPreview.hide(true);
    const actor = this._actor;
    const actorKey = this._actorKey(actor);
    if (!actorKey || !id || this._activeUses.has(`${actorKey}:${id}`)) return;
    const pendingKey = `${actorKey}:${id}`;
    this._activeUses.add(pendingKey);
    try {
      const outcome = await getSystemAdapter()?.executeItem?.(actor, id);
      if (outcome?.status === 'used') {
        const stored = game.settings.get(MODULE_ID, 'recentByActor') || {};
        await game.settings.set(MODULE_ID, 'recentByActor', {
          ...stored, [actorKey]: pushRecent(this._recentIds(actor), id)
        });
        debugLog('Native Item use completed', { actor: actor.name, itemId: id });
        await this.refresh();
      } else if (outcome?.status === 'source-missing') {
        ui.notifications?.warn('This cached spell no longer has a valid source Item/Activity. Reimport or repair the source.');
      } else if (outcome?.status === 'denied') {
        ui.notifications?.warn('Cannot use this Item: it is unavailable or you do not have ownership.');
      } else if (outcome?.status === 'unsupported' || !outcome) {
        ui.notifications?.warn('This RPG adapter cannot execute that Item.');
      } // An undefined result means the player cancelled a native dialog.
    } catch (error) {
      console.error(`${LOG} | ❌ Native Item execution failed`, { actor: actor?.name, id }, error);
      ui.notifications?.error('Action use failed. See the browser console for details.');
    } finally {
      this._activeUses.delete(pendingKey);
    }
  }

  async _toggleFavorite(id) {
    const key = this._actorKey();
    if (!key || !(getSystemAdapter()?.hasAction?.(this._actor, id) ?? this._actor?.items?.get(id))) return;
    await saveFavorites(this._actor, toggleId(this._favoriteIds(), id), getSystemAdapter());
    await this.refresh();
  }

  async _toggleQuickAccess(tab) {
    const selected = game.settings.get(MODULE_ID, 'quickAccessTab');
    const collapsed = game.settings.get(MODULE_ID, 'favoritesCollapsed');
    const closing = !collapsed && selected === tab;
    if (selected !== tab) await game.settings.set(MODULE_ID, 'quickAccessTab', tab);
    await game.settings.set(MODULE_ID, 'favoritesCollapsed', closing);
    await this.refresh();
  }

  _wireFavoriteDragging() {
    const root = this.element;
    // Standard HTML drag/drop ensures a drag gesture never calls an Item use.
    const sources = root.querySelectorAll('[data-favorite-drag-item], [data-category-drag-item]');
    sources.forEach(element => {
      element.addEventListener('dragstart', event => {
        const id = element.dataset.favoriteDragItem || element.dataset.categoryDragItem;
        if (!id || !(getSystemAdapter()?.hasAction?.(this._actor, id) ?? this._actor?.items?.get(id))) { event.preventDefault(); return; }
        this._itemDrag = { id, actorKey: this._actorKey() };
        event.dataTransfer.effectAllowed = 'copyMove';
        event.dataTransfer.setData('text/plain', `zft-action-hud:${id}`);
        event.dataTransfer.setData('application/x-zft-hud-action', JSON.stringify({ id, actor: this._actor?.uuid, source: 'browser' }));
        element.classList.add('is-dragging');
      });
      element.addEventListener('dragend', () => {
        this._itemDrag = null;
        this._dragSuppressUntil = performance.now() + 250;
        this._clearDragIndicators();
      });
    });

    // A category Item can be dropped on the collapsed Favorites button.
    // When expanded, dropping before a Favorite reorders the saved list.
    root.querySelectorAll('[data-favorite-dropzone], [data-quick-access-dropzone], [data-favorite-drag-item]').forEach(target => {
      target.addEventListener('dragover', event => {
        if (!this._itemDrag || this._itemDrag.actorKey !== this._actorKey()) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        this._clearDragIndicators();
        target.classList.add('is-drop-target');
      });
      target.addEventListener('dragleave', () => target.classList.remove('is-drop-target'));
      target.addEventListener('drop', async event => {
        if (!this._itemDrag || this._itemDrag.actorKey !== this._actorKey()) return;
        event.preventDefault();
        event.stopPropagation();
        const { id, actorKey } = this._itemDrag;
        const beforeId = target.dataset.favoriteDragItem || null;
        this._itemDrag = null;
        this._dragSuppressUntil = performance.now() + 250;
        this._clearDragIndicators();
        try {
          if (!this._actor?.isOwner || actorKey !== this._actorKey()) return;
          await saveFavorites(this._actor, placeFavorite(this._favoriteIds(), id, beforeId), getSystemAdapter());
          // Dropping directly into Favorites reveals the resulting order.
          await game.settings.set(MODULE_ID, 'quickAccessTab', 'favorites');
          await game.settings.set(MODULE_ID, 'favoritesCollapsed', false);
          await this.refresh();
        } catch (error) {
          console.error(`${LOG} | ❌ Favorite drop failed`, error);
          ui.notifications?.warn('Could not save Favorites order. See console.');
        }
      });
    });
  }

  _clearDragIndicators() {
    this.element?.querySelectorAll('.is-drop-target,.is-dragging').forEach(el => {
      el.classList.remove('is-drop-target','is-dragging');
    });
  }

  async _cycleTheme(direction = 1) {
    const current = game.settings.get(MODULE_ID, 'clientTheme');
    await game.settings.set(MODULE_ID, 'clientTheme', nextClientTheme(current, direction));
  }

  /** Root CSS zoom scales fixed-position coordinates. Store screen pixels in settings. */
  _scale() {
    return Math.max(0.5, Number(this.element?.style?.getPropertyValue?.('--zft-scale')) ||
      Number(game.settings.get(MODULE_ID, 'uiScale')) || 1);
  }

  _applyPosition() {
    const position = game.settings.get(MODULE_ID, 'hudPosition') || DEFAULT_POSITION;
    const root = this.element;
    if (!root) return;
    if (root.parentElement !== document.body) document.body.append(root);
    root.dataset.mode = position.mode === 'floating' ? 'floating' : 'docked';
    for (const prop of ['top', 'bottom', 'left', 'right', 'transform']) root.style.removeProperty(prop);
    // A dock is a viewport/UI anchor, never an old pixel position. This fixes
    // clients left at the previous dev.41/42 pseudo-docked coordinates.
    if (position.mode !== 'floating') {
      root.style.transform = 'none';
      // Measure the *visible toolbar buttons*, not the full-height Foundry UI
      // wrapper. The latter can conceal a second rail column and is too narrow.
      const { controls, controlTools, navigation } = foundryDockObstacles(document);
      const rect = root.querySelector('[data-hud-main]')?.getBoundingClientRect() || root.getBoundingClientRect();
      const { x, y } = upperLeftDockPosition({
        width: window.innerWidth, height: window.innerHeight,
        hudWidth: rect.width, hudHeight: rect.height,
        controls, controlTools, navigation
      });
      const scale = this._scale();
      // Native Foundry may set ApplicationV2 geometry after our render hook.
      // CSS docking variables win over late inline bottom/left coordinates.
      root.style.setProperty('--zft-dock-left', `${x / scale}px`);
      root.style.setProperty('--zft-dock-top', `${y / scale}px`);
      root.style.setProperty('left', `${x / scale}px`, 'important');
      root.style.setProperty('top', `${y / scale}px`, 'important');
      root.style.setProperty('right', 'auto', 'important');
      root.style.setProperty('bottom', 'auto', 'important');
      this._syncPositionControl();
      return;
    }
    root.style.removeProperty('--zft-dock-left');
    root.style.removeProperty('--zft-dock-top');
    if (Number.isFinite(position.x) && Number.isFinite(position.y)) {
      const scale = this._scale();
      root.style.left = `${position.x / scale}px`;
      root.style.top = `${position.y / scale}px`;
      root.style.bottom = 'auto';
      root.style.transform = 'none';
      this._clampHudPosition();
    }
    this._syncPositionControl();
  }

  _clampHudPosition() {
    if (!this.element) return;
    const position = game.settings.get(MODULE_ID, 'hudPosition') || DEFAULT_POSITION;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
    const rect = this.element.getBoundingClientRect();
    const maxLeft = Math.max(8, innerWidth - rect.width - 8);
    const maxTop = Math.max(8, innerHeight - rect.height - 8);
    const scale = this._scale();
    this.element.style.left = `${Math.round(Math.max(8, Math.min(maxLeft, rect.left)) / scale)}px`;
    this.element.style.top = `${Math.round(Math.max(8, Math.min(maxTop, rect.top)) / scale)}px`;
  }

  _clampFloatingPosition() {
    this._clampHudPosition();
  }

  async _togglePosition(direction = 1) {
    // Both click directions must use the same saved position and lock settings.
    if (this._positionTransitionBusy) return;
    this._positionTransitionBusy = true;
    try {
      const mode = (game.settings.get(MODULE_ID, 'hudPosition') || DEFAULT_POSITION).mode;
      const state = currentPositionState(mode, game.settings.get(MODULE_ID, 'hudFloatingLocked'));
      const next = nextPositionState(state, direction);
      if (next === 'docked') {
        await this._setPositionMode('docked');
      } else if (next === 'floating') {
        if (game.settings.get(MODULE_ID, 'hudFloatingLocked'))
          await game.settings.set(MODULE_ID, 'hudFloatingLocked', false);
        await this._setPositionMode('floating');
      } else {
        // Backward from Docked enters Floating Locked directly; preserve the
        // last floating coordinates before enabling the movement lock.
        if (mode !== 'floating') await this._setPositionMode('floating');
        await game.settings.set(MODULE_ID, 'hudFloatingLocked', true);
      }
      this._syncPositionControl();
      this._settingsWindow?.syncPreferences?.();
    } finally {
      this._positionTransitionBusy = false;
    }
  }

  async _setPositionMode(mode) {
    const current = game.settings.get(MODULE_ID, 'hudPosition') || DEFAULT_POSITION;
    if (!['docked', 'floating'].includes(mode)) return;
    // Module Settings and the floating settings panel use the same control value.
    // Avoid feeding back into an onChange callback when it already matches.
    if (mode === current.mode && !(mode === 'docked' && (Number.isFinite(current.x) || Number.isFinite(current.y)))) {
      if (game.settings.get(MODULE_ID, 'hudPositionMode') !== mode)
        await game.settings.set(MODULE_ID, 'hudPositionMode', mode);
      return;
    }
    const rect = this.element?.querySelector('[data-hud-main]')?.getBoundingClientRect()
      || this.element?.getBoundingClientRect();
    // Capture the current on-screen location, even for a previously default-docked HUD.
    // Dock is the responsive upper-left anchor; undocking restores saved floating coordinates.
    // Never reuse a past dock location as a floating offset if a floating position exists.
    const previous = game.settings.get(MODULE_ID, 'lastFloatingPosition') || {};
    const x = mode === 'floating' ? (Number.isFinite(previous.x) ? previous.x : Math.round(rect?.left ?? 24)) : null;
    const y = mode === 'floating' ? (Number.isFinite(previous.y) ? previous.y : Math.round(rect?.top ?? 80)) : null;
    if (mode === 'docked' && current.mode === 'floating' && Number.isFinite(current.x) && Number.isFinite(current.y))
      await game.settings.set(MODULE_ID, 'lastFloatingPosition', { x:current.x, y:current.y });
    await game.settings.set(MODULE_ID, 'hudPosition', { mode, x, y });
    if (game.settings.get(MODULE_ID, 'hudPositionMode') !== mode)
      await game.settings.set(MODULE_ID, 'hudPositionMode', mode);
    if (this.element) {
      this._applyPosition();
      this._placeBrowser();
    }
    this._settingsWindow?._updatePositionControl?.();
    this._hudScaleControl.position();
    if (this._hpPanelOpen) this._positionHpPanel();
    this._customHotbar?.place();
  }

  async _toggleCollapsed() {
    const now = game.settings.get(MODULE_ID, 'hudCollapsed');
    await game.settings.set(MODULE_ID, 'hudCollapsed', !now);
    if (!now) {
      this._browserOpen = false;
      this._hpPanelOpen = false;
      this._hudScaleControl.close();
    }
    await this.refresh();
  }

  _dragStart(event) {
    if (event.button !== 0 || event.target.closest('button') || !this.element ||
      ((game.settings.get(MODULE_ID, 'hudPosition') || DEFAULT_POSITION).mode !== 'floating' ||
       game.settings.get(MODULE_ID, 'hudFloatingLocked'))) return;
    event.preventDefault();
    const rect = this.element.getBoundingClientRect();
    this._drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    // Preserve category/browser, HP panel and scale popover while dragging.
    this._itemPreview.hide(true);
    this.element.dataset.mode = 'floating';
    this.element.style.transform = 'none';
    const scale = this._scale();
    this.element.style.left = `${rect.left / scale}px`;
    this.element.style.top = `${rect.top / scale}px`;
    this.element.style.bottom = 'auto';
    document.addEventListener('pointermove', this._boundDragMove);
    document.addEventListener('pointerup', this._boundDragEnd, { once: true });
    document.addEventListener('pointercancel', this._boundDragEnd, { once: true });
  }

  _dragMove(event) {
    if (!this._drag || !this.element) return;
    const rect = this.element.getBoundingClientRect();
    const maxLeft = Math.max(8, innerWidth - rect.width - 8);
    const maxTop = Math.max(8, innerHeight - rect.height - 8);
    const x = Math.max(8, Math.min(maxLeft, event.clientX - this._drag.dx));
    const y = Math.max(8, Math.min(maxTop, event.clientY - this._drag.dy));
    const scale = this._scale();
    this.element.style.left = `${x / scale}px`;
    this.element.style.top = `${y / scale}px`;
    this._placeBrowser();
    if (this._hpPanelOpen) this._positionHpPanel();
    this._placeEffectDock();
    this._hudScaleControl.position();
    this._customHotbar?.place();
  }

  async _dragEnd() {
    document.removeEventListener('pointermove', this._boundDragMove);
    document.removeEventListener('pointerup', this._boundDragEnd);
    document.removeEventListener('pointercancel', this._boundDragEnd);
    if (!this._drag || !this.element) return;
    this._drag = null;
    try {
      const rect = this.element.getBoundingClientRect();
      const remembered = { x: Math.round(rect.left), y: Math.round(rect.top) };
      await game.settings.set(MODULE_ID, 'hudPosition', { mode: 'floating', ...remembered });
      await game.settings.set(MODULE_ID, 'lastFloatingPosition', remembered);
    } catch (error) {
      console.warn(`${LOG} | ⚠️ Could not save floating position`, error);
    }
  }

  async refresh() {
    if (!game.settings.get(MODULE_ID, 'enabled')) {
      if (this.rendered) await this.close();
      return;
    }
    this._captureBrowserState();
    await this.render(true);
  }

  async _onClose(options) {
    this._effectTooltips.destroy();
    this._itemPreview.destroy();
    this._sidebarResizeObserver?.disconnect();
    this._sidebarResizeObserver = null;
    document.removeEventListener('pointerdown', this._boundOutside, true);
    document.removeEventListener('keydown', this._boundEscape);
    window.removeEventListener('resize', this._boundViewportResize);
    document.removeEventListener('pointermove', this._boundDragMove);
    document.removeEventListener('pointerup', this._boundDragEnd);
    document.removeEventListener('pointercancel', this._boundDragEnd);
    this._drag = null;
    this._itemDrag = null;
    this._macroLibraries.destroy();
    this._customHotbar.destroy();
    this._hudScaleControl.close();
    if (this._settingsWindow?.rendered) await this._settingsWindow.close();
    await super._onClose(options);
  }
}
