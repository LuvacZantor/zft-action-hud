import { MODULE_ID, VERSION } from './settings.js';
import { resolveTheme } from '../themes/registry.js';
import { executeHotbarMacro, makeMacroReference } from './macro-hotbar.js';

/** Macro Directory folders are authoritative. Neither library writes Actor flags. */
export const LIBRARY_CONFIG = Object.freeze({
  shared: { folderKey: 'sharedMacroFolderId', positionKey: 'sharedMacroPosition', title: 'Shared Macros' },
  gm: { folderKey: 'gmMacroFolderId', positionKey: 'gmMacroPosition', title: 'GM Macros' }
});

export function macroFolders() {
  return [...(game.folders?.contents ?? [])].filter(folder => folder.type === 'Macro' && !folder.pack)
    .sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
}

/** Follow the actual selected Folder's native a/m sorting mode on every render. */
export function libraryMacroDocuments(macros, folderId, folder = game.folders?.get?.(folderId)) {
  if (!folderId) return [];
  const visible = [...macros].filter(m => m?.folder?.id === folderId && m.visible !== false);
  const alpha = (a,b) => a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:'base'}) || String(a.id).localeCompare(String(b.id));
  return visible.sort(folder?.sorting === 'm'
    ? (a,b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || alpha(a,b)
    : alpha);
}

/** Foundry Macro.sort is the only persisted library order.
 * Reindex one selected Macro folder deterministically. The native Folder and
 * all clients will read these same keys. Nothing is stored on Actors/Tokens.
 */
export async function reorderFolderMacro(folderId, sourceId, targetId, sortBefore = true) {
  if (!game.user?.isGM) throw new Error('Only a GM may reorder Macro Directory folders.');
  const folder = game.folders?.get?.(folderId);
  if (!folder || folder.type !== 'Macro' || folder.sorting !== 'm')
    throw new Error('A Macro Directory folder in Manual sorting mode is required.');
  const source = game.macros?.get?.(sourceId);
  const target = game.macros?.get?.(targetId);
  if (!source || !target || source.id === target.id ||
      source.folder?.id !== folderId || target.folder?.id !== folderId) return false;
  const siblings = [...(game.macros?.contents ?? [])]
    .filter(macro => macro.folder?.id === folderId)
    .sort((a,b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) ||
      a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:'base'}));
  const originalIds = siblings.map(macro => macro.id);
  const sourceIndex = siblings.findIndex(macro => macro.id === sourceId);
  if (sourceIndex < 0) return false;
  const [moved] = siblings.splice(sourceIndex, 1);
  const targetIndex = siblings.findIndex(macro => macro.id === targetId);
  if (targetIndex < 0) return false;
  siblings.splice(targetIndex + (sortBefore ? 0 : 1), 0, moved);
  if (siblings.every((macro, index) => macro.id === originalIds[index])) return false;

  // Foundry's native Macro sort field, never a shadow ZFT preference.
  // Reindexing the chosen folder avoids colliding legacy/duplicate sort keys.
  const updates = siblings.map((macro, index) => ({_id: macro.id, sort: (index + 1) * 10000}));
  await foundry.documents.Macro.updateDocuments(updates);
  return true;
}

const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
function make(tag,classes='',text='') {
  const el=document.createElement(tag);el.className=classes;if(text)el.textContent=text;return el;
}

