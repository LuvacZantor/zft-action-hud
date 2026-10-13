import { MODULE_ID } from './settings.js';

/** Screen-space, theme-matched slider that never inherits HUD CSS zoom. */
export class ZFTScalePopover {
  constructor({id, label, setting, min, max, trigger, source, preview, onSaved}) {
    Object.assign(this, {id, label, setting, min, max, trigger, source, preview, onSaved});
    this.panel = null;
    this._dismiss = event => {
      const hud = this.source?.();
      const draggingHud = hud?.contains(event.target) && event.target.closest?.('[data-drag-handle]');
      // Do not dismiss the utility slider on focus loss. It has an explicit
      // close button and must remain open when using other Foundry windows.
    };
    this._resize = () => this.position();
  }
  get open() { return Boolean(this.panel); }
  toggle() { return this.panel ? this.close() : this.show(); }
  show() {
    const trigger = this.trigger();
    const source = this.source();
    if (!trigger || !source) return;
    trigger.setAttribute('aria-expanded','true');
    trigger.setAttribute('aria-pressed','true');
    if (!this.panel) {
      const panel = document.createElement('section');
      panel.id = this.id;
      panel.className = 'zft-external-scale-popover';
      panel.setAttribute('role','group');
      panel.setAttribute('aria-label',this.label);
      const title = document.createElement('strong'); title.textContent = this.label;
      const row = document.createElement('label'); row.className = 'zft-external-scale-row';
      const range = document.createElement('input'); range.type = 'range';
      range.min = String(this.min); range.max = String(this.max); range.step = '0.05';
      range.setAttribute('aria-label', this.label);
      const out = document.createElement('output'); out.className = 'zft-external-scale-value';
      const close = document.createElement('button'); close.type = 'button'; close.title = 'Close scale control';
      close.setAttribute('aria-label','Close scale control');
      const icon = document.createElement('i'); icon.className = 'fa-solid fa-xmark'; icon.setAttribute('aria-hidden','true');
      close.append(icon);
      close.addEventListener('click', () => this.close());
      range.addEventListener('input', () => {
        const value = Math.max(this.min, Math.min(this.max, Number(range.value)));
        out.textContent = `${Math.round(value * 100)}%`;
        this.preview(value);
      });
      range.addEventListener('change', async () => {
        try { await game.settings.set(MODULE_ID, this.setting, Math.max(this.min, Math.min(this.max, Number(range.value))));
          this.onSaved?.();
        } catch (error) { console.error('[ZFT] Could not save UI Scale',error); ui.notifications?.warn('Could not save HUD scale.'); this.preview(game.settings.get(MODULE_ID,this.setting)); }
      });
      row.append(title,range,out,close); panel.append(row);
      document.body.append(panel); this.panel = panel;
      document.addEventListener('pointerdown',this._dismiss,true);
      window.addEventListener('resize',this._resize);
    }
    this.sync();
  }
  sync() {
    if (!this.panel) return;
    const source = this.source();
    if (!source) { this.close(); return; }
    this.panel.dataset.theme = source.dataset.theme || 'zft-default';
    const style = getComputedStyle(source);
    for (const token of ['--zft-accent','--zft-accent-bright','--zft-text','--zft-muted','--zft-bg','--zft-panel','--zft-panel2','--zft-panel3','--zft-border','--zft-inset','--zft-shadow','--zft-font']) {
      const val = style.getPropertyValue(token); if (val) this.panel.style.setProperty(token, val.trim());
    }
    const input = this.panel.querySelector('input[type="range"]');
    if (document.activeElement !== input) {
      input.value = String(game.settings.get(MODULE_ID,this.setting));
      this.panel.querySelector('output').textContent = `${Math.round(Number(input.value)*100)}%`;
    }
    this.position();
  }
  position() {
    if (!this.panel || !this.trigger()) return;
    const button = this.trigger().getBoundingClientRect();
    const popup = this.panel.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin,Math.min(innerWidth-popup.width-margin,button.right-popup.width));
    const top = button.top >= popup.height + 12 ? button.top-popup.height-6 : button.bottom+6;
    this.panel.style.left = `${Math.round(left)}px`;
    this.panel.style.top = `${Math.round(Math.max(margin,Math.min(innerHeight-popup.height-margin,top)))}px`;
  }
  close() {
    this.trigger()?.setAttribute('aria-expanded','false');
    this.trigger()?.setAttribute('aria-pressed','false');
    this.panel?.remove(); this.panel=null;
    document.removeEventListener('pointerdown',this._dismiss,true);
    window.removeEventListener('resize',this._resize);
  }
}
