/** Optional, theme-independent button tint overrides shared by all HUD surfaces.
 * The core never stores a copy of a theme color: absence of an override means
 * the button follows whichever theme is active. */
export const validButtonColor = value => /^#[0-9a-f]{6}$/i.test(String(value ?? ''));
export function applyButtonColor(element, color) {
  if (!element) return;
  const valid = validButtonColor(color);
  element.classList.toggle('zft-custom-button-color', valid);
  if (valid) element.style.setProperty('--zft-button-override', color);
  else element.style.removeProperty('--zft-button-override');
}
function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}
/** HSV conversion for a conventional square color field and hue strip. */
export function hsvFromHex(hex) {
  const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255);
  const max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max-min;
  let h=0;
  if(delta) {
    if(max===r) h=((g-b)/delta)%6;
    else if(max===g) h=(b-r)/delta+2;
    else h=(r-g)/delta+4;
    h=(h*60+360)%360;
  }
  return [Math.round(h), Math.round(max ? 100*delta/max : 0), Math.round(max*100)];
}
export function hexFromHsv(h,s,v) {
  s=Math.max(0,Math.min(100,s))/100;v=Math.max(0,Math.min(100,v))/100;
  const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  const [r,g,b] = h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return '#'+[r,g,b].map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();
}
export const DEFAULT_CATEGORY_COLORS = Object.freeze({
  weapons:'#D65D68', spells:'#AC83E2', features:'#45BDB4',
  consumables:'#55C88E', equipment:'#93A4B8', tools:'#E4AC52',
  inventory:'#BF9B76', checks:'#668DD0', abilities:'#DC5A5A', saves:'#D68A3E', skills:'#35A6A0', favorites:'#F0C75E', recent:'#5BADE5'
});

