/** D&D5e active effect presentation and source lookup; mutation is handled by HUD controls. */
export function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.values === 'function') return Array.from(collection.values());
  return Object.values(collection);
}

export function sourceItemId(origin) {
  if (typeof origin !== 'string') return null;
  // Includes Compendium/Actor/Token references ending in Item.ID or Item.ID.ActiveEffect.ID
  return /(?:^|\.)Item\.([^.]+)(?:\.|$)/.exec(origin)?.[1] ?? null;
}

export function effectIsActive(effect) {
  return Boolean(effect) && !effect.disabled && !effect.isSuppressed && !effect.suppressed;
}

export function describeDuration(effect) {
  const duration = effect?.duration ?? {};
  const remaining = duration.remaining;
  const type = duration.type;
  // Native D&D5e/Foundry calculated duration is authoritative when available;
  // no wall-clock calculations from startTime (which may be very old).
  if (type === 'turns' && typeof duration.label === 'string' && duration.label.trim())
    return duration.label;
  if (remaining !== null && remaining !== undefined && Number.isFinite(Number(remaining))) {
    const seconds = Number(remaining);
    if (seconds <= 0) return 'Expired';
    if (type === 'turns' || (duration.rounds != null && Number(duration.rounds) > 0))
      return `${Math.ceil(seconds)} rounds left`;
    const calendar = globalThis.game?.time?.calendar?.days;
    const minute = Number(calendar?.secondsPerMinute) || 60;
    const hour = minute * (Number(calendar?.minutesPerHour) || 60);
    const day = hour * (Number(calendar?.hoursPerDay) || 24);
    // Badge stays compact/rounded, but hover shows useful mixed units.
    // Derived duration comes from Foundry game time; no wall-clock timer.
    const remainingWhole = Math.ceil(seconds);
    if (remainingWhole >= day) {
      const days = Math.floor(remainingWhole / day);
      const hours = Math.floor((remainingWhole - days * day) / hour);
      return `${days}d${hours ? ` ${hours}h` : ''} left`;
    }
    if (remainingWhole >= hour) {
      const hours = Math.floor(remainingWhole / hour);
      const minutes = Math.floor((remainingWhole - hours * hour) / minute);
      return `${hours}h${minutes ? ` ${minutes}m` : ''} left`;
    }
    if (remainingWhole >= minute) return `${Math.ceil(remainingWhole / minute)}m left`;
    return `${remainingWhole}s left`;
  }
  if (Number(duration.rounds) > 0) return `${duration.rounds} rounds (total)`;
  if (Number(duration.seconds) > 0) {
    const totalSeconds = Number(duration.seconds);
    const days = Math.floor(totalSeconds / 86400);
    if (days > 0) return `${days}d (total)`;
    return `${totalSeconds}s (total)`;
  }
  return '';
}

/** Compact remaining duration for an overlay on a 33px icon. Never treat a
 * configured TOTAL duration as time left when Foundry has no remaining value.
 * Calendar lengths come from Foundry where supplied, not from hardcoded days.
 */
export function compactEffectDuration(effect) {
  const duration = effect?.duration ?? {};
  if (duration.remaining !== null && duration.remaining !== undefined &&
      Number.isFinite(Number(duration.remaining)) && Number(duration.remaining) <= 0) return '';
  if (duration.type === 'turns' && typeof duration.label === 'string') {
    // Prefer the system's calculated combat label, particularly when it includes turns.
    const rounds = duration.label.match(/\b(\d+(?:\.\d+)?)\s*rounds?\b/i);
    if (rounds) return `${Math.ceil(Number(rounds[1]))}r`;
    const turns = duration.label.match(/\b(\d+(?:\.\d+)?)\s*turns?\b/i);
    if (turns) return `${Math.ceil(Number(turns[1]))}t`;
  }
  if (duration.remaining === null || duration.remaining === undefined) return '';
  const remaining = Number(duration.remaining);
  if (!Number.isFinite(remaining) || remaining <= 0) return '';
  if (duration.type === 'turns' || (Number(duration.rounds) > 0))
    return `${Math.ceil(remaining)}r`;
  const calendar = globalThis.game?.time?.calendar?.days;
  const minute = Number(calendar?.secondsPerMinute) || 60;
  const hour = minute * (Number(calendar?.minutesPerHour) || 60);
  const day = hour * (Number(calendar?.hoursPerDay) || 24);
  if (remaining >= day) return `${Math.ceil(remaining / day)}d`;
  if (remaining >= hour) return `${Math.ceil(remaining / hour)}h`;
  if (remaining >= minute) return `${Math.ceil(remaining / minute)}m`;
  return `${Math.ceil(remaining)}s`;
}

function plainText(html) {
  return String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ').trim().slice(0, 280);
}

export function getActiveEffects(actor, statusDefinitions = []) {
  if (!actor) return { effects: [], activeItemIds: new Set() };
  const effects = collectionValues(actor.effects);
  const definitions = collectionValues(statusDefinitions);
  const items = [];
  const seenStatuses = new Set();
  const activeItems = new Set();
  for (const effect of effects) {
    if (!effectIsActive(effect)) continue;
    const id = effect.id ?? effect._id;
    const statuses = collectionValues(effect.statuses);
    for (const status of statuses) seenStatuses.add(status);
    const sourceId = sourceItemId(effect.origin);
    if (sourceId && actor.items?.get?.(sourceId)) activeItems.add(sourceId);
    const name = effect.name || effect.label || statuses[0] || 'Active effect';
    const duration = describeDuration(effect);
    const sourceItem = sourceId ? actor.items?.get?.(sourceId) : null;
    const descriptionHtml = String(effect.description || effect.system?.description?.value || sourceItem?.system?.description?.value || '');
    const description = plainText(descriptionHtml);
    const sourceName = String(sourceItem?.name || effect.sourceName || '').trim();
    const tooltip = [name, duration, description].filter(Boolean).join(' • ');
    items.push({
      id: `effect:${id ?? items.length}`, name, img: effect.img || effect.icon || 'icons/svg/aura.svg',
      duration, durationShort: compactEffectDuration(effect),
      durationLabel: duration || (effect.isTemporary ? 'Unlimited' : 'Ongoing'),
      description, descriptionHtml, sourceName, tooltip, sourceItemId: sourceId
    });
  }
  // Status conditions may be present without a dedicated Actor effect entry.
  for (const status of collectionValues(actor.statuses)) {
    if (seenStatuses.has(status)) continue;
    const definition = definitions.find(s => s.id === status);
    const img = definition?.img || definition?.icon;
    // Some modules add informational actor.statuses such as 'thinking' or
    // 'magical', without an Actor effect or a usable condition icon. Those
    // should not appear as mystery aura tiles.
    if (!definition || !img || img === 'icons/svg/aura.svg') continue;
    const name = definition.name || definition.label || status;
    const descriptionHtml = typeof definition.description === 'string' ? definition.description : String(definition.description?.value ?? '');
    items.push({ id: `status:${status}`, name, img, duration: '', durationShort: '', durationLabel: 'Until removed',
      description: plainText(descriptionHtml), descriptionHtml, sourceName: '', tooltip: name, sourceItemId: null });
  }
  return { effects: items, activeItemIds: activeItems };
}
