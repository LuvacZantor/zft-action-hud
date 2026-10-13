import { MODULE_ID } from './settings.js';
import { currentPositionState, nextPositionState, positionControlPresentation } from './position-control.js';
import { ZFTScalePopover } from './scale-popover.js';
import { CombatProfileCoordinator } from './combat-profile.js';
import { ZFTButtonColors, applyButtonColor } from './button-colors.js';
import { getSystemAdapter } from '../adapters/registry.js';
import { macroUuidFromDrop, macroDocumentSync, macroDocument, makeMacroReference, isMacroReference, executeHotbarMacro } from './macro-hotbar.js';
import { actionReference, resolveActionReference, storedHotbarSlots, saveHotbarSlots, assignHotbarSlot, storedHotbarDividers, saveHotbarDividers, hotbarColumnTracks, storedHotbarRowDividers, saveHotbarRowDividers, hotbarRowTracks, hotbarDividerLabels, setHotbarDividerLabel, hotbarProfiles, activeHotbarProfile, ensureHotbarProfiles, saveHotbarDimensions, createHotbarProfile, renameHotbarProfile, deleteHotbarProfile, selectHotbarProfile, switchHotbarProfileFast, isBuiltinHotbarProfile, hotbarProfileAccent, setHotbarProfileAccent, reorderHotbarProfile, hotbarSlotColor, setHotbarSlotColor, MAX_HOTBAR_PROFILES } from './actor-quick-access.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));
const STYLE_TOKENS = [
  '--zft-accent','--zft-accent-bright','--zft-text','--zft-muted',
  '--zft-bg','--zft-panel','--zft-panel2','--zft-panel3',
  '--zft-border','--zft-inset','--zft-shadow','--zft-button-width',
  '--zft-button-height','--zft-button-icon-size','--zft-font'
];

function element(tag, className = '', title = '') {
  const el = document.createElement(tag);
  el.className = className;
  if (title) el.title = title;
  return el;
}
function fa(icon) {
  const node = element('i', `fa-solid fa-${icon}`);
  node.setAttribute('aria-hidden', 'true');
  return node;
}
function readDrop(event, actor) {
  const raw = event.dataTransfer?.getData('application/x-zft-hud-action') ||
    event.dataTransfer?.getData('text/plain') || '';
  try {
    const json = JSON.parse(raw);
    if (json?.actor === actor?.uuid && typeof json.id === 'string') {
      if (json.kind === 'macro') {
        const uuid = macroUuidFromDrop({type:'Macro',uuid:json.uuid});
        return uuid ? { macroUuid: uuid, from: json.source === 'hotbar' ? Number(json.slot) : null } : null;
      }
      return { id: json.id, from: json.source === 'hotbar' ? Number(json.slot) : null };
    }
    const macroUuid = macroUuidFromDrop(json);
    if (macroUuid) return { macroUuid, from: null };
    // Foundry Item drag; accept only Items belonging to the active Actor.
    if (json?.type === 'Item' && typeof json.uuid === 'string' && json.uuid.startsWith(`${actor?.uuid}.Item.`)) {
      const id = json.uuid.split('.').at(-1);
      return { id, from: null };
    }
  } catch { /* legacy text/plain zft-action-hud:<id> handled below */ }
  if (raw.startsWith('zft-action-hud:')) return { id: raw.slice('zft-action-hud:'.length), from: null };
  return null;
}

/** Independently movable character hotbar with an Actor-owned slot arrangement. */
export class ZFTCustomHotbar {
  constructor(hud) {
    this.hud = hud;
    this._combatProfiles = new CombatProfileCoordinator(this);
    this._colorUI = new ZFTButtonColors();
    this.root = null;
    this.actor = null;
    this._drag = null;
    this._draggedSlot = null;
    this._resize = null;
    this._pendingRender = false;
    // An explicit floating mode without stored coordinates gets one stable,
    // client-local anchor rather than shifting as the zoomed width changes.
    this._floatingFallback = null;
    this._busy = false;
    this._editingDividers = false;
    this._dividerDrag = null;
    this._dividerSuppressUntil = 0;
    this._dividerLabelPanel = null;
    this._dividerLabelDismiss = event => {
      if (!this._dividerLabelPanel?.contains(event.target)) this._closeDividerLabelEditor();
    };
    this._profileClickTimer = null;
    this._profileContext = null;
    this._singleProfilePanel = null;
    this._singleProfileDismiss = event => {
      if (!this._singleProfilePanel?.contains(event.target)) this._closeSingleProfileEditor();
    };
    this._profileContextDismiss = event => {
      if (!this._profileContext?.contains(event.target)) this._closeProfileContext();
    };
    this._profileNavFrame = null;
    this._scaleControl = new ZFTScalePopover({
      id: 'zft-action-hud-hotbar-scale', label: 'Hotbar Scale', setting: 'hotbarUiScale',
      min: 0.5, max: 1.5, trigger: () => this.root?.querySelector('[data-hotbar-command="scale"]'),
      source: () => this.root, preview: value => this.previewScale(value)
    });
    this._profilePanel = null;
    this._profileDismiss = event => {
      if (!this._profilePanel?.contains(event.target) && !this.root?.querySelector('[data-hotbar-command="profiles"]')?.contains(event.target))
        this._closeProfileEditor();
    };
    this._migratingProfiles = new Set();
    this._suppressUntil = 0;
    this._onMove = event => this._move(event);
    this._onEnd = event => this._end(event);
  }

  _settings(key) { return game.settings.get(MODULE_ID, key); }
  _dimensions() {
    const profile = activeHotbarProfile(this.actor);
    return { rows: clamp(profile.rows, 1, 20), columns: clamp(profile.columns, 1, 20) };
  }
  _migrateProfiles(actor) {
    if (!actor?.isOwner) return;
    const stored=actor.getFlag?.(MODULE_ID,'hotbarProfiles');
    if(stored?.schema===2 && ['combat','exploration','support'].every(id=>stored.profiles?.some(p=>p.id===id)))return;
    const key = actor.uuid || actor.id;
    if (this._migratingProfiles.has(key)) return;
    this._migratingProfiles.add(key);
    void ensureHotbarProfiles(actor).catch(error => {
      console.error('[ZFT] Could not migrate legacy hotbar profile', error);
      ui.notifications?.warn('Could not migrate hotbar profile; existing slots have been retained.');
    }).finally(() => { this._migratingProfiles.delete(key); });
  }