/** Fixed-position contextual menu and HSV color square, never nested inside scaled HUDs. */
export class ZFTButtonColors {
  constructor() {
    this.panel=null; this._onClose=null;
    this._boundDismiss=event=>{ if(this.panel && !this.panel.contains(event.target)) this.close(); };
    this._boundEscape=event=>{ if(event.key==='Escape') this.close(); };
  }
  close() {
    const onClose=this._onClose; this._onClose=null;
    if(onClose) onClose();
    this.panel?.remove(); this.panel=null;
    document.removeEventListener('pointerdown',this._boundDismiss,true);
    document.removeEventListener('keydown',this._boundEscape,true);
  }
  _show(panel, anchor, x=null,y=null) {
    this.close();
    const theme = anchor.closest('[data-theme]');
    panel.dataset.theme=theme?.dataset.theme || 'zft-default';
    panel.style.setProperty('--zft-font',getComputedStyle(anchor).getPropertyValue('--zft-font').trim()||'Signika, sans-serif');
    if (theme) for (const token of ['--zft-text','--zft-muted','--zft-panel','--zft-panel3','--zft-border','--zft-accent-bright']) {
      const value = getComputedStyle(theme).getPropertyValue(token);
      if(value) panel.style.setProperty(token,value.trim());
    }
    document.body.append(panel); this.panel=panel;
    const rect=panel.getBoundingClientRect(), bound=anchor.getBoundingClientRect();
    const left=x??bound.left, top=y??bound.bottom+5;
    panel.style.left=`${Math.max(8,Math.min(innerWidth-rect.width-8,left))}px`;
    panel.style.top=`${Math.max(8,Math.min(innerHeight-rect.height-8,top))}px`;
    // Delay registering document dismissal until the triggering contextmenu completes.
    document.addEventListener('pointerdown',this._boundDismiss,true);
    document.addEventListener('keydown',this._boundEscape,true);
  }
  /** Only actual custom overrides get a Reset entry. Menu is intentionally heading-free. */
  openMenu({target,title,current,defaultColor=null,resetLabel='Reset Color',onApply,onReset,onSheet,event,onPreview,onRevert}) {
    const menu=el('div','zft-button-color-menu'); menu.setAttribute('role','menu');
    const add=(label,icon,action)=>{
      const button=el('button');button.type='button';button.setAttribute('role','menuitem');
      const symbol=el('i',`fa-solid fa-${icon}`);symbol.setAttribute('aria-hidden','true');
      button.append(symbol,document.createTextNode(label));
      button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();this.close();action();});
      menu.append(button);
    };
    if(onSheet) add('Open Item Sheet','book-open',onSheet);
    add('Customize Color','palette',()=>this.openPicker({target,title,current,defaultColor,resetLabel,onApply,onReset,onPreview,onRevert}));
    if(validButtonColor(current)) add(resetLabel,'rotate-left',()=>void onReset());
    this._show(menu,target,event?.clientX,event?.clientY);
  }
  openPicker({target,title,current,defaultColor=null,resetLabel='Reset Color',onApply,onReset,onPreview,onRevert}) {
    const panel=el('section','zft-button-color-picker');
    panel.setAttribute('role','dialog');panel.setAttribute('aria-label',`Customize ${title} color`);
    const heading=el('div','zft-button-color-heading');
    heading.append(el('strong','',title),el('span','','Choose Color'));panel.append(heading);
    const original=validButtonColor(current)?current.toUpperCase():null;
    const initial=original||(validButtonColor(defaultColor)?defaultColor.toUpperCase():'#A56BDC');
    let color=initial,[h,s,v]=hsvFromHex(initial);
    const preview=el('div','zft-button-color-preview');
    const field=el('div','zft-button-color-field-square');
    field.tabIndex=0;field.setAttribute('role','application');
    field.setAttribute('aria-label','Color field. Horizontal: saturation; vertical: brightness. Use arrow keys to adjust.');
    const marker=el('span','zft-button-color-point');field.append(marker);
    const hue=el('input','zft-button-color-hue');hue.type='range';hue.min='0';hue.max='359';hue.step='1';
    hue.setAttribute('aria-label','Hue');
    const hueRail=el('div','zft-button-color-hue-rail');hueRail.append(hue);
    const controls=el('div','zft-button-color-wheel-layout');controls.append(field,hueRail);panel.append(controls);
    panel.append(preview);
    const label=el('label','zft-button-color-field','HEX');
    const hex=el('input','zft-button-color-hex');hex.type='text';hex.maxLength=7;hex.spellcheck=false;hex.setAttribute('aria-label','HEX color');
    const nativeColor=el('input','zft-button-color-native');nativeColor.type='color';nativeColor.setAttribute('aria-label','System color picker');
    label.append(hex,nativeColor);panel.append(label);
    const previewApply=value=>{
      if(onPreview)onPreview(value);
      else applyButtonColor(target,value);
    };
    const revert=()=>{
      if(onRevert)onRevert();
      else applyButtonColor(target,original||defaultColor);
    };
    const update=(exact=null)=>{
      color=exact||hexFromHsv(h,s,v);
      hex.value=color;hex.classList.remove('is-invalid');nativeColor.value=color;
      hue.value=String(h);field.style.setProperty('--zft-picker-hue',`hsl(${h} 100% 50%)`);
      marker.style.left=`${s}%`;marker.style.top=`${100-v}%`;
      preview.style.backgroundColor=color;preview.textContent=color;
      previewApply(color);
    };
    const setHex=value=>{if(!validButtonColor(value))return false;[h,s,v]=hsvFromHex(value);update(value.toUpperCase());return true;};
    const fieldPointer=event=>{
      const r=field.getBoundingClientRect();
      s=Math.round(Math.max(0,Math.min(100,100*(event.clientX-r.left)/r.width)));
      v=Math.round(Math.max(0,Math.min(100,100*(1-(event.clientY-r.top)/r.height))));
      update();
    };
    field.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      event.preventDefault();field.setPointerCapture?.(event.pointerId);fieldPointer(event);
    });
    field.addEventListener('pointermove',event=>{if(event.buttons&1)fieldPointer(event);});
    field.addEventListener('keydown',event=>{
      const step=event.shiftKey?10:1;
      if(event.key==='ArrowRight')s=Math.min(100,s+step);
      else if(event.key==='ArrowLeft')s=Math.max(0,s-step);
      else if(event.key==='ArrowUp')v=Math.min(100,v+step);
      else if(event.key==='ArrowDown')v=Math.max(0,v-step);
      else return;
      event.preventDefault();update();
    });
    hue.addEventListener('input',()=>{h=Number(hue.value);update();});
    hex.addEventListener('input',()=>{
      hex.classList.toggle('is-invalid',!validButtonColor(hex.value));
      if(validButtonColor(hex.value))setHex(hex.value);
    });
    nativeColor.addEventListener('input',()=>setHex(nativeColor.value));
    const buttons=el('div','zft-button-color-actions');
    const cancel=el('button','','Cancel');cancel.type='button';
    const reset=el('button','',resetLabel);reset.type='button';
    const save=el('button','is-primary','Apply');save.type='button';
    cancel.addEventListener('click',()=>this.close());
    reset.addEventListener('click',()=>{this.close();void onReset();});
    save.addEventListener('click',()=>{
      if(!validButtonColor(hex.value))return;
      this._onClose=null;this.close();void onApply(color);
    });
    buttons.append(cancel,reset,save);panel.append(buttons);
    this._show(panel,target);
    this._onClose=revert;
    update(color);
  }
}
