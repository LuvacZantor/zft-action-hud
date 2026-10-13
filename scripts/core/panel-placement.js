/** Viewport-safe vertical placement for RPG-agnostic category panels.
 * Automatic: top-half HUD opens down; bottom-half HUD opens up.
 * Flip only when the chosen side cannot offer a usable panel.
 * Coordinates and limits are physical viewport pixels, independent of theme and RPG.
 */
export function choosePanelPlacement({
  hudTop, hudBottom, viewportHeight,
  gap = 8, margin = 8, minimumUsable = 160, maximumHeight = 480
}) {
  if (![hudTop, hudBottom, viewportHeight].every(Number.isFinite) || viewportHeight <= 0) {
    return { side: 'top', available: 0, maxHeight: 0 };
  }
  const above = Math.max(0, hudTop - gap - margin);
  const below = Math.max(0, viewportHeight - hudBottom - gap - margin);
  const midpoint = (hudTop + hudBottom) / 2;
  let side = midpoint < viewportHeight / 2 ? 'bottom' : 'top';
  if (side === 'top' && above < minimumUsable && below > above) side = 'bottom';
  else if (side === 'bottom' && below < minimumUsable && above > below) side = 'top';
  const available = side === 'top' ? above : below;
  return { side, available, maxHeight: Math.min(Math.max(0, maximumHeight), available) };
}

/** Left-edge aligned by default; use right-edge alignment if left would clip.
 * If neither alignment fits, clamp within the viewport's safe margins.
 */
export function choosePanelHorizontalPlacement({ hudLeft, hudRight, popupWidth, viewportWidth, margin = 8 }) {
  if (![hudLeft, hudRight, popupWidth, viewportWidth].every(Number.isFinite) || viewportWidth <= 0) return margin;
  const safeWidth = Math.max(0, viewportWidth - 2 * margin);
  const width = Math.min(Math.max(0, popupWidth), safeWidth);
  const fits = x => x >= margin && x + width <= viewportWidth - margin;
  const leftAligned = hudLeft;
  const rightAligned = hudRight - width;
  const wanted = fits(leftAligned) ? leftAligned : (fits(rightAligned) ? rightAligned : leftAligned);
  return Math.max(margin, Math.min(wanted, Math.max(margin, viewportWidth - margin - width)));
}
