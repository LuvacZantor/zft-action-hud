import { MODULE_ID } from './settings.js';
import { resolveTheme } from '../themes/registry.js';
import { executeHotbarMacro, makeMacroReference } from './macro-hotbar.js';

/** Macro Directory folders are authoritative. Neither library writes Actor flags. */
export const LIBRARY_CONFIG = Object.freeze({
  shared: { folderKey: 'sharedMacroFolderId', sortKey: 'sharedMacroSort', positionKey: 'sharedMacroPosition', title: 'Shared Macros' },
  gm: { folderKey: 'gmMacroFolderId', sortKey: 'gmMacroSort', positionKey: 'gmMacroPosition', title: 'GM Macros' }
});

export function macroFolders() {
  return [...(game.folders?.contents ?? [])].filter(folder => folder.type === 'Macro' && !folder.pack)
    .sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
}

export function libraryMacroDocuments(macros, folderId, sort = 'alpha') {
  if (!folderId) return [];
  const visible = [...macros].filter(m => m?.folder?.id === folderId && m.visible !== false);
  const alpha = (a,b) => a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:'base'}) || String(a.id).localeCompare(String(b.id));
  return visible.sort(sort === 'directory'
    ? (a,b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || alpha(a,b)
    : alpha);
}

const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
function make(tag,classes='',text='') {
  const el=document.createElement(tag);el.className=classes;if(text)el.textContent=text;return el;
}

/** A read-only, themeable floating Macro hotbar. Shared and GM use the same implementation. */
export class ZFTMacroLibraries {
  constructor(hud) {
    this.hud=hud;
    this.windows=new Map();
    this._drags=new Map();
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
    const sort=game.settings.get(MODULE_ID,cfg.sortKey);
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
    const items=libraryMacroDocuments(game.macros?.contents||[],folderId,sort);
    const grid=make('div','zft-macro-library-grid');
    for(const macro of items) {
      const uuid=macro.uuid||`Macro.${macro.id}`;
      const button=make('button','zft-macro-library-item');
      button.type='button';button.draggable=macro.canExecute!==false;
      button.dataset.macroUuid=uuid;
      button.title=`${macro.name}${macro.canExecute===false?' (not executable by this player)':' · Click to execute · Drag to personal hotbar'}`;
      button.setAttribute('aria-label',`Macro: ${macro.name}`);
      const img=make('img');img.src=macro.img||'icons/svg/dice-target.svg';img.alt='';
      const name=make('span','zft-macro-library-name',macro.name);
      button.append(img,name);
      if(macro.canExecute===false) {button.disabled=true;button.title=`${macro.name} (permission required)`;}
      button.addEventListener('click',async event=>{
        event.stopPropagation();
        const ref=makeMacroReference(uuid,macro);
        const result=await executeHotbarMacro(ref,{actor:this.hud?._actor});
        if(!result.ok) ui.notifications?.warn(`Cannot execute ${macro.name}: ${result.reason}.`);
      });
      button.addEventListener('dragstart',event=>{
        if(macro.canExecute===false){event.preventDefault();return;}
        const payload=JSON.stringify({type:'Macro',uuid});
        event.dataTransfer.effectAllowed='copy';
        event.dataTransfer.setData('application/x-zft-hud-action',payload);
        event.dataTransfer.setData('text/plain',payload);
      });
      grid.append(button);
    }
    if(!items.length) body.append(make('p','zft-macro-library-empty','No available macros in this folder.'));
    else body.append(grid);
    root.append(header,body);
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
  destroy(){for(const kind of [...this.windows.keys()])this.close(kind);}
}
