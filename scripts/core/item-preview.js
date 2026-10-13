/**
 * HUD-independent hover-card controller. Uses only adapter-provided Item metadata.
 * Intentionally appended to document.body to escape HUD zoom/overflow clipping.
 */
const HOVER_DELAY_MS = 500;
const THEME_TOKENS = [
  '--zft-panel', '--zft-bg', '--zft-panel2', '--zft-border',
  '--zft-accent-bright', '--zft-text', '--zft-muted', '--zft-shadow'
];

// Rich Item descriptions need real HTML to retain tables, headings, and lists.
// The preview is read-only: sanitize the output of Foundry's native enrichment
// before inserting it into the HUD (do not execute authored scripts/forms).
const PREVIEW_TAGS = new Set([
  'A', 'ARTICLE', 'B', 'BLOCKQUOTE', 'BR', 'CAPTION', 'CODE', 'DD', 'DIV',
  'DL', 'DT', 'EM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'LI',
  'OL', 'P', 'PRE', 'SECTION', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP',
  'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL'
]);
const DROP_ENTIRELY = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'OBJECT', 'EMBED', 'FORM',
  'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'LINK', 'META', 'SVG', 'MATH'
]);

function safeAssetUrl(url, image = false) {
  const value = String(url ?? '').trim();
  if (!value || /[\u0000-\u001f]/.test(value)) return null;
  // Module/system asset paths and HTTPS images are allowed; data: and javascript:
  // and remote unencrypted image loading are intentionally not supported.
  if (/^(?:https:\/\/|\/[^\/]|(?:modules|systems|worlds|icons|assets)\/)/i.test(value)) return value;
  if (!image && /^(?:http:\/\/|#)/i.test(value)) return value;
  return null;
}

export function sanitizePreviewHtml(markup, doc = document) {
  const template = doc.createElement('template');
  template.innerHTML = String(markup ?? '');
  const result = doc.createDocumentFragment();
  const appendSafe = (from, to) => {
    for (const child of Array.from(from.childNodes)) {
      if (child.nodeType === 3) { to.append(doc.createTextNode(child.textContent || '')); continue; }
      if (child.nodeType !== 1 || DROP_ENTIRELY.has(child.tagName)) continue;
      if (!PREVIEW_TAGS.has(child.tagName)) { appendSafe(child, to); continue; }
      const el = doc.createElement(child.tagName.toLowerCase());
      if (child.tagName === 'A') {
        const href = safeAssetUrl(child.getAttribute('href'));
        if (href) { el.setAttribute('href', href); el.setAttribute('rel', 'noopener noreferrer'); }
      }
      if (child.tagName === 'IMG') {
        const src = safeAssetUrl(child.getAttribute('src'), true);
        if (!src) continue;
        el.setAttribute('src', src);
        el.setAttribute('alt', child.getAttribute('alt') || '');
        el.setAttribute('loading', 'lazy');
      }
      if (child.tagName === 'TH' || child.tagName === 'TD') {
        for (const key of ['colspan', 'rowspan']) {
          const n = Number(child.getAttribute(key));
          if (Number.isInteger(n) && n > 1 && n <= 12) el.setAttribute(key, String(n));
        }
      }
      appendSafe(child, el);
      to.append(el);
    }
  };
  appendSafe(template.content, result);
  return result;
}

export async function renderDescriptionHtml(raw, { document: relativeTo, rollData } = {}) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const TextEditor = globalThis.foundry?.applications?.ux?.TextEditor?.implementation;
  // D&D5e and other systems can supply @Reference links. Using Foundry's
  // enrichment keeps their visible labels while the sanitizer removes controls.
  let enriched = text;
  if (typeof TextEditor?.enrichHTML === 'function') {
    try {
      enriched = await TextEditor.enrichHTML(text, {
        secrets: false, documents: true, embeds: false, links: false, rolls: true,
        relativeTo, rollData
      });
    } catch (error) {
      // A bad @Reference must not prevent the entire tooltip from opening.
      console.warn('[ZFT] Action HUD description enrichment failed; using sanitized source HTML', error);
    }
  }
  return sanitizePreviewHtml(enriched);
}

function make(tag, classes, text = '') {
  const el = document.createElement(tag);
  if (classes) el.className = classes;
  if (text) el.textContent = text;
  return el;
}

export class ItemPreview {
  constructor({ getAdapter, getActor, getHudRoot }) {
    this.getAdapter = getAdapter;
    this.getActor = getActor;
    this.getHudRoot = getHudRoot;
    this.node = null;
    this.timer = null;
    this.sequence = 0;
    this.pinned = false;
    this.currentId = null;
  }

  get isVisible() {
    return Boolean(this.node && !this.node.hidden);
  }

  wire(root) {
    for (const button of root.querySelectorAll('[data-use-item]')) {
      const hitArea = button.closest('[data-hud-action-card]') || button;
      hitArea.addEventListener('pointerenter', event => {
        if (event.pointerType === 'touch') return;
        this.schedule(button);
      });
      hitArea.addEventListener('pointerleave', () => this.hide());
      button.addEventListener('focus', () => this.schedule(button));
      button.addEventListener('blur', () => this.hide());
      button.addEventListener('auxclick', event => {
        if (event.button !== 1) return;
        event.preventDefault();
        event.stopPropagation();
        if (this.pinned && this.currentId === button.dataset.useItem) this.hide(true);
        else void this.show(button, true);
      });
    }
  }

  schedule(button) {
    if (this.pinned) return;
    this.hide();
    const sequence = this.sequence;
    this.timer = window.setTimeout(() => {
      if (sequence === this.sequence && button.isConnected) void this.show(button, false);
    }, HOVER_DELAY_MS);
  }

  async show(button, pinned = false) {
    this._cancelTimer();
    const generation = ++this.sequence;
    const actor = this.getActor?.();
    const id = button?.dataset.useItem;
    if (!actor || !id || !button.isConnected) return;
    let data;
    try { data = await this.getAdapter?.()?.getItemPreview?.(actor, id); }
    catch (error) {
      console.warn('[ZFT] ⚠️ Action HUD Item preview unavailable', error);
      return;
    }
    if (!data || generation !== this.sequence || !button.isConnected) return;
    this._ensureNode();
    this._applyTheme();
    this.currentId = id;
    this.pinned = pinned;
    await this._render(data);
    if (generation !== this.sequence || !button.isConnected) return;
    this.node.dataset.pinned = String(pinned);
    this.node.hidden = false;
    this._place(button);
  }

  hide(force = false) {
    this._cancelTimer();
    if (this.pinned && !force) return;
    ++this.sequence;
    this.pinned = false;
    this.currentId = null;
    if (this.node) {
      this.node.hidden = true;
      this.node.dataset.pinned = 'false';
    }
  }

  destroy() {
    this.hide(true);
    this.node?.remove();
    this.node = null;
  }

  _cancelTimer() {
    if (this.timer != null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  _ensureNode() {
    if (this.node?.isConnected) return;
    const el = make('aside');
    el.id = 'zft-action-hud-preview';
    el.hidden = true;
    el.setAttribute('role', 'tooltip');
    el.dataset.pinned = 'false';
    const header = make('div', 'zft-preview-heading');
    const image = make('img', 'zft-preview-image');
    image.alt = '';
    const info = make('div', 'zft-preview-titlebox');
    info.append(make('div', 'zft-preview-title'), make('div', 'zft-preview-type'));
    const close = make('button', 'zft-preview-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close Item preview');
    close.addEventListener('click', () => this.hide(true));
    header.append(image, info, close);
    el.append(header, make('div', 'zft-preview-stats'),
      make('div', 'zft-preview-activities'), make('div', 'zft-preview-description'),
      make('div', 'zft-preview-instruction'));
    document.body.append(el);
    this.node = el;
  }

  _applyTheme() {
    const hud = this.getHudRoot?.();
    if (!hud || !this.node) return;
    this.node.dataset.theme = hud.dataset.theme || 'zft-default';
    const css = getComputedStyle(hud);
    for (const key of THEME_TOKENS) {
      const value = css.getPropertyValue(key).trim();
      if (value) this.node.style.setProperty(key, value);
    }
  }

  async _render(data) {
    const el = this.node;
    el.querySelector('.zft-preview-image').src = data.img || 'icons/svg/item-bag.svg';
    el.querySelector('.zft-preview-title').textContent = data.name || 'Item';
    el.querySelector('.zft-preview-type').textContent = data.kind || 'Item';
    const stats = el.querySelector('.zft-preview-stats');
    stats.replaceChildren();
    for (const [label, value] of [['Activation', data.activation], ['Range', data.range], ['Uses', data.uses]]) {
      if (!value) continue;
      stats.append(make('span', 'zft-preview-stat', `${label}: ${value}`));
    }
    stats.hidden = !stats.childElementCount;
    const activities = el.querySelector('.zft-preview-activities');
    activities.replaceChildren();
    const actionData = Array.isArray(data.activities) ? data.activities : [];
    // The pinned preview is scrollable and can expose all Activities. Normal
    // hover remains compact for Items with many different attack/cast choices.
    const shown = this.pinned ? actionData : actionData.slice(0, 4);
    for (const activity of shown) {
      const section = make('section', 'zft-preview-activity');
      const heading = make('div', 'zft-preview-activity-heading');
      heading.append(make('strong', '', activity.name || activity.kind || 'Activity'));
      if (activity.kind && activity.kind !== activity.name)
        heading.append(make('small', '', activity.kind));
      section.append(heading);
      const metrics = make('div', 'zft-preview-activity-metrics');
      for (const metric of activity.stats ?? []) {
        const stat = make('div', 'zft-preview-activity-stat');
        stat.append(make('small', '', metric.label), make('span', '', metric.value));
        metrics.append(stat);
      }
      if (metrics.childElementCount) section.append(metrics);
      activities.append(section);
    }
    if (!this.pinned && actionData.length > shown.length)
      activities.append(make('div', 'zft-preview-more', `+${actionData.length - shown.length} more Activities. Middle-click to pin and view all.`));
    activities.hidden = !activities.childElementCount;
    const description = el.querySelector('.zft-preview-description');
    const richContent = await renderDescriptionHtml(data.description, { document: data.document, rollData: data.rollData });
    description.replaceChildren();
    if (richContent?.hasChildNodes()) description.append(richContent);
    else description.textContent = 'No description available.';
    el.querySelector('.zft-preview-instruction').textContent = this.pinned
      ? 'Pinned preview · Close with × or Escape.'
      : 'Middle-click to pin this preview · Right-click to inspect.';
  }

  _place(button) {
    if (!this.node) return;
    const itemRect = button.getBoundingClientRect();
    // Use the complete action browser (or hotbar), not the hovered item's
    // bounds. Previews must never cover the next favorite/equipment entry.
    const surface = button.closest('[data-hud-browser], #zft-action-hud-hotbar') || button;
    const bounds = surface.getBoundingClientRect();
    const card = this.node.getBoundingClientRect();
    const margin = 10;
    const gap = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rightX = bounds.right + gap;
    const leftX = bounds.left - card.width - gap;
    const roomRight = viewportWidth - margin - rightX;
    const roomLeft = leftX - margin;
    let x, y;
    if (roomRight >= card.width || (roomRight >= roomLeft && roomRight >= 0)) {
      x = rightX;
      y = itemRect.top;
    } else if (roomLeft >= 0) {
      x = leftX;
      y = itemRect.top;
    } else {
      // Extremely narrow screens: put the preview outside the menu vertically.
      // Its normal hover state is pointer-transparent so browsing remains easy.
      x = bounds.left;
      y = bounds.bottom + gap;
      if (y + card.height > viewportHeight - margin) y = bounds.top - card.height - gap;
    }
    this.node.style.left = `${Math.round(Math.max(margin, Math.min(viewportWidth - margin - card.width, x)))}px`;
    this.node.style.top = `${Math.round(Math.max(margin, Math.min(viewportHeight - margin - card.height, y)))}px`;
  }
}