  render(actor = this.hud._actor) {
    if (actor?.uuid !== this.actor?.uuid) { this._closeDividerLabelEditor(); this._colorUI.close(); this._closeProfileEditor(); this._closeSingleProfileEditor(); this._closeScalePopover(); this._closeProfileContext(); }
    this.actor = actor;
    // A routine Actor/HUD refresh must not replace the active drag handle.
    if (this._resize || this._drag || this._dividerDrag) { this._pendingRender = true; return; }
    if (!this._settings('enabled') || !this._settings('showCustomHotbar') || !actor) {
      this.hide();
      return;
    }
    this._migrateProfiles(actor);
    this._pendingRender = false;
    if (this._profileClickTimer) { clearTimeout(this._profileClickTimer); this._profileClickTimer = null; }
    if (this._profileNavFrame !== null) { cancelAnimationFrame(this._profileNavFrame); this._profileNavFrame = null; }
    this._profileScroll = this.root?.querySelector('.zft-hotbar-profile-tabs')?.scrollLeft ?? this._profileScroll ?? 0;
    this._closeDividerLabelEditor();
    this.hud._itemPreview?.hide(true);
    this._colorUI.close();
    if (!this.root) {
      this.root = element('section', 'zft-hotbar-root');
      this.root.id = 'zft-action-hud-hotbar';
      this.root.setAttribute('aria-label', 'ZFT custom character hotbar');
      document.body.append(this.root);
    }
    const root = this.root;
    root.replaceChildren();
    root.dataset.theme = this.hud.element?.dataset.theme || 'zft-default';
    root.dataset.textures = String(Boolean(this._settings('showThemeTextures')));
    root.dataset.locked = String(Boolean(this._settings('hotbarLocked')));
    root.dataset.positionLocked = String(Boolean(this._settings('hotbarPositionLocked')));
    root.dataset.dockMode = this._dockMode();
    root.dataset.labels = String(this._settings('showHotbarLabels'));
    root.dataset.collapsed = String(Boolean(this._settings('hotbarCollapsed')));
    const scale = this._settings('hotbarUiScale') || 1;
    root.style.setProperty('--zft-scale', String(scale));
    const hud = this.hud.element;
    if (hud) {
      const styles = getComputedStyle(hud);
      for (const token of STYLE_TOKENS) {
        const value = styles.getPropertyValue(token);
        if (value) root.style.setProperty(token, value.trim());
      }
    }
    const { rows, columns } = this._dimensions();
    const locked = Boolean(this._settings('hotbarLocked'));
    const actorWritable = Boolean(actor.isOwner);
    const profilesState = hotbarProfiles(actor);
    const activeAccent = hotbarProfileAccent(actor, profilesState.active);
    // Custom profiles without overrides continue to inherit the current HUD theme.
    if (activeAccent) root.style.setProperty('--zft-hotbar-accent',activeAccent);
    else root.style.removeProperty('--zft-hotbar-accent');
    root.dataset.multipleProfiles = String(profilesState.profiles.length > 1);
    // The two locks are independent and ALWAYS available, even when both locked.
    const positionLocked = Boolean(this._settings('hotbarPositionLocked'));
    if (locked) { this._closeScalePopover(); this._closeProfileEditor(); }
    const positionState = currentPositionState(this._dockMode(), positionLocked);
    const positionInfo = positionControlPresentation(positionState, 'Custom Hotbar');
    const header = element('div', 'zft-hotbar-header',
      positionState === 'docked' ? 'Docked to bottom center' : positionLocked ? 'Floating position locked' : 'Drag here to move the hotbar');
    header.dataset.hotbarDrag = '';
    const grip = element('span', 'zft-hotbar-grip', positionLocked ? 'Hotbar position locked' : 'Drag to move custom hotbar');
    grip.append(fa(positionLocked ? 'lock' : 'grip-lines'));
    const gripLabel = element('span', 'zft-hotbar-grip-label');
    gripLabel.textContent = ' Custom Hotbar';
    grip.append(gripLabel);
    header.append(grip);
    const controls = element('div', 'zft-hotbar-controls');
    // Profile tabs start on the left; navigation arrows only appear when needed.
    const strip = element('div', 'zft-hotbar-profile-strip');
    const pinned = element('div', 'zft-hotbar-profile-pinned');
    pinned.setAttribute('role','tablist');pinned.setAttribute('aria-label','Built-in profiles');
    const tabs = element('div', 'zft-hotbar-profile-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Hotbar profiles');
    const previous = element('button', 'zft-hotbar-profile-nav', 'Scroll profiles left');
    previous.type = 'button'; previous.dataset.hotbarProfileNav = 'left';
    previous.setAttribute('aria-label', 'Scroll profiles left'); previous.append(fa('chevron-left'));
    const following = element('button', 'zft-hotbar-profile-nav', 'Scroll profiles right');
    following.type = 'button'; following.dataset.hotbarProfileNav = 'right';
    following.setAttribute('aria-label', 'Scroll profiles right'); following.append(fa('chevron-right'));
    for (const profile of profilesState.profiles) {
      const tab = element('button', 'zft-hotbar-profile-tab', `Switch to ${profile.name} profile; right-click to customize`);
      tab.type = 'button'; tab.dataset.hotbarProfile = profile.id;
      tab.setAttribute('role','tab'); tab.setAttribute('aria-selected',String(profile.id === profilesState.active));
      tab.setAttribute('aria-label',`Switch to ${profile.name} profile`);
      tab.disabled = !actorWritable;
      tab.textContent = profile.name;
      const accent = hotbarProfileAccent(actor, profile.id);
      if (accent) tab.style.setProperty('--zft-profile-accent',accent);
      if (!isBuiltinHotbarProfile(profile.id)) tab.draggable = actorWritable;
      (isBuiltinHotbarProfile(profile.id) ? pinned : tabs).append(tab);
    }
    strip.append(pinned, previous, tabs, following);
    header.append(strip);
    const positionButton = element('button', 'zft-hotbar-position-mode', positionInfo.label);
    positionButton.type = 'button';
    positionButton.dataset.hotbarCommand = 'position-mode';
    positionButton.dataset.positionState = positionState;
    positionButton.setAttribute('aria-label', positionInfo.label);
    positionButton.append(fa(positionInfo.icon));
    controls.append(positionButton);
    const lock = element('button', 'zft-hotbar-lock', locked ? 'Unlock hotbar layout' : 'Lock hotbar layout');
    lock.type = 'button';
    lock.dataset.hotbarCommand = 'lock';
    lock.setAttribute('aria-label', locked ? 'Unlock hotbar layout' : 'Lock hotbar layout');
    lock.setAttribute('aria-pressed', String(locked));
    lock.append(fa(locked ? 'table-cells-large' : 'table-cells'));
    controls.append(lock);
    const collapsed = Boolean(this._settings('hotbarCollapsed'));
    const minimize = element('button', 'zft-hotbar-collapse', collapsed ? 'Expand hotbar' : 'Minimize hotbar');
    minimize.type = 'button'; minimize.dataset.hotbarCommand = 'collapse';
    minimize.setAttribute('aria-label', collapsed ? 'Expand hotbar' : 'Minimize hotbar');
    minimize.setAttribute('aria-expanded', String(!collapsed));
    minimize.append(fa('chevron-down'));
    controls.append(minimize);
    header.append(controls);
    root.append(header);
    if (!collapsed && !locked) {
      const config = element('div', 'zft-hotbar-grid-settings');
      for (const [key, label, value, max] of [['hotbarRows', 'Rows', rows, 20], ['hotbarColumns', 'Columns', columns, 20]]) {
        const wrap = element('label');
        wrap.textContent = `${label} `;
        const input = element('input');
        input.type = 'number'; input.min = '1'; input.max = String(max); input.step = '1';
        input.value = String(value); input.dataset.hotbarSetting = key;
        input.setAttribute('aria-label', `Hotbar ${label}`);
        wrap.append(input); config.append(wrap);
      }
      const toggle = element('button', 'zft-hotbar-divider-toggle', 'Edit visual row and column dividers');
      toggle.type = 'button'; toggle.dataset.hotbarCommand = 'dividers';
      toggle.textContent = 'Dividers';
      toggle.setAttribute('aria-pressed', String(this._editingDividers));
      toggle.disabled = !actorWritable;
      const scaleButton = element('button', 'zft-hotbar-divider-toggle zft-hotbar-scale-toggle', 'Adjust custom hotbar scale');
      scaleButton.type = 'button'; scaleButton.dataset.hotbarCommand = 'scale';
      scaleButton.setAttribute('aria-label', 'Adjust custom hotbar scale');
      scaleButton.setAttribute('aria-pressed', String(this._scaleControl.open));
      scaleButton.append(fa('magnifying-glass')); scaleButton.append(document.createTextNode(' Scale'));
      const profileButton = element('button', 'zft-hotbar-divider-toggle', 'Manage hotbar profiles');
      profileButton.type = 'button'; profileButton.dataset.hotbarCommand = 'profiles';
      profileButton.textContent = 'Profiles'; profileButton.disabled = !actorWritable;
      config.prepend(profileButton, toggle, scaleButton);
      root.append(config);
      if (this._editingDividers && actorWritable) {
        const help = element('div', 'zft-hotbar-divider-help');
        help.textContent = 'Top +: columns · Left +: rows · Drag to move · Right-click × to name · Click × to remove';
        root.append(help);
        root.append(element('div', 'zft-hotbar-divider-editor'));
      }
    }
    if (!collapsed) {
    const wrap = element('div', 'zft-hotbar-grid-wrap');
    if (this._editingDividers && !locked && actorWritable) wrap.classList.add('is-editing-rows');
    const grid = element('div', 'zft-hotbar-grid');
    const dividers = storedHotbarDividers(actor);
    const labelState = hotbarDividerLabels(actor);
    grid.style.gridTemplateColumns = hotbarColumnTracks(columns, dividers);
    grid.style.gridTemplateRows = hotbarRowTracks(rows, storedHotbarRowDividers(actor), labelState.rows);
    if (Object.keys(labelState.columns).some(key => Number(key) < columns)) {
      const rail = element('div','zft-hotbar-divider-label-rail');
      rail.setAttribute('aria-label','Named column dividers');
      wrap.append(rail);
    }
    const refs = storedHotbarSlots(actor);
    const adapter = getSystemAdapter();
    for (let index = 0; index < rows * columns; index++)
      grid.append(this._createSlot(index, refs, adapter, locked, actorWritable));
    wrap.append(grid);
    const overlay = element('div', 'zft-hotbar-divider-overlay');
    overlay.setAttribute('aria-hidden', 'true');
    wrap.append(overlay);
    if (this._editingDividers && !locked && actorWritable) {
      const rowEditor = element('div', 'zft-hotbar-row-divider-editor');
      rowEditor.setAttribute('aria-label', 'Horizontal divider boundaries');
      wrap.append(rowEditor);
    }
    root.append(wrap);
    this._applyDividerLayout(columns, dividers);
    if (!locked) {
      const grip = element('div', 'zft-hotbar-resize', 'Drag to change hotbar rows and columns');
      grip.dataset.hotbarResize = '';
      grip.setAttribute('role', 'separator');
      grip.setAttribute('aria-label', 'Resize hotbar grid');
      root.append(grip);
      const indicator = element('output', 'zft-hotbar-size-indicator');
      indicator.setAttribute('aria-live', 'off');
      root.append(indicator);
    }
    } // End expandable grid.
    this._wire();
    this.hud._itemPreview?.wire(root);
    this.place();
    if (this._scaleControl.open) this._scaleControl.sync();
    if (this._profilePanel && !locked) this._positionProfileEditor();
  }

  /** Slot rectangles provide a common geometric source for both orientations. */
  _dividerPositions(columns) {
    const grid = this.root?.querySelector('.zft-hotbar-grid');
    if (!grid) return [];
    const result = [];
    for (let col = 1; col < columns; col++) {
      const before = grid.querySelector(`[data-hotbar-slot="${col - 1}"]`);
      const after = grid.querySelector(`[data-hotbar-slot="${col}"]`);
      if (!before || !after) break;
      const a = before.getBoundingClientRect();
      const b = after.getBoundingClientRect();
      result.push({ col, screenX: (a.right + b.left) / 2 });
    }
    return result;
  }
  _rowDividerPositions(columns, rows) {
    const grid = this.root?.querySelector('.zft-hotbar-grid');
    if (!grid) return [];
    const result = [];
    for (let row = 1; row < rows; row++) {
      const before = grid.querySelector(`[data-hotbar-slot="${(row - 1) * columns}"]`);
      const after = grid.querySelector(`[data-hotbar-slot="${row * columns}"]`);
      if (!before || !after) break;
      const a = before.getBoundingClientRect();
      const b = after.getBoundingClientRect();
      result.push({ row, screenY: (a.bottom + b.top) / 2 });
    }
    return result;
  }
  _localDividerX(screenX, el) {
    if (!el) return 0;
    const bounds = el.getBoundingClientRect();
    const zoom = el.offsetWidth ? bounds.width / el.offsetWidth : 1;
    return (screenX - bounds.left) / (zoom || 1);
  }
  _localDividerY(screenY, el) {
    if (!el) return 0;
    const bounds = el.getBoundingClientRect();
    const zoom = el.offsetHeight ? bounds.height / el.offsetHeight : 1;
    return (screenY - bounds.top) / (zoom || 1);
  }