/** Two themeable, Folder-backed Macro libraries; GM drag-sort writes native Folder order. */
export class ZFTMacroLibraries {
  constructor(hud) {
    this.hud=hud;
    this.windows=new Map();
    this._drags=new Map();
    this._macroDrag=null;
    this._sortBusy=false;
    this._suppressClickUntil=0;
  }
  configured(kind) {
    const config=LIBRARY_CONFIG[kind];
    return Boolean(config && (kind!=='gm'||game.user?.isGM) && game.settings.get(MODULE_ID,config.folderKey));
  }
  get isOpen() { return this.windows.size > 0; }
  toggle(kind) {
    if (!LIBRARY_CONFIG[kind] || (kind==='gm'&&!game.user?.isGM)) return;
    if(this.windows.has(kind)) {this.close(kind);return;}
    if(!this.configured(kind)) return;
    this.open(kind);
  }
  open(kind) {
    if (!this.configured(kind)) return;
    const config=LIBRARY_CONFIG[kind];
    const root=make('section','zft-macro-library');
    root.id=kind==='gm'?'zft-gm-macros':'zft-shared-macros';
    root.dataset.kind=kind;
    root.setAttribute('role','region');root.setAttribute('aria-label',config.title);
    root.append(make('header','zft-macro-library-header'));
    document.body.append(root);
    this.windows.set(kind,root);
    this._paint(kind,root);
    this._setPosition(kind,root);
    this._wireHeader(kind,root);
  }
  _setPosition(kind,root) {
    const rect=root.getBoundingClientRect();
    const position=game.settings.get(MODULE_ID,LIBRARY_CONFIG[kind].positionKey)||{};
    // Stay away from Foundry's scene navigator and make the two windows distinct.
    const x=Number.isFinite(position.x)?position.x:(kind==='gm'?610:230);
    const y=Number.isFinite(position.y)?position.y:(kind==='gm'?160:160);
    root.style.left=`${clamp(x,8,Math.max(8,innerWidth-rect.width-8))}px`;
    root.style.top=`${clamp(y,8,Math.max(8,innerHeight-rect.height-8))}px`;
  }
  _wireHeader(kind,root) {
    root.querySelector('[data-library-close]')?.addEventListener('click',()=>this.close(kind));
    const grip=root.querySelector('[data-library-drag]');
    grip?.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button'))return;
      event.preventDefault();
      const box=root.getBoundingClientRect();
      const deltaX=event.clientX-box.left,deltaY=event.clientY-box.top;
      const move=e=>{
        root.style.left=`${clamp(e.clientX-deltaX,8,Math.max(8,innerWidth-root.offsetWidth-8))}px`;
        root.style.top=`${clamp(e.clientY-deltaY,8,Math.max(8,innerHeight-root.offsetHeight-8))}px`;
      };
      const stop=async()=>{
        this._drags.delete(kind);
        window.removeEventListener('pointermove',move);
        window.removeEventListener('pointerup',stop);
        window.removeEventListener('pointercancel',stop);
        if(!root.isConnected)return;
        const bounds=root.getBoundingClientRect();
        try { await game.settings.set(MODULE_ID,LIBRARY_CONFIG[kind].positionKey,{x:Math.round(bounds.left),y:Math.round(bounds.top)}); }
        catch(error){console.warn('[ZFT] Could not save macro library position',error);}
      };
      window.addEventListener('pointermove',move);
      window.addEventListener('pointerup',stop);
      window.addEventListener('pointercancel',stop);
      this._drags.set(kind,stop);
    });
  }
  _paint(kind,root) {
    if(!root || !this.configured(kind)) {this.close(kind);return;}
    const cfg=LIBRARY_CONFIG[kind];
    const folderId=game.settings.get(MODULE_ID,cfg.folderKey);
    const folder=game.folders?.get?.(folderId);
    root.dataset.theme=resolveTheme({clientTheme:game.settings.get(MODULE_ID,'clientTheme')});
    root.dataset.textures=String(Boolean(game.settings.get(MODULE_ID,'showThemeTextures')));
    root.style.setProperty('--zft-scale',String(game.settings.get(MODULE_ID,'hotbarUiScale')||1));
    root.replaceChildren();
    const header=make('header','zft-macro-library-header');header.dataset.libraryDrag='';
    const title=make('span','zft-macro-library-title',cfg.title);
    const location=make('small','zft-macro-library-folder',folder?.name||'Macro folder');
    const close=make('button','zft-macro-library-close','×');close.type='button';
    close.title='Close macro library';close.setAttribute('aria-label',`Close ${cfg.title}`);close.dataset.libraryClose='';
    header.append(title,location,close);
    const body=make('div','zft-macro-library-body');
    const items=libraryMacroDocuments(game.macros?.contents||[],folderId,folder);
    const manual=folder?.sorting === 'm';
    const gmReorder=Boolean(game.user?.isGM && manual);
    const grid=make('div','zft-macro-library-grid');
    for(const macro of items) {
      const uuid=macro.uuid||`Macro.${macro.id}`;
      const button=make('button','zft-macro-library-item');
      button.type='button';button.draggable=macro.canExecute!==false;
      button.dataset.macroUuid=uuid;
      button.title=`${macro.name}${macro.canExecute===false?' (not executable by this player)':' · Click to execute · Drag to personal hotbar'}${gmReorder?' · GM: drag to reorder folder':''}`;
      button.setAttribute('aria-label',`Macro: ${macro.name}`);
      const img=make('img');img.src=macro.img||'icons/svg/dice-target.svg';img.alt='';
      const name=make('span','zft-macro-library-name',macro.name);
      button.append(img,name);
      if(macro.canExecute===false) {button.disabled=true;button.title=`${macro.name} (permission required)`;}
      button.addEventListener('click',async event=>{
        event.stopPropagation();
        if (performance.now() < this._suppressClickUntil) return;
        const ref=makeMacroReference(uuid,macro);
        const result=await executeHotbarMacro(ref,{actor:this.hud?._actor});
        if(!result.ok) ui.notifications?.warn(`Cannot execute ${macro.name}: ${result.reason}.`);
      });
      button.addEventListener('dragstart',event=>{
        if(macro.canExecute===false){event.preventDefault();return;}
        const payload=JSON.stringify({type:'Macro',uuid});
        // copyMove permits both native folder rearrangement and the existing
        // copy onto a character's custom hotbar; the destination chooses.
        event.dataTransfer.effectAllowed=gmReorder?'copyMove':'copy';
        event.dataTransfer.setData('application/x-zft-hud-action',payload);
        event.dataTransfer.setData('text/plain',payload);
        if(gmReorder) {
          this._macroDrag={kind,folderId,sourceId:macro.id};
          event.dataTransfer.setData('application/x-zft-macro-folder-sort',macro.id);
        }
        button.classList.add('is-dragging');
      });
      button.addEventListener('dragend',()=>{
        this._macroDrag=null;
        this._suppressClickUntil=performance.now()+250;
        root.querySelectorAll('.is-dragging,.is-drop-before,.is-drop-after').forEach(el=>
          el.classList.remove('is-dragging','is-drop-before','is-drop-after'));
      });
      grid.append(button);
    }
    if (gmReorder && items.length) this._wireSortGrid(kind, folderId, grid);
    if(!items.length) body.append(make('p','zft-macro-library-empty','No available macros in this folder.'));
    else body.append(grid);
    root.append(header,body);
  }

  /** Return an insertion boundary in the visual grid (0 to item count).
   * Hit-tests rows and midpoint boundaries, including gaps and empty cells.
   */
  _gridInsertionIndex(grid, x, y) {
    const buttons = [...grid.querySelectorAll('.zft-macro-library-item')];
    if (!buttons.length) return 0;
    const rows = [];
    for (let index = 0; index < buttons.length; index++) {
      const rect = buttons[index].getBoundingClientRect();
      const previous = rows[rows.length - 1];
      if (!previous || Math.abs(previous.top - rect.top) > 4)
        rows.push({top:rect.top, centerY:(rect.top + rect.bottom)/2, entries:[]});
      rows[rows.length - 1].entries.push({index, midX:(rect.left + rect.right)/2});
    }
    const row = rows.reduce((best, candidate) =>
      Math.abs(candidate.centerY-y) < Math.abs(best.centerY-y) ? candidate : best);
    for (const entry of row.entries) if (x < entry.midX) return entry.index;
    return row.entries[row.entries.length-1].index + 1;
  }

  _wireSortGrid(kind, folderId, grid) {
    const mime = 'application/x-zft-macro-folder-sort';
    const eligible = event => Boolean(game.user?.isGM && !this._sortBusy &&
      game.folders?.get?.(folderId)?.sorting === 'm' &&
      [...(event.dataTransfer?.types ?? [])].includes(mime));
    const clearMarkers = () => grid.querySelectorAll('.is-drop-before,.is-drop-after')
      .forEach(button => button.classList.remove('is-drop-before','is-drop-after'));
    grid.addEventListener('dragover', event => {
      if (!eligible(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect='move';
      clearMarkers();
      const buttons = [...grid.querySelectorAll('.zft-macro-library-item')];
      const boundary = this._gridInsertionIndex(grid,event.clientX,event.clientY);
      const marker = buttons[Math.min(boundary,buttons.length-1)];
      marker?.classList.add(boundary>=buttons.length?'is-drop-after':'is-drop-before');
    });
    grid.addEventListener('dragleave', event => {
      if (!grid.contains(event.relatedTarget)) clearMarkers();
    });
    grid.addEventListener('drop', event => {
      if (!eligible(event)) return;
      event.preventDefault();
      event.stopPropagation();
      clearMarkers();
      const sourceId = event.dataTransfer?.getData(mime) || this._macroDrag?.sourceId;
      const buttons = [...grid.querySelectorAll('.zft-macro-library-item')];
      const boundary = this._gridInsertionIndex(grid,event.clientX,event.clientY);
      const targetButton = buttons[Math.min(boundary,buttons.length-1)];
      const targetId = targetButton?.dataset.macroUuid?.split('.').at(-1);
      const before = boundary < buttons.length;
      this._macroDrag=null;
      this._suppressClickUntil=performance.now()+250;
      if (!sourceId || !targetId) {
        console.warn(`[ZFT] ⚠️ v${VERSION} | Macro drop has no valid source/target`, {kind,sourceId,targetId});
        return;
      }
      console.log(`[ZFT] 🔍 v${VERSION} | Native Macro folder drop`, {kind,sourceId,targetId,before,boundary});
      void this._reorder(folderId,sourceId,targetId,before);
    });
  }

  async _reorder(folderId,sourceId,targetId,before) {
    if(this._sortBusy)return;
    this._sortBusy=true;
    try {
      const changed = await reorderFolderMacro(folderId,sourceId,targetId,before);
      console.log(`[ZFT] ${changed ? '✅' : '🔍'} v${VERSION} | ${changed ? 'Macro folder order saved' : 'Macro folder drop left order unchanged'}`, {folderId,sourceId,targetId,before});
      // updateMacro hooks refresh all clients; also repaint locally.
      this.refresh();
    } catch(error) {
      console.error('[ZFT] ❌ Macro Directory sort failed',error);
      ui.notifications?.error('Could not reorder Macro Directory; see console.');
      this.refresh();
    } finally {this._sortBusy=false;}
  }
  refresh() {
    for(const [kind,root] of [...this.windows]){
      if(!this.configured(kind)){this.close(kind);continue;}
      // Repainting must not replace root or reset user-saved coordinates.
      this._paint(kind,root);
      this._wireHeader(kind,root);
    }
    this.hud?.syncMacroLibraryButtons?.();
  }
  close(kind){
    this._drags.get(kind)?.();this._drags.delete(kind);
    this.windows.get(kind)?.remove();this.windows.delete(kind);
    this.hud?.syncMacroLibraryButtons?.();
  }
  destroy(){this._macroDrag=null;for(const kind of [...this.windows.keys()])this.close(kind);}
}
