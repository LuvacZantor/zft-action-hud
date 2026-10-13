/** Game-system-neutral immutable quick-access state helpers. */
export function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(id => typeof id === 'string' && id.length > 0))];
}

export function toggleId(values, id) {
  const current = uniqueIds(values);
  return current.includes(id) ? current.filter(item => item !== id) : [...current, id];
}

/** Add a dragged item before the target; dropping in empty space appends. */
export function placeFavorite(values, movingId, beforeId = null) {
  const current = uniqueIds(values).filter(id => id !== movingId);
  if (typeof movingId !== 'string' || !movingId) return current;
  const index = beforeId === null ? -1 : current.indexOf(beforeId);
  if (index < 0) current.push(movingId);
  else current.splice(index, 0, movingId);
  return current;
}

export function pushRecent(values, id, limit = 10) {
  if (typeof id !== 'string' || !id) return uniqueIds(values).slice(0, limit);
  return [id, ...uniqueIds(values).filter(v => v !== id)].slice(0, limit);
}
