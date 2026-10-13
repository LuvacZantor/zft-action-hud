// Keep Foundry version-specific access and eventual D&D5e API differences here.
// V13 is the live test target. No V14 compatibility claim until separately tested.
export function getActiveActor() {
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length > 1) return null;
  if (controlled.length === 1) return controlled[0]?.actor ?? null;
  return game.user?.character ?? null;
}

export function getActorHealth(actor) {
  const hp = actor?.system?.attributes?.hp;
  const value = Number(hp?.value);
  const max = Number(hp?.max);
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return null;
  return { value, max, percent: Math.max(0, Math.min(100, Math.round(100 * value / max))) };
}

export function getPortrait(actor) {
  return actor?.img || 'icons/svg/mystery-man.svg';
}
