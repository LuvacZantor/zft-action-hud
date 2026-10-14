import { renderDescriptionHtml } from './item-preview.js';

const TEMPLATE = 'modules/zft-action-hud/templates/effect-tooltip.hbs';
const OPEN_DELAY_MS = 300;
const EXIT_GRACE_MS = 350;
const POPUP_ID = 'zft-action-hud-effect-tooltip';

/** Render sanitized, read-only effect details from the system adapter. */
export async function renderEffectTooltip(entry) {
  const fragment = await renderDescriptionHtml(entry.descriptionHtml);
  const holder = document.createElement('div');
  if (fragment) holder.append(fragment);
  const context = {
    name: entry.name || 'Effect',
    durationLabel: entry.durationLabel || 'Ongoing',
    sourceName: entry.sourceName || '',
    // Only sanitized markup enters triple-brace Handlebars. Labels stay escaped.
    descriptionHtml: holder.innerHTML
  };
  return await foundry.applications.handlebars.renderTemplate(TEMPLATE, context);
}

/**
 * A body-level, interactive effect popup. Foundry's native #tooltip is not
 * hoverable; it closes whenever the cursor leaves its icon. Keep this popup
 * open while either the effect icon or popup is hovered, allowing scrolling
 * and links. A short exit grace period bridges the icon-to-popup movement.
 */
export class EffectTooltip {
  constructor({ render = renderEffectTooltip } = {}) {
    this.render = render;
    this.root = null;
    this.node = null;
    this.theme = 'zft-default';
    this.textures = true;
    this.html = new Map();
    this.activeIcon = null;
    this.openTimer = null;
    this.closeTimer = null;
  }

  get isVisible() { return Boolean(this.node && !this.node.hidden); }

  setTheme(theme, textures = true) {
    this.theme = theme || 'zft-default';
    this.textures = Boolean(textures);
    if (this.node) {
      this.node.className = `zft-hud-effect-tooltip theme-${this.theme}`;
      this.node.dataset.theme = this.theme;
      this.node.dataset.textures = String(this.textures);
    }
  }

  async wire(root, effects, theme, changedIds = null) {
    if (!changedIds) {
      this.hide(true);
      this.root = root;
      this.html.clear();
    }
    this.setTheme(theme, root.dataset.textures !== 'false');
    const entries = new Map(effects.map(entry => [entry.id, entry]));
    const promises = [];
    for (const icon of root.querySelectorAll('[data-hud-effect]')) {
      const effect = entries.get(icon.dataset.hudEffect);
      if (!effect) continue;
      // Do not use Foundry's data-tooltip-html; that tooltip is not hoverable.
      icon.removeAttribute('data-tooltip-html');
      icon.removeAttribute('data-tooltip-class');
      icon.removeAttribute('data-tooltip-direction');
      if (!icon.dataset.zftEffectHoverWired) {
        icon.dataset.zftEffectHoverWired = 'true';
        icon.addEventListener('pointerenter', event => {
          if (event.pointerType !== 'touch') this.schedule(icon);
        });
        icon.addEventListener('pointerleave', event => {
          if (!this.node?.contains(event.relatedTarget)) this.scheduleClose();
        });
        icon.addEventListener('focus', () => this.schedule(icon));
        icon.addEventListener('blur', event => {
          if (!this.node?.contains(event.relatedTarget)) this.scheduleClose();
        });
      }
      if (changedIds && !changedIds.has(effect.id)) continue;
      const requestRoot = root;
      promises.push(this.render(effect).then(html => {
        if (!icon.isConnected || this.root !== requestRoot) return;
        icon.dataset.zftDurationLabel = effect.durationLabel || '';
        this.html.set(icon.dataset.hudEffect, html);
        if (this.activeIcon === icon && !this.openTimer) this.show(icon);
      }));
    }
    await Promise.all(promises);
  }

  schedule(icon) {
    this.cancelClose();
    this.cancelOpen();
    if (this.activeIcon === icon && this.isVisible) return;
    this.hide(true);
    this.activeIcon = icon;
    this.openTimer = window.setTimeout(() => {
      this.openTimer = null;
      this.show(icon);
    }, OPEN_DELAY_MS);
  }

  show(icon) {
    if (this.activeIcon !== icon || !icon?.isConnected || !this.root?.contains(icon)) return;
    const html = this.html.get(icon.dataset.hudEffect);
    if (!html) return; // Async description enrichment will show once complete.
    this.ensureNode();
    this.node.innerHTML = html;
    icon.setAttribute('aria-describedby', POPUP_ID);
    this.setTheme(this.theme, this.textures);
    this.node.hidden = false;
    this.place(icon);
  }

  ensureNode() {
    if (this.node?.isConnected) return;
    const node = document.createElement('div');
    node.id = POPUP_ID;
    node.className = `zft-hud-effect-tooltip theme-${this.theme}`;
    node.dataset.theme = this.theme;
    node.dataset.textures = String(this.textures);
    node.setAttribute('role', 'tooltip');
    node.hidden = true;
    node.addEventListener('pointerenter', () => this.cancelClose());
    node.addEventListener('pointerleave', event => {
      if (!this.activeIcon?.contains(event.relatedTarget)) this.scheduleClose();
    });
    node.addEventListener('focusin', () => this.cancelClose());
    node.addEventListener('focusout', event => {
      if (!node.contains(event.relatedTarget) && !this.activeIcon?.contains(event.relatedTarget))
        this.scheduleClose();
    });
    document.body.append(node);
    this.node = node;
  }

  place(icon) {
    // Stay in viewport, flip below an effect near the top edge, and overlap
    // the icon by 2px to avoid a dead hover gap at either orientation.
    const r = icon.getBoundingClientRect();
    const node = this.node;
    node.style.visibility = 'hidden';
    node.style.left = '0px';
    node.style.top = '0px';
    const size = node.getBoundingClientRect();
    const width = size.width;
    const height = size.height;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8,
      r.left + r.width / 2 - width / 2));
    const above = r.top - height + 2;
    const below = r.bottom - 2;
    const preferAbove = above >= 8 || (r.top - 8 > window.innerHeight - r.bottom - 8);
    const top = Math.max(8, Math.min(window.innerHeight - height - 8, preferAbove ? above : below));
    node.style.left = `${Math.round(left)}px`;
    node.style.top = `${Math.round(top)}px`;
    node.style.visibility = '';
  }

  scheduleClose() {
    this.cancelClose();
    this.closeTimer = window.setTimeout(() => this.hide(), EXIT_GRACE_MS);
  }

  cancelOpen() {
    if (this.openTimer !== null) window.clearTimeout(this.openTimer);
    this.openTimer = null;
  }

  cancelClose() {
    if (this.closeTimer !== null) window.clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  hide(force = false) {
    this.cancelOpen();
    this.cancelClose();
    this.activeIcon?.removeAttribute('aria-describedby');
    this.activeIcon = null;
    if (this.node) this.node.hidden = true;
  }

  destroy() {
    this.hide(true);
    this.node?.remove();
    this.node = null;
    this.root = null;
    this.html.clear();
  }
}