  /** Measure real boundaries after assigning row and column tracks. */
  _applyDividerLayout(columns, dividers = storedHotbarDividers(this.actor)) {
    const root = this.root;
    if (!root) return;
    const grid = root.querySelector('.zft-hotbar-grid');
    if (!grid) return;
    const rows = Math.ceil(grid.children.length / columns);
    const rowDividers = storedHotbarRowDividers(this.actor);
    const names = hotbarDividerLabels(this.actor);
    grid.style.gridTemplateColumns = hotbarColumnTracks(columns, dividers);
    grid.style.gridTemplateRows = hotbarRowTracks(rows, rowDividers, names.rows);
    const selected = new Set(dividers.filter(col => col < columns));
    const selectedRows = new Set(rowDividers.filter(row => row < rows));
    for (const slot of grid.querySelectorAll('[data-hotbar-slot]')) {
      const index = Number(slot.dataset.hotbarSlot);
      const col = index % columns;
      const row = Math.floor(index / columns);
      slot.classList.toggle('is-after-divider', selected.has(col));
      slot.classList.toggle('is-after-row-divider', selectedRows.has(row));
      slot.classList.toggle('is-labeled-row-divider', selectedRows.has(row) && Boolean(names.rows[String(row)]));
    }
    const positions = this._dividerPositions(columns);
    const rowPositions = this._rowDividerPositions(columns, rows);
    const overlay = root.querySelector('.zft-hotbar-divider-overlay');
    if (overlay) {
      overlay.replaceChildren();
      const gridBounds = grid.getBoundingClientRect();
      for (const { col, screenX } of positions) {
        if (!selected.has(col)) continue;
        const line = element('span', 'zft-hotbar-divider-line');
        line.dataset.dividerLine = String(col);
        line.style.left = `${this._localDividerX(screenX, overlay)}px`;
        line.style.top = `${this._localDividerY(gridBounds.top, overlay)}px`;
        line.style.height = `${grid.offsetHeight}px`;
        overlay.append(line);
      }
      const rail = root.querySelector('.zft-hotbar-divider-label-rail');
      if (rail) {
        rail.replaceChildren();
        for (const {col,screenX} of positions) {
          const name = selected.has(col) ? names.columns[String(col)] : null;
          if (!name) continue;
          const label = element('span','zft-hotbar-divider-name');
          label.textContent = name;
          label.title = name;
          label.style.left = `${this._localDividerX(screenX,rail)}px`;
          rail.append(label);
        }
      }
      for (const { row, screenY } of rowPositions) {
        if (!selectedRows.has(row)) continue;
        const line = element('span', 'zft-hotbar-row-divider-line');
        line.dataset.rowDividerLine = String(row);
        line.style.top = `${this._localDividerY(screenY, overlay)}px`;
        line.style.left = `${this._localDividerX(gridBounds.left, overlay)}px`;
        line.style.width = `${grid.offsetWidth}px`;
        overlay.append(line);
        const name = names.rows[String(row)];
        if (name) {
          const label = element('span','zft-hotbar-row-divider-name');
          label.textContent = name;
          label.title = name;
          label.style.top = `${this._localDividerY(screenY,overlay)}px`;
          label.style.left = `${this._localDividerX(gridBounds.left,overlay) + 5}px`;
          overlay.append(label);
        }
      }
    }
    const editor = root.querySelector('.zft-hotbar-divider-editor');
    if (editor) {
      editor.replaceChildren();
      for (const { col, screenX } of positions) {
        const active = selected.has(col);
        const marker = element('button', 'zft-hotbar-divider-marker',
          active ? `Drag divider after column ${col}; click to remove` : `Add divider after column ${col}`);
        marker.type = 'button'; marker.dataset.dividerAfter = String(col);
        marker.textContent = active ? '×' : '+';
        marker.setAttribute('aria-pressed', String(active));
        marker.setAttribute('aria-label', active
          ? `Drag divider after column ${col}, or click to remove` : `Add divider after column ${col}`);
        marker.style.left = `${this._localDividerX(screenX, editor)}px`;
        if (active) {
          marker.addEventListener('pointerdown', event => this._startDividerDrag(event, col));
          marker.addEventListener('contextmenu', event => this._openDividerLabelEditor(event,'columns',col));
          const name=names.columns[String(col)];
          if(name)marker.title=`${name} · Right-click to rename · Drag to move · Click to remove`;
        }
        editor.append(marker);
      }
    }
    const rowEditor = root.querySelector('.zft-hotbar-row-divider-editor');
    if (rowEditor) {
      rowEditor.replaceChildren();
      for (const { row, screenY } of rowPositions) {
        const active = selectedRows.has(row);
        const marker = element('button', 'zft-hotbar-row-divider-marker',
          active ? `Drag divider after row ${row}; click to remove` : `Add divider after row ${row}`);
        marker.type = 'button'; marker.dataset.dividerAfterRow = String(row);
        marker.textContent = active ? '×' : '+';
        marker.setAttribute('aria-pressed', String(active));
        marker.setAttribute('aria-label', active
          ? `Drag divider after row ${row}, or click to remove` : `Add divider after row ${row}`);
        marker.style.top = `${this._localDividerY(screenY, rowEditor)}px`;
        if (active) {
          marker.addEventListener('pointerdown', event => this._startDividerDrag(event, row, 'row'));
          marker.addEventListener('contextmenu', event => this._openDividerLabelEditor(event,'rows',row));
          const name=names.rows[String(row)];
          if(name)marker.title=`${name} · Right-click to rename · Drag to move · Click to remove`;
        }
        rowEditor.append(marker);
      }
    }
  }

