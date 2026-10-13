/**
 * Foundry UI docking geometry. Keep these calculations independent of RPG systems
 * and of Foundry's game-world documents. All coordinates are viewport CSS pixels.
 */

/** Get bounding rectangles of visible Foundry UI controls, without trusting wrapper sizes. */
export function foundryDockObstacles(doc) {
  const elements = selector => Array.from(doc?.querySelectorAll?.(selector) ?? []);
  const visibleRect = element => {
    if (!element?.getBoundingClientRect) return null;
    const style = doc?.defaultView?.getComputedStyle?.(element);
    if (element.hidden || style?.display === 'none' || style?.visibility === 'hidden') return null;
    const rect = element.getBoundingClientRect();
    if (!rect || ![rect.left, rect.right, rect.top, rect.bottom, rect.width, rect.height].every(Number.isFinite)) return null;
    if (rect.width <= 0 || rect.height <= 0) return null;
    return rect;
  };

  // V13 #controls/#ui-left can be full-viewport containers. A container's
  // bounding box is NOT the usable width of the (possibly two-column) rail.
  const controlRoots = elements('#controls, #ui-left');
  const controlTools = elements(
    '#controls button, #controls [role="button"], #controls .control-tool, #controls .scene-control, '
    + '#controls [data-tool], #controls [data-control], '
    + '#ui-left .control-tool, #ui-left .scene-control, #ui-left [data-tool], #ui-left [data-control]'
  );

  // A navigation wrapper can span the full Foundry viewport. Include its real
  // top-row children, whose compact rectangles represent the visible scene menu.
  const navigation = elements(
    '#navigation, #scene-navigation, #navigation button, #navigation .scene, '
    + '#navigation .scene-name, #navigation .scene-navigation, #navigation [data-scene-id], '
    + '#scene-navigation button, #scene-navigation .scene, #scene-navigation .scene-name'
  );
  return {
    controls: controlRoots.map(visibleRect).filter(Boolean),
    controlTools: controlTools.map(visibleRect).filter(Boolean),
    navigation: navigation.map(visibleRect).filter(Boolean)
  };
}

/** Place the Action HUD below the scene navigation and right of BOTH toolbar columns.
 * Reject full-size wrappers and modal/popout geometry; never infer usable
 * toolbar width from a 100%-height or 100%-width ancestor alone.
 */
export function upperLeftDockPosition({
  width, height, hudWidth, hudHeight, controls, controlTools=[], navigation,
  horizontalGap=32, verticalGap=22
}) {
  const finite = v => Number.isFinite(v) ? v : 0;
  const vw = Math.max(1, finite(width));
  const vh = Math.max(1, finite(height));
  const asRects = value => Array.isArray(value) ? value : (value ? [value] : []);
  const railRects = [...asRects(controls), ...asRects(controlTools)];
  const validRail = railRects.filter(rect => rect &&
    [rect.left, rect.right, rect.width].every(Number.isFinite) &&
    rect.left >= -8 && rect.left <= Math.min(180, vw * .22) &&
    rect.right > 0 && rect.right <= Math.min(240, vw * .3) &&
    rect.width > 0 && rect.width <= Math.min(155, vw * .25));
  // Two-column Foundry rail fallback (~64 CSS px). Do not collapse to column one
  // merely because #controls yields no reliable child bounds.
  const railRight = Math.max(64, ...validRail.map(rect => rect.right));

  const validNav = asRects(navigation).filter(rect => rect &&
    [rect.top, rect.bottom, rect.height, rect.left, rect.right, rect.width].every(Number.isFinite) &&
    rect.top >= -8 && rect.top <= 95 && rect.height > 0 &&
    rect.height <= Math.min(130, vh * .23) &&
    rect.bottom >= rect.top && rect.bottom <= Math.min(140, vh * .24) &&
    rect.width >= 10 && rect.width <= vw &&
    Math.abs(rect.bottom - rect.top - rect.height) < 3);
  const navigationBottom = Math.max(44, ...validNav.map(rect => rect.bottom));

  const x = Math.max(96, railRight + Math.max(12, finite(horizontalGap)));
  // Dock geometry belongs to the HUD, never to transient popover dimensions.
  // The HP manager chooses its own above/below side after the HUD is placed.
  // User-confirmed docking height (dev.51); HP popovers choose their own side.
  // Keep horizontal toolbar alignment unchanged.
  const y = Math.max(66, navigationBottom + Math.max(12, finite(verticalGap))) + 20;
  const maxLeft = Math.max(8, vw - Math.max(0, finite(hudWidth)) - 8);
  const maxTop = Math.max(8, vh - Math.max(0, finite(hudHeight)) - 8);
  return {
    x: Math.round(Math.max(8, Math.min(x, maxLeft))),
    y: Math.round(Math.max(8, Math.min(y, maxTop)))
  };
}
