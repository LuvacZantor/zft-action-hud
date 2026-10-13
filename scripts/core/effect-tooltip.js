import { renderDescriptionHtml } from './item-preview.js';

const TEMPLATE = 'modules/zft-action-hud/templates/effect-tooltip.hbs';

/** Safe enriched descriptions for Foundry V13's native data-tooltip-html API. */
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

export async function wireEffectTooltips(root, effects, theme, changedIds = null) {
  const entries = new Map(effects.map(e => [e.id, e]));
  const promises = [];
  for (const icon of root.querySelectorAll('[data-hud-effect]')) {
    const effect = entries.get(icon.dataset.hudEffect);
    if (!effect || (changedIds && !changedIds.has(effect.id))) continue;
    promises.push(renderEffectTooltip(effect).then(html => {
      if (!icon.isConnected || !root.isConnected) return;
      icon.dataset.zftDurationLabel = effect.durationLabel || '';
      // Native Foundry tooltip manager handles viewport placement and timing.
      icon.setAttribute('data-tooltip-html', html);
      icon.setAttribute('data-tooltip-class', `zft-hud-effect-tooltip theme-${theme}`);
      icon.setAttribute('data-tooltip-direction', 'UP');
    }));
  }
  await Promise.all(promises);
}