  /** Native DOM editor anchored to the active boundary; no extra grid cell. */
  _closeDividerLabelEditor() {
    this._dividerLabelPanel?.remove();
    this._dividerLabelPanel = null;
    document.removeEventListener('pointerdown',this._dividerLabelDismiss,true);
  }
  _openDividerLabelEditor(event, axis, boundary) {
    event.preventDefault(); event.stopPropagation();
    if (!this.actor?.isOwner || this._settings('hotbarLocked')) return;
    this._closeDividerLabelEditor();
    const actor = this.actor;
    const original = hotbarDividerLabels(actor)[axis]?.[String(boundary)] || '';
    const panel=element('div','zft-hotbar-divider-label-editor');
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-label',`Name ${axis==='rows'?'horizontal':'vertical'} divider`);
    panel.dataset.theme = this.root?.dataset.theme || 'zft-default';
    const rootStyles=getComputedStyle(this.root);
    for (const token of STYLE_TOKENS) {
      const value=rootStyles.getPropertyValue(token);
      if (value)panel.style.setProperty(token,value.trim());
    }
    const label=element('label');
    label.textContent=`${axis==='rows'?'Row':'Column'} divider ${boundary} label`;
    const input=element('input'); input.type='text';input.maxLength=32;
    input.placeholder='Optional label';input.value=original;
    label.append(input);panel.append(label);
    const commands=element('div','zft-hotbar-divider-label-commands');
    const save=element('button');save.type='button';save.textContent='Save';
    const clear=element('button');clear.type='button';clear.textContent='Clear';
    const cancel=element('button');cancel.type='button';cancel.textContent='Cancel';
    const commit=async name=>{
      this._closeDividerLabelEditor();
      try{await setHotbarDividerLabel(actor,axis,boundary,name);if(this.actor===actor)this.render(actor);}
      catch(error){this._profileError(error);}
    };
    save.addEventListener('click',()=>void commit(input.value));
    clear.addEventListener('click',()=>void commit(''));
    cancel.addEventListener('click',()=>this._closeDividerLabelEditor());
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();void commit(input.value);}
      if(e.key==='Escape'){e.preventDefault();this._closeDividerLabelEditor();}
    });
    commands.append(clear,cancel,save);panel.append(commands);
    document.body.append(panel);this._dividerLabelPanel=panel;
    const bounds=panel.getBoundingClientRect();
    panel.style.left=`${Math.max(8,Math.min(innerWidth-bounds.width-8,event.clientX))}px`;
    panel.style.top=`${Math.max(8,Math.min(innerHeight-bounds.height-8,event.clientY))}px`;
    // Avoid dismissing from the context-menu event that opened the popup.
    document.addEventListener('pointerdown',this._dividerLabelDismiss,true);
    input.focus();input.select();
  }

  /** Drag selected dividers in either direction, saving on release. */
  _startDividerDrag(event, boundary, axis = 'column') {
    if (event.button !== 0 || this._settings('hotbarLocked') || !this.actor?.isOwner || this._dividerDrag) return;
    event.preventDefault(); event.stopPropagation();
    const marker = event.currentTarget;
    const line = this.root?.querySelector(axis === 'row'
      ? `[data-row-divider-line="${boundary}"]` : `[data-divider-line="${boundary}"]`);
    this._dividerDrag = {
      axis, from: boundary, target: boundary, moved: false,
      startX: event.clientX, startY: event.clientY, marker, line
    };
    document.addEventListener('pointermove', this._onMove);
    document.addEventListener('pointerup', this._onEnd, { once: true });
    document.addEventListener('pointercancel', this._onEnd, { once: true });
  }
  _moveDivider(event) {
    const state = this._dividerDrag;
    if (!state) return;
    if (!state.moved && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 5) return;
    state.moved = true;
    this.root.dataset.dividerDragging = 'true';
    const { rows, columns } = this._dimensions();
    const isRow = state.axis === 'row';
    const positions = isRow ? this._rowDividerPositions(columns, rows) : this._dividerPositions(columns);
    const stored = isRow ? storedHotbarRowDividers(this.actor) : storedHotbarDividers(this.actor);
    const taken = new Set(stored.filter(value => value !== state.from));
    const available = positions.filter(position => !taken.has(isRow ? position.row : position.col));
    if (!available.length) return;
    const coordinate = isRow ? 'screenY' : 'screenX';
    const value = isRow ? event.clientY : event.clientX;
    const next = available.reduce((best, position) =>
      Math.abs(position[coordinate] - value) < Math.abs(best[coordinate] - value) ? position : best);
    state.target = isRow ? next.row : next.col;
    const editor = this.root.querySelector(isRow ? '.zft-hotbar-row-divider-editor' : '.zft-hotbar-divider-editor');
    if (isRow) state.marker.style.top = `${this._localDividerY(next.screenY, editor)}px`;
    else state.marker.style.left = `${this._localDividerX(next.screenX, editor)}px`;
    state.marker.classList.add('is-dragging');
    if (state.line) {
      const overlay = this.root.querySelector('.zft-hotbar-divider-overlay');
      if (isRow) state.line.style.top = `${this._localDividerY(next.screenY, overlay)}px`;
      else state.line.style.left = `${this._localDividerX(next.screenX, overlay)}px`;
    }
  }
  async _endDividerDrag(event) {
    const state = this._dividerDrag;
    if (!state) return;
    this._dividerDrag = null;
    if (this.root) delete this.root.dataset.dividerDragging;
    const isRow = state.axis === 'row';
    const stored = isRow ? storedHotbarRowDividers(this.actor) : storedHotbarDividers(this.actor);
    const save = isRow ? saveHotbarRowDividers : saveHotbarDividers;
    if (!state.moved) {
      this._dividerSuppressUntil = performance.now() + 400;
      try { await save(this.actor, stored.filter(value => value !== state.from)); }
      catch (error) { this._profileError(error); }
      this._pendingRender = false; this.render(this.actor);
      return;
    }
    this._dividerSuppressUntil = performance.now() + 400;
    if (event?.type === 'pointercancel' || state.target === state.from) {
      this._applyDividerLayout(this._dimensions().columns);
      if (this._pendingRender) this.render(this.actor);
      return;
    }
    const next = stored.filter(value => value !== state.from).concat(state.target);
    try { await save(this.actor, next, {moveFrom:state.from,moveTo:state.target}); }
    catch (error) { this._profileError(error); }
    this._pendingRender = false; this.render(this.actor);
  }

  /** Render one fixed-index slot. Used at startup and on live resize. */
  _createSlot(index, refs, adapter, locked, actorWritable) {
    const actor = this.actor;
    const slot = element('div', 'zft-hotbar-slot');
    slot.dataset.hotbarSlot = String(index);
    const ref = refs[index];
    const macroRef = isMacroReference(ref) ? ref : null;
    const macro = macroRef ? macroDocumentSync(macroRef.uuid) : null;
    const id = macroRef ? null : resolveActionReference(actor, ref, adapter);
    const preview = id ? adapter?.getItemPreview?.(actor, id) : null;
    if (macroRef) {
      const name = macro?.name || macroRef.name || 'Macro';
      const action = element('button', 'zft-hotbar-action', `Execute ${name}; drag to rearrange`);
      action.type = 'button'; action.dataset.macroUuid = macroRef.uuid;
      action.draggable = !locked && actorWritable;
      action.setAttribute('aria-label', `Execute Macro ${name}`);
      const image = element('img'); image.src = macro?.img || macroRef.img || 'icons/svg/dice-target.svg'; image.alt = '';
      action.append(image);
      if (this._settings('showHotbarLabels')) {
        const label = element('span', 'zft-hotbar-name'); label.textContent = name;
        action.append(label);
      }
      slot.append(action);
      if (!locked && actorWritable) {
        const remove = element('button', 'zft-hotbar-remove', `Clear ${name} from slot ${index + 1}`);
        remove.type = 'button'; remove.dataset.hotbarRemove = String(index);
        remove.append(fa('xmark')); slot.append(remove);
      }
    } else if (id && preview) {
      const action = element('button', 'zft-hotbar-action', `Use ${preview.name}; right-click for Item sheet; drag to rearrange`);
      action.type = 'button'; action.dataset.useItem = id;
      action.draggable = !locked && actorWritable;
      action.setAttribute('aria-label', `Use ${preview.name}`);
      const image = element('img'); image.src = preview.img || 'icons/svg/item-bag.svg'; image.alt = '';
      action.append(image);
      if (this._settings('showHotbarLabels')) {
        const label = element('span', 'zft-hotbar-name'); label.textContent = preview.name;
        action.append(label);
      }
      slot.append(action);
      if (!locked && actorWritable) {
        const remove = element('button', 'zft-hotbar-remove', `Clear ${preview.name} from slot ${index + 1}`);
        remove.type = 'button'; remove.dataset.hotbarRemove = String(index);
        remove.append(fa('xmark'));
        slot.append(remove);
      }
    } else {
      slot.classList.add('is-empty');
      if (ref) {
        slot.classList.add('is-missing');
        slot.title = `Missing action: ${ref.name || ref.id}. Reassign this slot.`;
        slot.append(fa('triangle-exclamation'));
      } else {
        slot.title = locked ? `Empty slot ${index + 1}` : `Drop an action into slot ${index + 1}`;
      }
    }
    applyButtonColor(slot,hotbarSlotColor(actor,index));
    return slot;
  }

  _openSlotColorMenu(slot, event, id = null) {
    const index=Number(slot?.dataset.hotbarSlot);
    if (!this.actor?.isOwner || !Number.isInteger(index)) {
      if(id) void this.hud._inspectItem(id);
      return;
    }
    const actor=this.actor;
    const current=hotbarSlotColor(actor,index);
    this._colorUI.openMenu({target:slot,title:`Hotbar Slot ${index+1}`,current,event,resetLabel:'Reset to Theme',
      onSheet:id ? ()=>void this.hud._inspectItem(id) : null,
      onApply:async color=>{
        try {await setHotbarSlotColor(actor,index,color);if(this.actor===actor)this.render(actor);}
        catch(error){this._profileError(error);if(this.actor===actor)this.render(actor);}
      },
      onReset:async()=>{
        try {await setHotbarSlotColor(actor,index,null);if(this.actor===actor)this.render(actor);}
        catch(error){this._profileError(error);if(this.actor===actor)this.render(actor);}
      }
    });
  }

  _wireSlots(root) {
    for (const button of root.querySelectorAll('[data-use-item]')) {
      button.addEventListener('click', event => {
        event.stopPropagation();
        if (performance.now() < this._suppressUntil) return;
        void this.hud._executeItem(button.dataset.useItem);
      });
      button.addEventListener('contextmenu', event => {
        event.preventDefault(); event.stopPropagation();
        this._openSlotColorMenu(button.closest('[data-hotbar-slot]'), event, button.dataset.useItem);
      });
      button.addEventListener('dragstart', event => {
        if (this._settings('hotbarLocked') || !this.actor?.isOwner) { event.preventDefault(); return; }
        const slot = Number(button.closest('[data-hotbar-slot]')?.dataset.hotbarSlot);
        this._draggedSlot = slot;
        const id = button.dataset.useItem;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-zft-hud-action', JSON.stringify({ id, actor: this.actor.uuid, source: 'hotbar', slot }));
        event.dataTransfer.setData('text/plain', `zft-action-hud:${id}`);
      });
      button.addEventListener('dragend', () => { this._draggedSlot = null; this._suppressUntil = performance.now() + 250; });
    }
    for (const button of root.querySelectorAll('[data-macro-uuid]')) {
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        if (performance.now() < this._suppressUntil) return;
        const uuid = button.dataset.macroUuid;
        const ref = storedHotbarSlots(this.actor).find(entry => isMacroReference(entry) && entry.uuid === uuid);
        void executeHotbarMacro(ref, { actor: this.actor }).then(result => {
          if (result.ok) return;
          const messages = { invalid:'Invalid Macro reference.', missing:'Macro no longer exists or is unavailable.',
            permission:'You do not have permission to execute that Macro.', error:'Macro failed; see console.' };
          ui.notifications?.warn(messages[result.reason] || 'Macro could not run.');
        });
      });
      button.addEventListener('contextmenu', event => {
        event.preventDefault(); event.stopPropagation();
        this._openSlotColorMenu(button.closest('[data-hotbar-slot]'), event);
      });
      button.addEventListener('dragstart', event => {
        if (this._settings('hotbarLocked') || !this.actor?.isOwner) { event.preventDefault(); return; }
        const slot = Number(button.closest('[data-hotbar-slot]')?.dataset.hotbarSlot);
        this._draggedSlot = slot;
        const uuid = button.dataset.macroUuid;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-zft-hud-action', JSON.stringify({
          kind:'macro', id:`macro:${uuid}`, uuid, actor:this.actor.uuid, source:'hotbar', slot
        }));
      });
      button.addEventListener('dragend', () => { this._draggedSlot = null; this._suppressUntil = performance.now() + 250; });
    }
    for (const slot of [ ...(root.matches?.('[data-hotbar-slot]') ? [root] : []), ...root.querySelectorAll('[data-hotbar-slot]') ]) {
      slot.addEventListener('dragover', event => {
        if (this._settings('hotbarLocked') || !this.actor?.isOwner) return;
        event.preventDefault();
        // Library and Foundry Directory macros are copied into an Actor's slots.
        // Their drag sources use effectAllowed='copy'. Asking for 'move' cancels
        // the native HTML5 drop entirely in Chromium (and other browsers).
        // Only a drag originating in this hotbar is a rearrangement/move.
        event.dataTransfer.dropEffect = Number.isInteger(this._draggedSlot) ? 'move' : 'copy';
        slot.classList.add('is-drop-target');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('is-drop-target'));
      slot.addEventListener('drop', event => { event.preventDefault(); event.stopPropagation(); slot.classList.remove('is-drop-target'); void this._drop(event, Number(slot.dataset.hotbarSlot)); });
    }
    for (const button of root.querySelectorAll('[data-hotbar-remove]')) {
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); void this._assign(Number(button.dataset.hotbarRemove), null); });
    }
  }

  _wire() {
    const root = this.root;
    this._wireSlots(root);
    for(const slot of root.querySelectorAll('[data-hotbar-slot].is-empty'))
      slot.addEventListener('contextmenu',event=>{
        event.preventDefault();event.stopPropagation();this._openSlotColorMenu(slot,event);
      });
    root.onclick = event => {
      if (performance.now() < this._dividerSuppressUntil) return;
      if (event.target.closest('[data-divider-after], [data-divider-after-row]')) void this._toggleDivider(event);
    };
    root.querySelector('[data-hotbar-drag]')?.addEventListener('pointerdown', event => this._start(event));
    root.querySelector('[data-hotbar-resize]')?.addEventListener('pointerdown', event => this._startResize(event));
    const tabsViewport = root.querySelector('.zft-hotbar-profile-tabs');
    tabsViewport?.addEventListener('scroll', () => {
      this._profileScroll = tabsViewport.scrollLeft;
      this._syncProfileNav();
    });
    for (const nav of root.querySelectorAll('[data-hotbar-profile-nav]')) {
      nav.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        const direction = nav.dataset.hotbarProfileNav === 'left' ? -1 : 1;
        tabsViewport?.scrollBy({ left: direction * Math.max(90, tabsViewport.clientWidth * .75), behavior: 'smooth' });
      });
    }
    for (const tab of root.querySelectorAll('[data-hotbar-profile]')) {
      const tabId = tab.dataset.hotbarProfile;
      if (!isBuiltinHotbarProfile(tabId)) {
        tab.addEventListener('dragstart',event=>{
          if (!this.actor?.isOwner) {event.preventDefault();return;}
          event.dataTransfer.effectAllowed='move';
          event.dataTransfer.setData('application/x-zft-hud-profile',tabId);
          tab.classList.add('is-dragging');
        });
        tab.addEventListener('dragend',()=>tab.classList.remove('is-dragging'));
        tab.addEventListener('dragover',event=>{
          if (!event.dataTransfer?.types?.includes('application/x-zft-hud-profile'))return;
          event.preventDefault();event.dataTransfer.dropEffect='move';
        });
        tab.addEventListener('drop',event=>{
          const id=event.dataTransfer?.getData('application/x-zft-hud-profile');
          if (!id || id===tabId || isBuiltinHotbarProfile(id))return;
          event.preventDefault();event.stopPropagation();
          void reorderHotbarProfile(this.actor,id,tabId).then(()=>this.render(this.actor)).catch(e=>this._profileError(e));
        });
      }
      tab.addEventListener('click', event => {
        event.stopPropagation();
        this._closeProfileContext();
        // Switching is immediate; Rename is explicitly available on right-click.
        void this._switchProfile(tab.dataset.hotbarProfile);
      });
      tab.addEventListener('contextmenu', event => {
        event.preventDefault(); event.stopPropagation();
        if (this.actor?.isOwner) this._showProfileContext(tab, event.clientX, event.clientY);
      });
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        const all = [...root.querySelectorAll('[data-hotbar-profile]')];
        const index = all.indexOf(tab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? all.length-1 :
          (index + (event.key==='ArrowRight'?1:-1) + all.length) % all.length;
        event.preventDefault(); all[next]?.focus();
      });
    }
    tabsViewport?.addEventListener('dragover',event=>{
      if (event.dataTransfer?.types?.includes('application/x-zft-hud-profile'))event.preventDefault();
    });
    tabsViewport?.addEventListener('drop',event=>{
      if(event.target.closest('[data-hotbar-profile]'))return;
      const id=event.dataTransfer?.getData('application/x-zft-hud-profile');
      if(!id || isBuiltinHotbarProfile(id))return;
      event.preventDefault();event.stopPropagation();
      void reorderHotbarProfile(this.actor,id,null).then(()=>this.render(this.actor)).catch(e=>this._profileError(e));
    });
    // Keep custom tabs left aligned, with the active custom tab visible on initial render.
    if (tabsViewport) {
      tabsViewport.scrollLeft = this._profileScroll || 0;
      this._profileNavFrame = requestAnimationFrame(() => {
        this._profileNavFrame = null;
        if (this.root !== root) return;
        const active = tabsViewport.querySelector('[aria-selected="true"]');
        if (this._profileVisibleId !== active?.dataset.hotbarProfile) {
          this._profileVisibleId = active?.dataset.hotbarProfile;
          this._showProfileTab(active, tabsViewport);
        }
        this._syncProfileNav();
      });
    }
    for (const button of root.querySelectorAll('[data-hotbar-command]')) {
      button.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        if (button.dataset.hotbarCommand === 'lock') {
          await game.settings.set(MODULE_ID, 'hotbarLocked', !this._settings('hotbarLocked'));
        } else if (button.dataset.hotbarCommand === 'collapse') {
          await game.settings.set(MODULE_ID, 'hotbarCollapsed', !this._settings('hotbarCollapsed'));
        } else if (button.dataset.hotbarCommand === 'dividers') {
          this._editingDividers = !this._editingDividers;
          this.render(this.actor);
        } else if (button.dataset.hotbarCommand === 'scale') {
          if (this._scaleControl.open) this._closeScalePopover();
          else { this._closeProfileEditor(); this._openScalePopover(); }
        } else if (button.dataset.hotbarCommand === 'profiles') {
          if (this._profilePanel) this._closeProfileEditor();
          else { this._closeScalePopover(); this._openProfileEditor(); }
        } else if (button.dataset.hotbarCommand === 'position-mode') {
          await this._cyclePositionMode();
        }
      });
      if (button.dataset.hotbarCommand === 'position-mode') {
        button.addEventListener('contextmenu', async event => {
          event.preventDefault();
          event.stopPropagation();
          try { await this._cyclePositionMode(-1); }
          catch (error) {
            console.error('[ZFT] | ❌ Reverse hotbar position control failed', error);
            ui.notifications?.warn('Could not change hotbar position; see console.');
          }
        });
      }
    }
    for (const input of root.querySelectorAll('[data-hotbar-setting]')) {
      input.addEventListener('change', async () => {
        const max = 20;
        if (!this.actor?.isOwner) { this.render(this.actor); return; }
        const data = input.dataset.hotbarSetting === 'hotbarRows'
          ? { rows: clamp(input.value, 1, max) } : { columns: clamp(input.value, 1, max) };
        try { await saveHotbarDimensions(this.actor, data); this.render(this.actor); }
        catch (error) { this._profileError(error); this.render(this.actor); }
      });
    }
  }

  async _switchProfile(id, { automatic = false } = {}) {
    const actor = this.actor;
    if (!actor?.isOwner || id === hotbarProfiles(actor).active) return;
    if (!automatic) this._combatProfiles?.onManualSwitch?.(actor);
    this._editingDividers = false;
    this._closeProfileEditor();
    this._closeSingleProfileEditor();
    this._closeProfileContext();
    // Update the grid and selected tab now, not after the Actor network save.
    const saving = switchHotbarProfileFast(actor, id);
    if (this.actor === actor) this.render(actor);
    try { await saving; }
    catch (error) {
      this._profileError(error);
      if (this.actor === actor) this.render(actor);
    }
  }
  _closeProfileContext() {
    this._profileContext?.remove(); this._profileContext = null;
    document.removeEventListener('pointerdown', this._profileContextDismiss, true);
  }
  _showProfileContext(tab, x, y) {
    this._closeProfileContext();
    const id=tab.dataset.hotbarProfile;
    const state=hotbarProfiles(this.actor);
    const profile=state.profiles.find(p=>p.id===id);
    if(!profile || !this.actor?.isOwner)return;
    const panel=element('div','zft-hotbar-profile-context');
    panel.dataset.theme=this.root?.dataset.theme||'zft-default';
    const styles=getComputedStyle(this.root);
    for(const token of STYLE_TOKENS) {
      const value=styles.getPropertyValue(token);
      if(value)panel.style.setProperty(token,value.trim());
    }
    const add=(label,icon,callback,disabled=false)=>{
      const button=element('button','',label);button.type='button';button.disabled=disabled;
      button.append(fa(icon),document.createTextNode(` ${label}`));
      button.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();this._closeProfileContext();callback();
      });
      panel.append(button);
    };
    const builtin=isBuiltinHotbarProfile(id);
    add('Customize Color','palette',()=>this._openProfileAccentPicker(tab,id));
    if(profile.accent)add('Reset Color','rotate-left',()=>void this._saveProfileAccent(id,null));
    add('Edit Profile','pen-to-square',()=>this._openSingleProfileEditor(id));
    if(!builtin)add('Rename','pen',()=>this._renameProfileTab(tab));
    add('Duplicate','copy',()=>void this._duplicateProfile(id),state.profiles.length>=MAX_HOTBAR_PROFILES);
    if(!builtin){
      const custom=state.profiles.filter(p=>!isBuiltinHotbarProfile(p.id));
      const index=custom.findIndex(p=>p.id===id);
      if(index>0)add('Move Left','arrow-left',()=>void this._moveProfile(id,custom[index-1].id));
      if(index<custom.length-1)add('Move Right','arrow-right',()=>void this._moveProfile(id,index+2<custom.length?custom[index+2].id:null));
      add('Delete','trash',()=>void this._deleteProfile(id));
    }
    document.body.append(panel);this._profileContext=panel;
    const rect=panel.getBoundingClientRect();
    panel.style.left=`${Math.max(6,Math.min(x,window.innerWidth-rect.width-6))}px`;
    panel.style.top=`${Math.max(6,Math.min(y,window.innerHeight-rect.height-6))}px`;
    document.addEventListener('pointerdown',this._profileContextDismiss,true);
  }
  _openProfileAccentPicker(tab,id) {
    if(!tab?.isConnected || !this.actor?.isOwner)return;
    const profile=hotbarProfiles(this.actor).profiles.find(p=>p.id===id);
    if(!profile)return;
    const baseline=hotbarProfileAccent(this.actor,id);
    const themeColor=getComputedStyle(this.root).getPropertyValue('--zft-accent-bright').trim();
    const defaultColor=baseline || (/^#[\da-f]{6}$/i.test(themeColor)?themeColor:'#A56BDC');
    this._colorUI.openPicker({target:tab,title:profile.name,current:profile.accent,defaultColor,
      resetLabel:'Reset Color',
      onPreview:color=>tab.style.setProperty('--zft-profile-accent',color),
      onRevert:()=>{
        if(baseline)tab.style.setProperty('--zft-profile-accent',baseline);
        else tab.style.removeProperty('--zft-profile-accent');
      },
      onApply:color=>this._saveProfileAccent(id,color),
      onReset:()=>this._saveProfileAccent(id,null)
    });
  }
  async _saveProfileAccent(id,color) {
    const actor=this.actor;
    try{await setHotbarProfileAccent(actor,id,color);if(this.actor===actor)this.render(actor);}
    catch(error){this._profileError(error);if(this.actor===actor)this.render(actor);}
  }
  async _duplicateProfile(id) {
    const actor=this.actor;
    const state=hotbarProfiles(actor);
    const source=state.profiles.find(p=>p.id===id);
    if(!source)return;
    let name=`${source.name} Copy`;
    for(let number=2;state.profiles.some(p=>p.name.toLowerCase()===name.toLowerCase());number++)name=`${source.name} Copy ${number}`;
    try{await createHotbarProfile(actor,name,{duplicate:true,sourceId:id});if(this.actor===actor)this.render(actor);}
    catch(error){this._profileError(error);}
  }
  async _deleteProfile(id) {
    const actor=this.actor;
    const profile=hotbarProfiles(actor).profiles.find(p=>p.id===id);
    if(!profile || isBuiltinHotbarProfile(id))return;
    const escaped=profile.name.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const confirmed=await foundry.applications.api.DialogV2.confirm({
      window:{title:'Delete Hotbar Profile'},content:`Delete profile <strong>${escaped}</strong>? Its assignments, dividers and colors will be lost.`,modal:true
    });
    if(!confirmed)return;
    try{await deleteHotbarProfile(actor,id);this._closeSingleProfileEditor();if(this.actor===actor)this.render(actor);}
    catch(error){this._profileError(error);}
  }
  async _moveProfile(id,beforeId) {
    const actor=this.actor;
    try{await reorderHotbarProfile(actor,id,beforeId);if(this.actor===actor)this.render(actor);}
    catch(error){this._profileError(error);}
  }
  /** Small per-profile editor, available from right-click even when layout is locked. */
  _openSingleProfileEditor(id) {
    if(!this.actor?.isOwner || !this.root)return;
    this._closeProfileEditor();
    const profile=hotbarProfiles(this.actor).profiles.find(p=>p.id===id);
    if(!profile)return;
    this._closeSingleProfileEditor();
    const tab=this.root.querySelector(`[data-hotbar-profile="${id}"]`);
    const panel=element('section','zft-hotbar-profiles-popover zft-single-profile-editor');
    panel.id='zft-action-hud-hotbar-profile-edit';
    panel.dataset.theme=this.root.dataset.theme;
    panel.setAttribute('aria-label',`Edit ${profile.name} profile`);
    const header=element('div','zft-hotbar-profile-heading');
    const title=element('strong');title.textContent='Edit Profile';
    const close=element('button');close.type='button';close.append(fa('xmark'));
    close.setAttribute('aria-label','Close');close.addEventListener('click',()=>this._closeSingleProfileEditor());
    header.append(title,close);
    const label=element('label','zft-hotbar-profile-name');label.textContent='Name';
    const input=element('input');input.type='text';input.maxLength=40;input.value=profile.name;
    input.readOnly=isBuiltinHotbarProfile(id);label.append(input);
    const colorLine=element('div','zft-profile-editor-color-row');
    const accent=element('button','zft-profile-editor-color', 'Customize Color');
    accent.type='button';accent.textContent='Customize Color';
    const sample=element('span','zft-profile-editor-sample');
    sample.style.backgroundColor=hotbarProfileAccent(this.actor,id)||'var(--zft-accent-bright)';
    accent.prepend(sample);
    accent.addEventListener('click',()=>{this._closeSingleProfileEditor();this._openProfileAccentPicker(tab,id);});
    const reset=element('button','zft-profile-editor-reset','Reset Color');reset.type='button';reset.textContent='Reset Color';
    reset.addEventListener('click',()=>{this._closeSingleProfileEditor();void this._saveProfileAccent(id,null);});
    colorLine.append(accent,reset);
    const actions=element('div','zft-hotbar-profile-actions');
    const make=(name,handler,disabled=false)=>{
      const button=element('button');button.type='button';button.textContent=name;button.disabled=disabled;
      button.addEventListener('click',handler);actions.append(button);
    };
    if(!isBuiltinHotbarProfile(id))make('Save Name',async()=>{
      try{await renameHotbarProfile(this.actor,input.value,id);this._closeSingleProfileEditor();this.render(this.actor);}
      catch(e){this._profileError(e);}
    });
    make('Duplicate',()=>{this._closeSingleProfileEditor();void this._duplicateProfile(id);},hotbarProfiles(this.actor).profiles.length>=MAX_HOTBAR_PROFILES);
    if(!isBuiltinHotbarProfile(id))make('Delete',()=>{this._closeSingleProfileEditor();void this._deleteProfile(id);});
    panel.append(header,label,colorLine,actions);
    document.body.append(panel);this._singleProfilePanel=panel;
    for(const token of STYLE_TOKENS){const value=getComputedStyle(this.root).getPropertyValue(token);if(value)panel.style.setProperty(token,value.trim());}
    const bounds=tab?.getBoundingClientRect()||this.root.getBoundingClientRect();
    const rect=panel.getBoundingClientRect();
    panel.style.left=`${Math.max(8,Math.min(innerWidth-rect.width-8,bounds.left))}px`;
    panel.style.top=`${Math.max(8,Math.min(innerHeight-rect.height-8,bounds.bottom+5))}px`;
    document.addEventListener('pointerdown',this._singleProfileDismiss,true);
    if(!input.readOnly)input.focus();
  }
  _closeSingleProfileEditor() {
    this._singleProfilePanel?.remove();this._singleProfilePanel=null;
    document.removeEventListener('pointerdown',this._singleProfileDismiss,true);
  }
  async switchForCombat(actor, id) {
    // A previous character may need restoration after token selection changes.
    // Preserve that Actor's profile without rendering the current hotbar.
    if (this.actor !== actor) {
      if (actor?.isOwner) await switchHotbarProfileFast(actor, id);
      return;
    }
    await this._switchProfile(id, { automatic: true });
  }
  syncCombatProfile() { return this._combatProfiles.sync(); }
  _showProfileTab(tab, viewport) {
    if (!tab || !viewport) return;
    const bounds = tab.getBoundingClientRect();
    const viewBounds = viewport.getBoundingClientRect();
    if (bounds.left < viewBounds.left)
      viewport.scrollLeft += bounds.left - viewBounds.left;
    else if (bounds.right > viewBounds.right)
      viewport.scrollLeft += bounds.right - viewBounds.right;
    this._profileScroll = viewport.scrollLeft;
  }
  _syncProfileNav() {
    const root = this.root;
    const viewport = root?.querySelector('.zft-hotbar-profile-tabs');
    const strip = root?.querySelector('.zft-hotbar-profile-strip');
    if (!viewport || !strip) return;
    const overflowing = viewport.scrollWidth > viewport.clientWidth + 2;
    strip.classList.toggle('is-overflowing', overflowing);
    const left = strip.querySelector('[data-hotbar-profile-nav="left"]');
    const right = strip.querySelector('[data-hotbar-profile-nav="right"]');
    if (left) left.disabled = !overflowing || viewport.scrollLeft < 1;
    if (right) right.disabled = !overflowing || viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 2;
  }
  _renameProfileTab(tab) {
    if (!tab?.isConnected || !this.actor?.isOwner) return;
    const profileId = tab.dataset.hotbarProfile;
    const name = hotbarProfiles(this.actor).profiles.find(p => p.id === profileId)?.name;
    if (!name || isBuiltinHotbarProfile(profileId)) return;
    const input = element('input', 'zft-hotbar-profile-tab zft-hotbar-profile-rename');
    input.type = 'text'; input.maxLength = 40;
    input.value = name;
    input.setAttribute('aria-label', `Rename ${name} profile`);
    tab.replaceWith(input); input.focus(); input.select();
    let finished = false;
    const finish = async save => {
      if (finished) return;
      finished = true;
      const next = input.value.trim();
      if (save && next && next !== name) {
        try { await renameHotbarProfile(this.actor, next, profileId); }
        catch (error) { this._profileError(error); }
      }
      if (input.isConnected) input.replaceWith(tab);
      this.render(this.actor);
    };
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); void finish(true); }
      if (event.key === 'Escape') { event.preventDefault(); void finish(false); }
    });
    input.addEventListener('blur', () => { void finish(true); }, { once:true });
  }
  async _toggleDivider(event) {
    if (this._settings('hotbarLocked') || !this.actor?.isOwner) return;
    const rowMarker = event.target.closest('[data-divider-after-row]');
    const marker = rowMarker || event.target.closest('[data-divider-after]');
    const isRow = Boolean(rowMarker);
    const boundary = Number(isRow ? rowMarker.dataset.dividerAfterRow : marker?.dataset.dividerAfter);
    const maximum = isRow ? this._dimensions().rows : this._dimensions().columns;
    if (!Number.isInteger(boundary) || boundary < 1 || boundary >= maximum) return;
    event.preventDefault(); event.stopPropagation();
    const old = isRow ? storedHotbarRowDividers(this.actor) : storedHotbarDividers(this.actor);
    const next = old.includes(boundary) ? old.filter(value => value !== boundary) : [...old, boundary];
    try {
      await (isRow ? saveHotbarRowDividers : saveHotbarDividers)(this.actor, next);
      this.render(this.actor);
    } catch (error) { this._profileError(error); }
  }

  _profileError(error) {
    console.error('[ZFT] Hotbar profile operation failed', error);
    ui.notifications?.warn(error?.message || 'Could not save hotbar profile.');
  }

  /** Independent screen-space editor: never changes hotbar scale or grid dimensions. */
  _openProfileEditor() {
    if (this._settings('hotbarLocked') || !this.actor?.isOwner || !this.root) return;
    this._closeSingleProfileEditor();
    this._closeProfileEditor();
    const panel = element('section', 'zft-hotbar-profiles-popover');
    panel.id = 'zft-action-hud-hotbar-profiles';
    panel.dataset.theme = this.root.dataset.theme;
    panel.setAttribute('aria-label', 'Manage custom hotbar profiles');
    const heading = element('div', 'zft-hotbar-profile-heading');
    const title = element('strong'); title.textContent = 'Manage Profiles';
    const close = element('button', '', 'Close profile editor'); close.type = 'button';
    close.append(fa('xmark')); close.setAttribute('aria-label', 'Close profile editor');
    close.addEventListener('click', () => this._closeProfileEditor());
    heading.append(title, close);
    const label = element('label', 'zft-hotbar-profile-name');
    label.textContent = 'Profile name';
    const input = element('input'); input.type = 'text'; input.maxLength = 40;
    input.value = activeHotbarProfile(this.actor).name;
    input.setAttribute('aria-label', 'Hotbar profile name');
    label.append(input);
    const buttons = element('div', 'zft-hotbar-profile-actions');
    const state = hotbarProfiles(this.actor);
    const choices = [['create','New'],['duplicate','Duplicate'],['rename','Rename'],['delete','Delete']];
    for (const [command,text] of choices) {
      const button = element('button'); button.type = 'button';
      button.textContent = text; button.dataset.profileAction = command;
      if ((command === 'delete' || command === 'rename') && isBuiltinHotbarProfile(state.active)) button.disabled = true;
      if (command === 'delete' && state.profiles.length === 1) button.disabled = true;
      if ((command === 'create' || command === 'duplicate') && state.profiles.length >= MAX_HOTBAR_PROFILES) button.disabled = true;
      buttons.append(button);
      button.addEventListener('click', async () => {
        const actor = this.actor;
        try {
          const previous = activeHotbarProfile(actor).name;
          let name = input.value.trim();
          if ((command === 'create' || command === 'duplicate') && (!name || name === previous)) {
            const allNames = new Set(hotbarProfiles(actor).profiles.map(profile => profile.name.toLowerCase()));
            const suggestion = command === 'create' ? 'New Profile' : `${previous} Copy`;
            name = suggestion;
            for (let index = 2; allNames.has(name.toLowerCase()); index++) name = `${suggestion} ${index}`;
          }
          if (command === 'create') await createHotbarProfile(actor, name);
          if (command === 'duplicate') await createHotbarProfile(actor, name, {duplicate:true});
          if (command === 'rename') await renameHotbarProfile(actor, name);
          if (command === 'delete') {
            const confirmed = await foundry.applications.api.DialogV2.confirm({
              window:{ title:'Delete Hotbar Profile' },
              content:`Delete profile <strong>${String(activeHotbarProfile(actor).name).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</strong>? Its slots and dividers will be lost.`,
              modal:true
            });
            if (!confirmed) return;
            await deleteHotbarProfile(actor);
          }
          this._editingDividers = false;
          this._closeProfileEditor();
          if (this.actor === actor) this.render(actor);
        } catch (error) { this._profileError(error); }
      });
    }
    panel.append(heading,label,buttons);
    document.body.append(panel); this._profilePanel = panel;
    for (const token of STYLE_TOKENS) {
      const value = getComputedStyle(this.root).getPropertyValue(token);
      if (value) panel.style.setProperty(token, value.trim());
    }
    document.addEventListener('pointerdown', this._profileDismiss, true);
    this._positionProfileEditor(); input.focus(); input.select();
  }
  _positionProfileEditor() {
    if (!this._profilePanel || !this.root) return;
    const anchor = this.root.querySelector('[data-hotbar-command="profiles"]')?.getBoundingClientRect();
    if (!anchor) { this._closeProfileEditor(); return; }
    const rect = this._profilePanel.getBoundingClientRect();
    const x = Math.max(8, Math.min(innerWidth-rect.width-8, anchor.right-rect.width));
    const targetY = anchor.top > rect.height + 12 ? anchor.top - rect.height - 6 : anchor.bottom + 6;
    const y = Math.max(8, Math.min(innerHeight-rect.height-8, targetY));
    this._profilePanel.style.left = `${Math.round(x)}px`;
    this._profilePanel.style.top = `${Math.round(y)}px`;
  }
  _closeProfileEditor() {
    this._profilePanel?.remove(); this._profilePanel = null;
    document.removeEventListener('pointerdown', this._profileDismiss, true);
  }

  _openScalePopover() { this._scaleControl.show(); }
  _positionScalePopover() { this._scaleControl.position(); }
  _closeScalePopover() { this._scaleControl.close(); }

  /** Preview the scale live; persist only on the slider change event. */
  previewScale(value) {
    if (!this.root) return;
    this.root.style.setProperty('--zft-scale', String(clamp(value, 0.5, 1.5)));
    this._applyDividerLayout(this._dimensions().columns);
    this.place();
  }

  async _drop(event, index) {
    if (this._settings('hotbarLocked') || this._settings('hotbarCollapsed')) return;
    const actor = this.actor;
    const info = readDrop(event, actor);
    if (!info || !actor?.isOwner) return;
    const from = info.from !== null && Number.isInteger(info.from) ? info.from : this._draggedSlot;
    if (info.macroUuid) {
      const macro = await macroDocument(info.macroUuid);
      if (!macro || (macro.documentName !== 'Macro' && macro.constructor?.documentName !== 'Macro')) {
        ui.notifications?.warn('This Foundry Macro could not be resolved.');
        return;
      }
      if (this.actor !== actor) return; // Token changed while resolving a Compendium Macro.
      await this._assign(index, makeMacroReference(info.macroUuid, macro), from);
      return;
    }
    const adapter = getSystemAdapter();
    const id = adapter?.resolveActionId?.(this.actor, info.id) ?? info.id;
    if (!adapter?.hasAction?.(this.actor, id)) return;
    await this._assign(index, actionReference(this.actor, id, adapter), from);
  }

  async _assign(index, ref, from = null) {
    if (this._busy || !this.actor?.isOwner) return;
    this._busy = true;
    try {
      const slots = assignHotbarSlot(storedHotbarSlots(this.actor), index, ref, from);
      await saveHotbarSlots(this.actor, slots, {from, to:index});
      this.render(this.actor);
    } catch (error) {
      console.error('[ZFT] Could not save custom hotbar', error);
      ui.notifications?.warn('Could not save hotbar layout. See console.');
    } finally { this._busy = false; this._draggedSlot = null; }
  }

  async _cyclePositionMode(direction = 1) {
    if (this._positionTransitionBusy) return;
    this._positionTransitionBusy = true;
    try {
      const mode = this._dockMode();
      const state = currentPositionState(mode, this._settings('hotbarPositionLocked'));
      const next = nextPositionState(state, direction);
      if (next !== 'docked' && mode !== 'floating') {
        const rect = this.root?.getBoundingClientRect();
        const previous = this._settings('hotbarFloatingPosition') || {};
        // Preserve previously saved floating coordinates, including on
        // backward Docked -> Floating Locked transitions.
        if (rect && !(Number.isFinite(previous.x) && Number.isFinite(previous.y)))
          await game.settings.set(MODULE_ID, 'hotbarFloatingPosition', { x:Math.round(rect.left), y:Math.round(rect.top) });
      }
      if (next === 'docked') {
        await game.settings.set(MODULE_ID, 'hotbarDockMode', 'docked');
      } else {
        // Keep movement lock distinct from the independent layout lock.
        const shouldLock = next === 'locked';
        if (Boolean(this._settings('hotbarPositionLocked')) !== shouldLock)
          await game.settings.set(MODULE_ID, 'hotbarPositionLocked', shouldLock);
        if (mode !== 'floating')
          await game.settings.set(MODULE_ID, 'hotbarDockMode', 'floating');
      }
      this.render(this.actor);
    } finally {
      this._positionTransitionBusy = false;
    }
  }

  _dockMode() {
    const setting = this._settings('hotbarDockMode');
    if (setting === 'docked' || setting === 'floating') return setting;
    const saved = this._settings('hotbarFloatingPosition') || {};
    return Number.isFinite(saved.x) && Number.isFinite(saved.y) ? 'floating' : 'docked';
  }

  /** The slider previews CSS zoom before the setting is saved. Read the active
   * zoom, not the previous setting, when converting screen pixels to CSS units.
   */
  _scale() {
    return clamp(Number(this.root?.style?.getPropertyValue?.('--zft-scale')) ||
      Number(this._settings('hotbarUiScale')) || 1, 0.5, 1.5);
  }

  place() {
    if (!this.root) return;
    const root = this.root;
    const scale = this._scale();
    const rect = root.getBoundingClientRect();
    if (this._dockMode() === 'docked') {
      // Keep the hotbar centered and its bottom clearance constant as it grows.
      root.style.left = `${(Math.max(8, (innerWidth - rect.width) / 2) / scale)}px`;
      root.style.top = `${(Math.max(8, innerHeight - rect.height - 12) / scale)}px`;
      return;
    }
    // Floating positions are upper-left screen-space anchors, regardless of zoom.
    const saved = this._settings('hotbarFloatingPosition') || {};
    if (!this._floatingFallback) this._floatingFallback = {
      x: Math.max(8, innerWidth - rect.width - 24), y: 160
    };
    let x = Number.isFinite(saved.x) ? saved.x : this._floatingFallback.x;
    let y = Number.isFinite(saved.y) ? saved.y : this._floatingFallback.y;
    // Clamp only when the resized bar would otherwise extend off-screen.
    x = Math.max(8, Math.min(Math.max(8, innerWidth - rect.width - 8), x));
    y = Math.max(8, Math.min(Math.max(8, innerHeight - rect.height - 8), y));
    root.style.left = `${x / scale}px`;
    root.style.top = `${y / scale}px`;
  }

  _startResize(event) {
    if (event.button !== 0 || this._settings('hotbarLocked') || this._resize) return;
    event.preventDefault(); event.stopPropagation();
    const slot = this.root?.querySelector('[data-hotbar-slot]');
    const rect = slot?.getBoundingClientRect();
    const grid = this.root?.querySelector('.zft-hotbar-grid');
    const scale = Number(this._settings('hotbarUiScale')) || 1;
    const { rows, columns } = this._dimensions();
    const style = grid ? getComputedStyle(grid) : null;
    const columnGap = Number.parseFloat(style?.columnGap) || 3 * scale;
    const rowGap = Number.parseFloat(style?.rowGap) || 3 * scale;
    this._resize = {
      x: event.clientX, y: event.clientY, rows, columns,
      previewRows: rows, previewColumns: columns,
      cellWidth: (rect?.width || 42 * scale) + columnGap,
      cellHeight: (rect?.height || 38 * scale) + rowGap
    };
    this.root.dataset.resizing = 'true';
    this._updateSizeIndicator(rows, columns);
    document.addEventListener('pointermove', this._onMove);
    document.addEventListener('pointerup', this._onEnd, { once: true });
    document.addEventListener('pointercancel', this._onEnd, { once: true });
  }

  _updateSizeIndicator(rows, columns) {
    const indicator = this.root?.querySelector('.zft-hotbar-size-indicator');
    if (indicator) indicator.textContent = `${columns} × ${rows}`;
  }

  /** Live preview: update only changed slot nodes and grid tracks, no settings writes. */
  _previewGrid(rows, columns) {
    const grid = this.root?.querySelector('.zft-hotbar-grid');
    if (!grid) return;
    grid.style.gridTemplateColumns = hotbarColumnTracks(columns, storedHotbarDividers(this.actor));
    grid.style.gridTemplateRows = hotbarRowTracks(rows, storedHotbarRowDividers(this.actor));
    const target = rows * columns;
    let count = grid.children.length;
    // Retain existing DOM nodes, listeners and tooltips while dragging.
    while (count > target) { grid.lastElementChild?.remove(); count--; }
    if (count < target) {
      const refs = storedHotbarSlots(this.actor);
      const adapter = getSystemAdapter();
      const locked = Boolean(this._settings('hotbarLocked'));
      const writable = Boolean(this.actor?.isOwner);
      const fragment = document.createDocumentFragment();
      while (count < target) {
        const slot = this._createSlot(count++, refs, adapter, locked, writable);
        this._wireSlots(slot);
        this.hud._itemPreview?.wire(slot);
        fragment.append(slot);
      }
      grid.append(fragment);
    }
    this._applyDividerLayout(columns);
    for (const [key, value] of [['hotbarRows', rows], ['hotbarColumns', columns]]) {
      const input = this.root?.querySelector(`[data-hotbar-setting="${key}"]`);
      if (input) input.value = String(value);
    }
    this._updateSizeIndicator(rows, columns);
  }

  _start(event) {
    if (this._settings('hotbarPositionLocked') || this._dockMode() === 'docked' || event.button !== 0 || event.target.closest('button,input,select')) return;
    event.preventDefault();
    const rect = this.root.getBoundingClientRect();
    this._drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    document.addEventListener('pointermove', this._onMove);
    document.addEventListener('pointerup', this._onEnd, { once: true });
    document.addEventListener('pointercancel', this._onEnd, { once: true });
  }
  _move(event) {
    if (this._dividerDrag) { this._moveDivider(event); return; }
    if (this._resize) {
      const state = this._resize;
      const columns = clamp(state.columns + Math.round((event.clientX - state.x) / state.cellWidth), 1, 20);
      const rows = clamp(state.rows + Math.round((event.clientY - state.y) / state.cellHeight), 1, 20);
      if (columns !== state.previewColumns || rows !== state.previewRows) {
        state.previewColumns = columns; state.previewRows = rows;
        this._previewGrid(rows, columns);
      }
      return;
    }
    if (!this._drag || !this.root) return;
    const rect = this.root.getBoundingClientRect();
    const x = Math.max(8, Math.min(Math.max(8, innerWidth - rect.width - 8), event.clientX - this._drag.dx));
    const y = Math.max(8, Math.min(Math.max(8, innerHeight - rect.height - 8), event.clientY - this._drag.dy));
    const scale = this._scale();
    this.root.style.left = `${x / scale}px`;
    this.root.style.top = `${y / scale}px`;
  }
  async _end(event) {
    document.removeEventListener('pointermove', this._onMove);
    document.removeEventListener('pointerup', this._onEnd);
    document.removeEventListener('pointercancel', this._onEnd);
    if (this._dividerDrag) { await this._endDividerDrag(event); return; }
    if (this._resize) {
      const state = this._resize;
      this._resize = null;
      if (this.root) delete this.root.dataset.resizing;
      // A cancelled pointer gesture should roll the preview back.
      const cancelled = event?.type === 'pointercancel';
      if (cancelled) this._previewGrid(state.rows, state.columns);
      else {
        try {
          if (state.previewRows !== state.rows || state.previewColumns !== state.columns)
            await saveHotbarDimensions(this.actor, { rows: state.previewRows, columns: state.previewColumns });
        } catch (error) {
          console.warn('[ZFT] Could not save resized hotbar grid', error);
          ui.notifications?.warn('Could not save hotbar grid size.');
        }
      }
      this.render(this.actor);
      return;
    }
    if (!this._drag || !this.root) return;
    this._drag = null;
    if (event?.type === 'pointercancel') { this.place(); if (this._pendingRender) this.render(this.actor); return; }
    const rect = this.root.getBoundingClientRect();
    try { await game.settings.set(MODULE_ID, 'hotbarFloatingPosition', { x: Math.round(rect.left), y: Math.round(rect.top) }); }
    catch (error) { console.warn('[ZFT] Could not remember hotbar position', error); }
    if (this._pendingRender) { this._pendingRender = false; this.render(this.actor); }
  }
  hide() {
    this._closeDividerLabelEditor();
    this._closeSingleProfileEditor();
    if (this._profileClickTimer) { clearTimeout(this._profileClickTimer); this._profileClickTimer = null; }
    if (this._profileNavFrame !== null) { cancelAnimationFrame(this._profileNavFrame); this._profileNavFrame = null; }
    this._closeProfileEditor(); this._closeScalePopover(); this._closeProfileContext(); this.hud._itemPreview?.hide(true); this.root?.remove(); this.root = null; }
  destroy() {
    this.hide();
    this._resize = null; this._drag = null; this._dividerDrag = null; this._pendingRender = false;
    document.removeEventListener('pointermove', this._onMove);
    document.removeEventListener('pointerup', this._onEnd);
    document.removeEventListener('pointercancel', this._onEnd);
  }
}
