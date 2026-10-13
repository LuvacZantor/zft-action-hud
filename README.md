# ZFT Action HUD v0.1.0-dev.70

## dev.67 local testing changes

- Fix hotbar drop target compatibility with macro-library and Foundry Directory drag-copy gestures; only slot rearrangement requests move. Layout lock and Actor permissions continue to apply.
- HUD title bar buttons for two floating Macro Directory libraries: Shared (GM-configured world folder) and GM (GM's personal folder). Buttons are hidden if the folder is unconfigured; the GM button is GM-only.
- Read-only, theme-matched macro grids with personal position memory, closed by default, sortable alphabetically or by Foundry Macro sort order, refreshed on Macro/Folder changes. Theme texture checkbox and hotbar scale apply.
- Click permitted macros to execute natively or drag a Macro reference into an unlocked Actor hotbar. No macro copies, no auto-population of Actor slots. Macro permissions remain authoritative.
- Configure source folders in HUD Settings > Hotbar (GM only). Only macros directly in the selected folder are included; nested folder support is deferred.
- IMPORTANT: This code-only merge archive intentionally does not include the six user-uploaded WebP textures. Preserve assets/textures/*.webp from dev.58+ when installing.

## dev.65 local testing changes

- Removed the unnecessary assigned-character fallback toggle: the HUD continues to use the assigned Foundry Player Character when no token is controlled and permission permits. Legacy saved setting is retained but hidden and ignored.
- Item previews now position outside the whole action browser or hotbar, not on top of adjacent action buttons. Side placement is preferred; small screens fall back above/below.
- Foundry Macro documents (world and accessible compendium macros) can be dropped onto an unlocked, Actor-owned hotbar slot, saved in existing profiles, executed natively with permission checks, rearranged and removed. Existing Item slots and their behavior remain unchanged.
- V13 live GM/player verification required.

## dev.64 historical testing changes (dev.65 supersedes the fallback toggle)

- New personal setting **Use Assigned Player Character as Default**: when no token is controlled, show `game.user.character` if the user has access. Default enabled for players, disabled for GMs. Clicking/toggling follows the native current client setting; selecting a token takes priority, and controlling multiple tokens keeps the HUD empty rather than picking an arbitrary Actor. This fallback does **not** select any canvas token.
- Refresh the active HUD when the current Foundry User changes assigned character. Existing Actor ownership rules remain in effect.
- The HUD frame now uses the widest of the primary or lower button rows to determine Action area width. The lower row remains horizontal on normal screen sizes, with a small-screen wrap safety fallback. This dynamically accommodates character categories and the Show Recent toggle without hardcoding a single HUD width.
- No changes to Foundry UI scene navigation layering, custom hotbar profiles, theme assets or native rolls. Live Foundry V13 player/GM tests required, V14 not verified. GitHub unchanged.

## dev.63 native Foundry scene navigation layering

- Foundry V13 native vertical scene navigation stays above the docked HUD when expanded or keyboard focused, independent of Carolingian UI. User confirmed working in live V13. No hotbar geometry changes.

## dev.61 local testing changes

- Replace status-effect native Foundry tooltip with an interactive, body-level read-only popup. Moving from the icon into the popup preserves it, with a short 350ms grace period to cross any border gap. The popup is scrollable and its text/links can be accessed; leaving both the icon and popup closes it. Escape also dismisses it.
- Preserve all seven themes, sanitized HTML, labels and effect removal behavior. Update popup theme without HUD rerender. No new settings or changes to Actor data.
- Does not modify unrelated HUD action/item hover previews. GM/player Foundry V13 tests still required; V14 not live verified. No GitHub writes.
- The dev.61 test ZIP contains source files but not the six user-uploaded WebP textures. Merge onto your existing module folder; do not replace/delete that folder.

## dev.60 local testing changes

- Repair the dev.59 installed-file mismatch that caused `showThemeTextures` to be unregistered: ship a coherent versioned set of module code, including `scripts/core/settings.js`. The setting stays a personal checkbox enabled by default, and existing saved overrides are preserved.
- Newly configured clients start with the custom hotbar visible, docked bottom-center, layout locked and position locked. This prevents accidental editing/dragging; existing preferences are NOT overwritten.
- Move the docked Action HUD down an additional 10px (dock offset now +30px relative to earlier baseline). Floating positions are untouched.
- Current named-theme WebP assets are unchanged; they must remain in `assets/textures/`. No Github writes or production V14 claims.



## dev.59 local testing changes

- HUD palette control cycles to the next personal theme on left-click and previous theme on right-click, wrapping across the seven existing choices (ZFT Default plus six named themes).
- New personal **Show Theme Background Textures** setting (enabled by default) in both Foundry Module Settings and the HUD Appearance tab. When disabled, it suppresses WebP artwork and CSS-generated patterns in the HUD frame, Action Browser and Hotbar without removing theme colors, gradients, or opacity.
- Lower HUD category order is now **Saves, Abilities, Skills, Tools**, followed by Favs, Recent and Hotbar, as requested.
- Uploaded theme artwork is unchanged. Live Foundry V13 test required. GitHub unchanged.

## dev.58 local texture integration

- Six named themes use their corresponding seamless WebP files in `assets/textures/` as subtle repeated overlays behind the existing theme colors. The **ZFT Default** theme remains unchanged (no art overlay). The uploaded filename `royal_saphire.webp` is referenced exactly as stored on GitHub.
- The Action HUD, category browser and custom hotbar share the theme texture. Surface/popup opacity controls still govern texture visibility. CSS pattern fallback remains when WebP is missing.
- Campaign/world theme selection and Follow Campaign are temporarily removed from the interface. Themes are personal-only, including for players; legacy world settings remain registered but hidden for backwards compatibility. Legacy personal `inherit` values resolve to ZFT Default until a named theme is selected.
- No changes to HUD geometry, docking, action execution or saved hotbar profiles. Live Foundry verification pending.

## dev.57 local testing changes

- Favorites and Recent quick-access entries now display in a responsive, full-width CSS grid: three columns on standard-sized HUDs, two when narrower, and one only when necessary. Every item fills its cell, and incomplete final rows retain the same column widths.
- The HUD frame is still sized by primary category buttons only. Quick-access entries cannot extend it horizontally. All item artwork, click/roll workflows, drag-and-drop, and state controls remain unchanged.
- Existing theme textures, Checks/Save names, docking, and hotbar styling remain unchanged. Live Foundry V13 verification pending, V14 unverified; GitHub unchanged.

## dev.56 urgent layout correction

- Fixes the CSS variable scope regression introduced in dev.55, which forced primary category buttons into a single tall column. The primary count now lives at the HUD content level, where both frame width and action-area width can resolve it correctly.
- Keeps Favs/Recent wrapping within the category-driven frame, with small border/padding allowance to prevent unwanted category wrapping.
- Retains all six theme-matched CSS textures and Check/Save labels from dev.55. No changes to native rolls, docking, hotbar logic, or existing settings.
- Foundry V13 live verification pending; GitHub unchanged.

## dev.55 local testing changes

- Adds subtle theme-matched background textures to the Action HUD, browser popup, and custom hotbar. Each existing theme gets its own restrained material feel without changing dimensions or adding settings.
- Favorites and Recent quick-access entries now wrap within the width defined by the main category buttons. The HUD should grow vertically instead of horizontally when the strip fills.
- Ability rows now read `Strength Check`, `Dexterity Check`, etc. Saving-throw rows now read `Strength Save`, `Dexterity Save`, etc., for quicker identification inside those menus.
- Live Foundry V13 verification pending. V14 unverified; GitHub unchanged.

## dev.54 local testing changes

- Theme-driven hotbar frame, subtle ornamental accent, inset/raised slots, softer empty slot wells, improved active profile tab and restrained hover effects. No new configuration or action logic.
- Primary category buttons determine HUD width. Slim controls wrap within that width. Favs, Recent, and a relocated Hotbar show/hide toggle share a quick-access group beneath the category buttons; the old header hotbar toggle is removed.
- Slim buttons default to the selected theme unless an explicit custom button color is saved; the native per-ability colors remain in the menu rows. Hotbar visibility settings remain client-scoped and synchronized with the new toggle.
- V13 GM/player live verification pending. V14 unverified; GitHub unchanged.

**Local dev.53 two-tier categories and ability checks test build** for Foundry V13 Build 351 / D&D5e 5.2.5. No GitHub write or stable release. Foundry live acceptance is pending; V14 not verified.

## dev.53: Two-tier buttons and native Abilities / Saves / Skills

- **Primary row** remains full-size Item category buttons: Weapons, Spells, Features, Consumables, Equipment, Inventory, and Other when present.
- **Secondary row** uses compact label-only buttons with the same configured category widths: Abilities, Saves, Skills, Tools, Favs, and Recent. Recent remains independently hideable by the existing user setting. Button accent customization and Favorites drop target remain intact.
- **Abilities** invokes native `Actor5e.rollAbilityCheck({ability})` and displays Actor-derived ability *check* totals independently of saving throw totals; missing derived values show `—` rather than inventing arithmetic.
- **Saves / Skills** retain live Actor-derived rolls and fixed per-ability icon/colors. Skills include custom registered entries, modifiers and passive scores. They now have their own menu buttons and group persistence.
- **Tools** retains D&D5e Item/use activity workflows, existing Favorite/hotbar support and inventory controls. Tools includes Actor tool proficiencies (even when no matching Item exists) and physical Tool Items in separate sections. Entries use their configured/default ability colors/icons where available, plus Actor-derived modifier when the system provides one and proficiency state. Actor tools roll using native `Actor5e.rollToolCheck({tool})`; Tool Items retain their native activity execution. Tool check dialogs may allow another ability; neutral tags are shown when the ability isn't known.
- **Preserves dev.52 positioning** including confirmed +20px dock offset and per-client existing positions. Local tests do not validate live Foundry V13/V14 runtime behavior.

## dev.52: Docking defaults and native Checks

- **New clients:** HUD and Custom Hotbar start Docked. The first Floating transition starts from each current docked location rather than jumping to a separate default position. Existing saved floating locations and legacy `auto` hotbar preference are retained.
- **Checks:** One Action HUD category with expandable Skills and Saving Throws groups. Skills come from the selected Actor's `system.skills`, including registered custom skills; saves cover its six D&D abilities.
- **Fixed ability colors/icons:** STR crimson fist, DEX emerald footprints, CON orange shield, INT blue brain, WIS teal eye, CHA purple masks. The ability tag and color carry through to each skill.
- **Live values:** Skill modifier and passive score, plus saving-throw modifier, are read from system-calculated Actor fields. Missing derived values display `—`, rather than guessing.
- **Native D&D5e roll:** Calls `Actor5e.rollSkill({skill})` / `Actor5e.rollSavingThrow({ability})`, preserving the system dialog, roll options and module hooks. Checks are not Item actions, do not support Favorites/hotbar drag yet, and do not modify Actor data.
- **Test target:** Foundry V13 Build 351 with D&D5e 5.2.5. V14 not live verified; player ownership and custom-skill registration require live testing.

## dev.51: Stable anchors during live scaling

- **Docked Action HUD:** User-selected vertical docking offset changed to **+20 CSS px**, keeping the existing horizontal toolbar/navigation alignment. HUD scale previews continue to reapply the same upper-left screen-space position; HP manager remains independently positioned.
- **Floating HUD:** Maintains its saved upper-left screen position when scaling; floating lock and previously saved positions are unchanged. Viewport edge clamping remains in effect.
- **Docked hotbar:** Maintains bottom-center alignment while changing scale. It grows/shrinks around its horizontal center and preserves a 12 CSS px bottom gap at ordinary viewport sizes.
- **Floating hotbar:** Maintains the saved upper-left screen coordinates as scale changes, including during the live slider preview. Hotbar position locks are preserved. A floating hotbar without saved coordinates uses a stable in-session fallback anchor rather than tracking its changing width.
- **Cause corrected:** Hotbar positioning previously used the *saved* `hotbarUiScale` while the slider preview used a *new* CSS zoom, making the panel wander before saving. Placement now reads the displayed zoom and avoids intermediate integer rounding.
- **Scope:** No changes to Actor data, hotbar profiles, layout dimensions, integrations, or D&D5e automation. Verify in live Foundry V13 and separately in V14.

## dev.50: Move docked Action HUD down 10 CSS pixels

- **Dock Y adjustment only:** Apply a 10 CSS pixel offset *after* dev.49 calculates the upper-left dock's vertical position from Foundry scene navigation. At the dev.49 reference Y=68 this gives Y=78. Viewport clamping still applies on small screens.
- **Unchanged:** Horizontal dock geometry, HP popup above/below logic, floating coordinates, docking cycle, hotbar position and layout, D&D5e functionality, and all UI behavior outside the dock-Y adjustment.
- **Validation:** Source/syntax checks and local geometry/regression tests; live Foundry V13 GM/player confirmation remains required. V14 is unverified.

## dev.49: Restore preferred upper-left docking height

- **HUD docking vertical position:** Revert the dev.48 popover-driven vertical displacement. Keep dev.47's existing horizontal position and base top calculation (scene navigation plus gap, typically about 70 CSS pixels for the provided reference). Never use HP popup height to place the docked HUD.
- **HP popup independently adapts:** The existing manager decides whether to open above or below based on actual viewport space and its rendered height. When the HUD is near the top and the panel cannot fit above, it opens below. Foundry UI resize/layout changes also re-evaluate an already open panel's side. No extra polling or timers.
- **Unaffected:** Saved floating positions, dock/float/locked state cycling, hotbar docking, D&D5e Actor operations, and item/browser controls.
- **Validation scope:** Local geometry, popup side selection and regression checks. Live Foundry V13 GM/player confirmation still needed; V14 remains unverified.

## Previous dev.48 behavior (superseded)

## dev.48: HP manager clearance for upper-left docking

- **Docked HUD vertical clearance:** Retain the dev.47 measured left toolbar and scene-navigation alignment, but reserve the actual rendered height of the HP management popover above the HUD. It now has room to open **above**, clear of the scene menu, instead of switching below for lack of space.
- **No arbitrary fixed offset:** Measure the existing HP panel while hidden without displaying or interacting with it. Browser viewport and UI scale use real CSS viewport pixels. If there is insufficient screen height, existing placement logic may still open the panel below to avoid clipping.
- **Unaffected:** The horizontal dock, saved floating coordinates, three-state control, bottom-centered hotbar, D&D5e HP update mechanics and Actor data remain unchanged.
- **Verification:** Local geometry and unit checks only. Test the popover's position in Foundry V13 Build 351 / D&D5e 5.2.5; V14 has not been live verified.

## dev.47 corrections (local development test build)

- **Upper-left dock coordinate correction:** Validate the actual navigation rectangle before using its bottom edge. Full-height / transformed Foundry V13 navigation wrappers are ignored, preventing the HUD from being clamped to the lower-left. If a compact scene bar cannot be measured, use the safe 70px upper-left fallback. Consider both `#navigation` and `#scene-navigation` if present, while retaining viewport clamping and existing saved floating coordinates.
- **Two-way position cycling:** Left-click steps Docked → Floating → Floating Locked → Docked. Right-click moves the same button in reverse. Both HUD and hotbar share the same three-state UI helper, keep their independent layout/position locks, and suppress the native context menu on that button only. The button tooltip explains both directions.
- **Validation:** Local syntax and regression checks, including a reproduction fixture with a navigation rectangle extending nearly the full viewport. Foundry V13 GM/player live acceptance remains pending; V14 unverified. No GitHub write or stable release.

## dev.45 corrections (local test build)

- **HUD docking:** Root ApplicationV2 element is attached directly to `document.body` before viewport coordinates are calculated. This avoids Foundry V13 interface layer transforms/positioning trapping the fixed element near the bottom-left. Dock uses screen-relative upper-left bounds, not stored floating coordinates. Must be verified live in V13.
- **One unified position button:** Both the main HUD and the hotbar cycle Docked (anchor) → Floating (move) → Floating Locked (lock) → Docked, with the state conveyed by icon and tooltip. Hotbar Layout Lock is still separate. Existing per-client dock and position settings are preserved.
- **Equipment:** The style that forced attunable equipment to one column now uses a two-column grid, including item-state and Favorite controls.
- **Testing:** Local syntax/state/docking checks only. A real Foundry V13 GM/player client must confirm docking, including different window sizes and modules.

## Prior dev.44 corrections (historical test build)

## dev.44 corrections (local test build)

- **Upper-left docking:** Removed an inherited bottom-left CSS fallback. The docked HUD now uses authoritative viewport-aware top/left CSS anchors even if Foundry's ApplicationV2 updates window positioning later; float coordinates and locks are unaffected.
- **Entire Item card hit area:** Clicking empty parts of an Item card invokes that Item, and right-clicking anywhere on its primary area inspects it. Equip, Attune and Favorite remain separate controls. Hover preview is attached to the full Item card; keyboard focus styling is preserved without requiring Tab-key testing.
- **Foundry keyboard controls:** ZFT does not intercept or repurpose Tab. Use mouse/pointer testing instead; Foundry's Tab cycling remains untouched.
- **Effect tooltip precision:** Hover duration includes hours plus minutes (or days plus hours) where applicable, sourced from native Foundry effect remaining time. Compact icon badges keep one unit. Duration refreshes remain event-driven; only effect tooltips whose precise label changes are updated.
- **Validation:** Local static/regression checks only. Live Foundry V13, GM/player, theme/UI-scale, Midi-QOL and CPR verification remain required.

## Prior dev.43 development notes

**Local dev.43 corrective test build** for Foundry V13 Build 351 / D&D5e 5.2.5. No GitHub write or stable release. Foundry live acceptance is pending; V14 not verified.

## dev.43 corrections (local test build)

- **Responsive upper-left dock:** Uses visible Foundry left controls and scene navigation bounds; stays beneath scene navigation and to the right of the tool rail, clamped to viewport. Docking now ignores stale docked pixel coordinates left by previous builds. Repositions when UI controls or viewport size change. Independent saved floating positions are preserved.
- **Docking/lock controls:** Action HUD and independent hotbar use the same Anchor when docked and four-way Move arrows when floating; both use Lock/Unlock for floating position. Docking disables the position-lock button without erasing its preference. Hotbar's separate layout lock remains distinct.
- **Item right-click focus:** Suppress the partial inner-button outline caused by context-click; make keyboard focus outline surround the complete Item card. Equip/Attune/Favorite buttons retain keyboard-visible focus.
- **Calculated Roll values:** D&D5e Activity hover preview shows native computed Roll modifier (e.g. +8) from Activity sheet context, or Save Ability / DC where available. Never re-derive proficiency or item bonuses in the HUD core. If the native total is unavailable, the preview labels raw bonus as *additional*, not a total.
- **Validation:** Local syntax and simulation/fixture checks only. Live GM/player, 1080p/1440p/4K and Midi-QOL/CPR testing remain necessary.

## Prior dev.42 development notes

**Local dev.42 corrective test build** for Foundry V13 Build 351 / D&D5e 5.2.5. GitHub `develop` is unchanged. Live validation is pending; V14 is unverified. No stable release has been published.

## dev.42 corrections (local test build)

- **Upper-left dock:** HUD docks next to Foundry's left canvas controls at top-left, not to the right sidebar. Existing saved floating positions and user-selected dock mode are preserved. The dock button and settings labels now say **Upper Left**.
- **Floating movement lock:** A separate lock button beside Dock/Float (and a client setting) prevents dragging while floating, independent of the docking mode and hotbar locks.
- **Item focus border:** The contextual selection outline wraps the full item card, not only the action button; relevant for Equipment and Inventory entries with Equip/Attune/Favorite controls.
- **Bard/Warlock Pact Magic:** Native `system.method='pact'` spells are classified into the **Pact Magic** group; pact cantrips remain Cantrips. The Pact resource shields continue to use `Actor.system.spells.pact.value` and its system-derived maximum.
- **Unprepared spells:** Level 1–9 spells with `system.prepared=0` remain visible, with an **Unprepared** label. This restores entries like **Heal (6th level)** for the supplied Nox Wishwater Bard 11 / Warlock 1. Casting continues through native D&D5e Item.use(), without bypassing rule/automation checks.
- **Validation:** Local source and fixture tests only; live Foundry, Midi-QOL, and CPR verification is still required.

## Prior development notes

## dev.41 development changes (local test build)

- **Hotbar docking:** First-time clients place the independent hotbar at bottom center. A pin/undock header toggle and client module setting switch between bottom-center docking and free positioning. Existing saved dev.40 floating coordinates remain floating until manually docked. Hotbar layout and position locks remain separate.
- **Action HUD docking:** New clients start anchored at the upper-right next to Foundry V13's sidebar. The HUD's position control toggles between upper-right dock and floating; a previously stored locked coordinate remains at its earlier location. Floating positions persist. Sidebar width and viewport resize are respected.
- **Sheet-style spell slots:** Removes the separate spell-slot strip and places clickable available/spent shields on native spell-level group headings (and Pact Magic). One shield per slot; click an available one to expend, a spent one to restore. Uses the dev.40 native Actor update adapter; no duplicate slot pool in core.
- **Initial group defaults:** Weapons, Consumables, Equipment, Tools, Inventory (and fallback other categories) start expanded; Spells and Features start collapsed. Per-client Actor/category/group saved overrides win. Show Unequipped Weapons is false by default for clients without a saved preference.
- **Equipped and attuned controls:** Applicable inventory Items have separate equip/unequip and attune/unattune icons, updating native D&D5e `system.equipped`/`system.attuned` fields through the D&D5e adapter. Attunement checks current/max slots, Actor and Item ownership. The core only renders generic item-state controls and delegates changes to the adapter.
- **Validation:** Static syntax and pure adapter regression tests run locally. Live V13 GM/player, D&D5e 5.2.5, Midi-QOL/CPR and UI testing are **not** yet confirmed. Foundry V14/D&D5e 6.x remains unverified. No GitHub writes or stable release.

## Prior development notes

## Prior dev.40 development changes (historical test build)

- **Show Search:** A checkbox appears in each category browser filter row beside **Show Unequipped** when applicable. It shows/hides the search input across categories and retains the preference for that client across refreshes and reconnects. Turning search off clears any active search text rather than leaving an invisible filter.
- **Remember expanded groups:** Category subgroup open/collapsed state is stored in a per-client Foundry setting, organized by Actor UUID, category, and group. Manual group toggles and Expand All / Collapse All are persisted across browser refreshes and re-logins. Searches can temporarily expand matching groups without overwriting manually saved expansion preferences.
- **Spell slots:** The D&D5e Spells browser displays existing level 1–9 and Pact Magic slot pools when their current maximum is positive. Each pool shows remaining/maximum and offers **minus** (expend one) / **plus** (restore one), bounded by zero and the system maximum. Only Actor owners may adjust. Changes update the same native `actor.system.spells.<slot>.value` used by the D&D5e character sheet; casting and other native Actor updates refresh the display.
- **Architecture:** Spell-slot data and writes live exclusively in `scripts/adapters/dnd5e-spell-slots.js`. The HUD core presents generic adapter-provided category resource sections, with no D&D5e slot schema or game-system math in the core. No extra dependencies or Actor flags.
- **Testing status:** Static validation and adapter unit tests do not establish live Foundry acceptance. Primary target is Foundry V13 Build 351 with D&D5e 5.2.5; V14/D&D5e 6.x requires separate testing. No stable release or GitHub update is included.
- **Still outstanding:** Skills, saves, Foundry macros, other resource tracking, GM controls, the broader hotbar regression backlog and the existing cleanup/reset recovery concern. See [ROADMAP.md on develop](https://github.com/LuvacZantor/zft-action-hud/blob/develop/ROADMAP.md). Backup/restore was **not** implemented in dev.40.

## Current development status and remaining work

- **Source checkpoint:** `0.1.0-dev.39` remains on GitHub `develop`; this package is the local `0.1.0-dev.53` test build, not an accepted stable release.
- **Implemented in source, live acceptance pending:** independent floating HUD and 20×20 hotbar, Actor-stored profiles, colored profile tabs and slots, named visual divider labels, drag/drop editing, separate locks and scaling, and optional combat-profile switching. These features still need targeted Foundry V13 GM/player testing.
- **Not yet complete:** full Skills/Saving Throws/Foundry Macro access, live resource and action-economy indicators, persistent GM macro controls, optional pinned character, compatibility and performance validation.
- **Maintenance safety:** dev.39 offers Cleanup/Reset and attempts a JSON snapshot download, but no Restore command exists and a saved file is not guaranteed. Avoid destructive resets on production Actors until a practical recovery method is proven.
- **Next development work:** dev.40 UI/slot-management and dev.41 docking, shields, and item-state controls are present in this local test build. Broader work remains in the [ROADMAP](https://github.com/LuvacZantor/zft-action-hud/blob/develop/ROADMAP.md); backup/restore is **not** assumed to be a standalone feature.

## Prior dev.39: hue spectrum, maintenance, and category controls

- The color picker source includes a **full vertical rainbow hue spectrum** behind a transparent slider track. Confirm the result visually in live Foundry V13; HEX, square and preview behavior require regression testing.
- Action-browser group controls explicitly display **Expand All first, then Collapse All**. The template already had this DOM order; CSS now reinforces it across theme changes.
- HUD Settings → Advanced → **Maintenance · Hotbar Data** offers current-character cleanup/reset. GMs also get All Characters options for **world-directory `character` Actors only** (NPCs and scene/unlinked tokens excluded).
- Cleanup removes **empty** legacy Default profiles and obsolete legacy hotbar flag copies only when a complete modern profile state already exists; populated Default profiles are preserved. Reset rebuilds three empty built-ins (Combat, Exploration, Support), removes custom/legacy hotbar data but preserves Favorites/Recent and client appearance settings.
- Operations preview affected Actor counts and require confirmation. The code **attempts** a browser-based JSON snapshot download before writing but cannot verify a file was saved. Reset requires an additional confirmation. Each Actor updates independently and failures are reported. **There is no built-in restore/import function.**
- This is a V13 **test build**. Foundry GM/player live validation is still needed before stable promotion.

## Dev.38: matching panels, active-profile hotbar accents and named dividers

- Opening a category browser gives its panel border, header, group indicators, and hover highlights the **same accent as its category button**, including client HEX overrides and the seven D&D5e defaults. The rest of the panel still follows the HUD theme; Item art and native actions remain unchanged.
- The expanded **Favorites** and **Recent** quick-access strip uses its selector's default/custom color for borders and hover states. The associated actions are never tinted, replaced or reclassified.
- The independent hotbar uses the **active profile** accent for the outer border, header, divider lines and drop targets: Combat red, Exploration green, Support blue, or custom profile/theme inheritance. Color updates on profile changes, custom HEX edits, and theme switching; explicit slot color overrides still win on slots.
- Divider labels are **optional**, preserved per Actor/profile as `dividerLabels.columns` and `dividerLabels.rows`. Unlock the hotbar, click **Dividers**, then **right-click an existing × divider marker** above a column or to the left of a row to enter a label (up to 32 characters), or Clear it. Column names display in a slim strip above the grid; row names appear in the divider gap. Unnamed dividers look as before. Labeling does not add/remove slots, create collapsible groups, or change assignments.
- Dragging a named divider carries its label; deleting it removes that name. Duplicating a profile copies its labels, creating a new empty profile starts without names, and older Actor flags migrate without changing their existing layouts.

### Focused dev.38 testing (Foundry V13)

- [ ] Open Weapons, Spells and Features. Confirm each popup inherits its category button color and preserves the active HUD theme background; change a color, reopen the popup, reset, and repeat after switching themes.
- [ ] Open Favorites and Recent. Confirm their gold/blue or manually selected accent decorates the correct expanded strip, without changing Item artwork or Favorite/Recent behavior.
- [ ] Switch Combat / Exploration / Support / a custom profile. Confirm the hotbar header, border and divider accents follow the selected profile instantly while individually customized slots retain their colors.
- [ ] Unlock layout, open Dividers, add a vertical and a horizontal divider. Right-click the **×** markers and set different labels; verify their placement above columns and between rows. Test Clear and cancellation with Escape.
- [ ] Drag each named divider to another boundary; check that its label follows. Remove one divider and confirm its name disappears. Duplicate a profile and confirm its labels/slots/dividers are copied independently.
- [ ] Resize the grid live, change scale and theme, lock/unlock position and layout, minimize and restore, rapidly switch profiles, reload, and confirm all existing action assignments and labels persist.
- [ ] Verify GM and player Actor permissions, native Item/Activity execution and installed Midi-QOL/CPR behavior in the live V13 environment.

## Historical build notes

The sections below document previous iterations. Earlier defaults and provisional behavior may have changed in later builds; use the current dev.45 section and packaged source as authoritative. For example, the dev.35 description of an off-by-default combat-profile option was superseded by the subsequent on-by-default behavior.

## Prior dev.37 documentation

Local **V13-first** development build targeting **Foundry V13 Build 351 / D&D5e 5.2.5**. V14 migration considerations remain part of the architecture, but **V14 has not been live tested**. Not a production release.

## Dev.37: profile management, default category colors and shared HSV picker

- All **nine actual HUD buttons** receive ZFT default accents: Weapons red, Spells purple, Features teal, Consumables green, Equipment steel, Tools amber, Inventory tan, Favorites gold and Recent blue. Their color is a subtle tint/border/icon, not a solid fill. An explicit client-specific override persists through theme changes. Right-click each button for **Customize Color**, or **Reset Color** after an override.
- Favorites and Recent selectors are color-customizable like the seven RPG category buttons. Individual Favorite/Recent action artwork is preserved; they are **not** recolored by their selector accents.
- The shared color picker now uses a **Photoshop-like HSV square (saturation/brightness)**, vertical hue slider, HEX field, native picker and live preview. Cancel/Escape/outside-click undo previews; Apply saves; Reset returns to the relevant default. Context menus no longer have a redundant title heading.
- Hotbar slot color overrides still belong to the current Actor profile and Reset to Theme remains independent of the nine HUD category defaults. Settings **Reset All Button Colors** clears overrides for HUD categories, Favorites, Recent and Actor hotbar slots after confirmation.
- Hotbar built-in profiles **Combat, Exploration and Support** remain fixed, permanently visible on the far left, with default red (`#D9666B`), green (`#57BF85`) and blue (`#5BADE5`) tab accents. Custom profiles scroll to the right, inherit current theme accent unless overridden, and can be reordered by drag/drop or Move Left/Right context commands.
- Right-click **any** profile tab for direct Customize Color, Edit Profile, Duplicate and (when overridden) Reset Color. Custom profiles additionally allow Rename, Move and Delete. Built-in names cannot be renamed or deleted. Delete requires confirmation. The Edit Profile popup provides custom name editing, color actions, duplicate and permitted delete.
- Actor flag profile migration and Item assignments are preserved. Default Combat auto-switch continues unchanged and enabled by default. V14 remains unverified.

### Focused dev.37 Foundry V13 tests

- [ ] Verify the nine default button colors in ZFT Default and two contrasting themes; theme backgrounds and action functionality remain intact.
- [ ] Customize Weapons, Favorites and Recent independently; change themes, reload, and reset each. Confirm the original category-specific defaults return, not a single theme color.
- [ ] Test HSV square, hue slider, HEX value, Apply, Cancel, Escape, Reset, and previews on both HUD and hotbar slots.
- [ ] Confirm Combat/Exploration/Support stay visible in the left group, cannot be renamed/deleted/moved, and can have color overridden and reset.
- [ ] Create custom profiles; reorder by drag/drop and context Move Left/Right. Verify assignments and active profile are unchanged by ordering and persist after reload.
- [ ] Right-click any profile for Edit Profile/Duplicate/Customize Color; test deletion confirmation and per-Actor color persistence.
- [ ] Test auto Combat entry/exit, manual profile override, rapid switches, locks, collapsed hotbar, character switching, 7 themes and browser state persistence.
- [ ] GM vs player and Actor ownership/permissions, plus no Item/Midi-QOL/CPR workflow regressions.

## Dev.35: persistent panels, improved browser/profile workflow and formulas

- Open action browsers, HP controls and external Scale controls remain visible when focus moves to the canvas or another Foundry window. Use their close controls or Escape to dismiss; changing characters and hiding/minimizing the main HUD still follow existing cleanup rules.
- Action browser headers now offer **Expand All** and **Collapse All**. These affect visible groups in the selected category and preserve browser search and scroll state.
- Right-click a profile tab for a small context menu with **Rename**. Profile switching is immediate on left-click, without the previous 240 ms double-click wait. Profile flag saves are queued/coalesced to prevent old clicks from overwriting newer choices; remote profile changes still refresh the bar.
- The D&D5e Activity summary resolves Actor roll-data references and safe numeric helpers such as `max()` in damage, healing, attack bonus and save DC expressions. **It does not roll dice**. Unresolvable references remain explicit rather than being guessed.
- **Auto-switch to Combat profile** is a new per-client, off-by-default setting in HUD Settings > Hotbar and Foundry Module Settings. An owned participating Actor with a profile named **Combat** switches on combat entry and restores the previous profile on exit, except after a manual profile change during combat. There is no new combat automation or action-economy tracker.
- All new system formulas live in the internal D&D5e adapter; presentation remains RPG-neutral. Live Foundry V13 tests are required before production promotion.

### Focused dev.35 tests

- [ ] With an action category, HP panel and Scale panel open, click the canvas; all three remain open. Drag the main HUD and verify they follow it. Dismiss via their controls/Escape.
- [ ] Open Spells or Weapons and exercise Expand All/Collapse All with and without search text. Confirm expanded groups survive a HUD refresh.
- [ ] Right-click a profile tab and select Rename while Layout Lock is on. Left-click another tab; switching should not pause for double-click recognition. Click multiple tabs quickly and reload to verify the latest selected profile persists.
- [ ] Verify the Shillelagh Quarterstaff Activity summary replaces `max(@abilities.str.mod, @attributes.spell.mod)` with an Actor-specific numeric modifier while leaving `1d12` unchanged.
- [ ] Enable Auto-switch to Combat profile for an Actor that has a Combat profile; start combat, switch manually, then end combat. Verify the manual selection is respected. Test the default-off behavior separately.

## Dev.31: Actor profiles and compact scale controls

- On first loading an **owned Actor** with the custom hotbar visible, dev.31 migrates the old hotbar assignments, dividers, and client grid dimensions to a `Default` profile in `flags.zft-action-hud.hotbarProfiles`. Legacy Actor slot/divider flags are left untouched for rollback. Actor export/import carries the new profile collection with its Item references.
- The compact **profile selector** remains available in the hotbar header even when the hotbar layout is locked. Choosing a profile changes its actions, dividers, row/column dimensions, without moving/resizing the hotbar window itself.
- Unlock Layout and click **Profiles** to open the editor: **New**, **Duplicate**, **Rename**, or **Delete**. Delete asks for confirmation, never removes the final profile, and cannot be used by an Actor observer. Maximum 15 profiles per Actor, including 3 protected built-in profiles.
- **Rows and Columns** in both the hotbar editor and the floating HUD Settings window now save to the **active Actor profile** (not the browser). The old Foundry Module Settings row/column options are hidden but retained internally as migration defaults. Hotbar scale, position, visibility, labels, and both locks stay client preferences.
- The separate **Scale** icon moved beside **Dividers** on the unlocked editing row. Its external screen-space popover has a single slim line with title, slider, percent and close control, unaffected by the hotbar's zoom.
- Automatic combat-triggered profile switching is **not** implemented yet; profile selection is manual in dev.31.

### Focused dev.31 tests (Foundry V13)

- [ ] Load an Actor whose hotbar has Items, dividers, and a non-default grid size: verify the `Default` profile retains all three, including invisible assigned slots.
- [ ] Create an empty Combat profile; assign an Item, add a divider, change grid size, then switch back to Default and verify nothing moved or disappeared.
- [ ] Duplicate Combat; change the copy and ensure the original remains unchanged. Rename a profile, delete a non-final profile, and verify the final remaining profile cannot be deleted.
- [ ] Lock the layout and switch profiles using the always-accessible header selector. Unlock again and confirm editing controls return.
- [ ] Test from a second browser using the same Actor. Confirm profiles travel with the Actor; floating coordinates and scale remain specific to that browser.
- [ ] Confirm the Scale popover is shorter, remains stationary during live zoom, and is beside Dividers rather than the position/layout locks.

## What's changed in dev.12

- **Show Action HUD** (client-specific) is available in both the floating HUD Settings window and Foundry **Configure Settings → Module Settings → ZFT Action HUD**. Both controls edit the exact same saved `enabled` setting.
- Unchecking it hides the HUD and closes its settings/preview browser. You can re-enable it from **Module Settings** even while the HUD is hidden. Favorites, Recents, position, and appearance are preserved.
- **HUD Position: Locked / Unlocked (draggable)** is now also available in Foundry Module Settings, and stays synchronized with the existing lock/unlock controls and saved on-screen position.
- Other persistent appearance, theme, and Recent controls use the same stored settings in both interfaces. Favorites/Recent open buttons are navigation actions, not persistent options.
- Existing spell grouping and source Item behavior from dev.11 is unchanged.

## Prior changes from dev.11

- **Unprepared spells no longer appear** in the Spells browser, including the old Unprepared Spells group. Special casting methods (At-Will, Innate, Ritual-Only) are kept because they are not ordinary slot-preparation choices.
- **Item Spellcasting group removed**. Cast Activities attached to consumables/equipment/other Items are used by activating the parent Item in its normal HUD category (Equipment, Consumables, etc.). This avoids duplicate ways to cast the same spell.
- **Feature Spellcasting stays** for explicitly granted Cast Activities on features.
- Previously saved Favorites and Recent shortcuts targeting an **item-based** Cast Activity or a cached spell migrate in memory to the **parent Item**. Normal and feature casting shortcuts remain unchanged. Saved IDs are normalized the next time the user edits their Favorites or Recent entries.
- No change to D&D5e's native Item and Activity execution, remaining-use display, At-Will/Innate/Ritual grouping, core HUD UI, or theme/settings logic.

## Dev.27 live resizing, independent position lock, and 20 columns

- Drag the bottom-right resize corner to see action slots and the dimensions (`columns × rows`) update **during the drag**. Release once to save the new row/column settings; cancelling the gesture restores the original grid.
- Maximum grid: **20 columns × 20 rows = 400 fixed slots**. Reducing visible size never deletes Actor-stored assignments, including old items in hidden slots.
- **Lock Layout** prevents slot editing and grid resizing; **Lock Position** prevents movement. The hotbar retains separate, always-visible controls for both locks, and both settings also appear in the ZFT HUD Settings window and Foundry Module Settings.
- The hotbar stays free-floating and independent of the main HUD, and uses the existing theme and button dimensions with an independent hotbar scale. Resizing updates only necessary slot elements; it does not save settings during pointer motion.

## Dev.26 independent hotbar and lock recovery

- The custom hotbar is **always a separate floating window**. Docking and the Docked/Floating setting are removed. Any previously saved floating coordinates remain in use.
- The hotbar retains a compact drag grip and lock/unlock control, **even when its item layout is locked**. Drag the header to move it when Position Lock is off; click the lock to re-enable row/column editing and assignment.
- Layout Lock protects Item slots from changes; only Position Lock freezes the window position. The HUD Settings panel remains a second way to unlock.
- If dev.25 left the bar locked, use the main HUD gear > Custom Hotbar > uncheck Lock Hotbar Layout, or use the new padlock directly on the hotbar in dev.26.

## Install into V13 Dev world

1. Extract this ZIP into your V13 `Data/modules/` directory, **replacing** the old `zft-action-hud/` folder; don't nest folders.
2. Confirm `Data/modules/zft-action-hud/module.json` reports `0.1.0-dev.45`.
3. Refresh the V13 Dev world browser using **Ctrl+F5**. Normally no server restart is needed for a client module update; restart Foundry if it still sees the old manifest.
4. Keep the previous working ZIP as a rollback option. Do not install this development build in production.

## Focused tests for dev.23

- [ ] While Temporary HP is +190, enter `10` and click the blue shield. Both HUD and Actor sheet should show 10, not 190.
- [ ] Enter `200` and click the shield to raise Temporary HP to 200.
- [ ] Enter `0` and click the shield to clear Temporary HP; the blue readout should disappear.
- [ ] Damage/Heal still require positive amounts and damage still consumes Temporary HP before normal HP. HP permissions and Set to Zero confirmation remain unchanged.
- [ ] Confirm Temporary HP updates preserve open spell/category browser state.

## Dev.23 manual Temporary HP correction

- The blue shield **sets** Temporary HP to the entered amount, including a smaller amount or zero. This is an explicit GM/player-authorized manual adjustment, not the D&D5e "gain Temporary HP" rule. Use native item/spell automation for that rule.
- `0` is permitted for the shield action only. The icon hover identifies it as **Set Temporary HP**. Damage and Heal still require amounts of 1 or greater.
- No other HP action behavior or compact HUD layout changed.

## Focused tests for dev.22

- [ ] Click the HUD HP bar to open a single compact ~278 px HP manager with normal HP numbers, a thin red health bar, and the exact blue Temporary HP value (if any).
- [ ] Verify action order: skull / minus / white Amount field / plus / heart / blue shield. Only icons are visible; mouse hover and accessible labels identify each action.
- [ ] The white Amount field has dark text across all seven HUD themes. Modify Amount, then test damage, heal, and setting Temporary HP with the rightmost shield button.
- [ ] Verify Temporary HP at +190 or +200 is shown exactly, not proportionally. The popup Temp HP readout disappears at zero, but the grant button remains.
- [ ] Confirm damage depletes Temporary HP first, healing caps at max (including tempmax), and Zero requires confirmation. Native Actor permissions stay enforced.
- [ ] Advance combat or modify HP while a spell browser is open; search, expanded groups and scroll remain unchanged.
- [ ] Check popup placement at the left/right and top/bottom viewport edges, and with HUD scale changed. GM and owner should be able to edit; observer-only cannot.

## Focused tests for dev.20

- [ ] On a bright and a dark Active Effect icon, check that remaining-time text sits in a small black translucent badge. Untimed effects should have no badge.
- [ ] Open the HP popup in different themes: the amount input and action buttons should be centered inside a narrower panel; the footer should show N Temp HP.
- [ ] Double-click the portrait to open the native Actor sheet; double-click again while it is open to bring it to the front. Single-click must not open a sheet.
- [ ] Test with a player who can view the Actor and one who cannot; sheet permission should follow Foundry ownership.
- [ ] Check HP beside the portrait, with and without large Temporary HP values. Red bar and +N shield should remain readable.
- [ ] Confirm effect updates and HP adjustments preserve expanded category groups and browser scroll.

## Earlier focused tests for dev.19

- [ ] Hover an effect with time remaining and check the small icon overlay (`8h`, `3m`, `2r` where applicable). Its full native rich tooltip should remain available.
- [ ] Advance combat turns or world time. The overlay should update when the rounded display changes, without closing an expanded spell or weapon group.
- [ ] Confirm untimed and indefinite effects have **no** misleading countdown badge.
- [ ] Give a character 17 Temporary HP. Verify `+17` appears in a blue shield beside normal HP and **no** proportional blue bar appears.
- [ ] Give a test character 100 or 200 Temporary HP. Verify the exact number is visible even when larger than their maximum normal HP.
- [ ] Spend Temporary HP with manual damage. It should decrease to zero, then the blue shield should disappear entirely. Normal HP should remain a red proportional bar.
- [ ] Regression: Inspiration, Favorites, right-click effect removal, HP adjustment, seven themes, and category expansion persistence.

## Earlier focused tests (dev.12)

- [ ] Toggle **Show Action HUD** off inside its floating Settings window; confirm both HUD and settings window disappear.
- [ ] Open Configure Settings → Module Settings → ZFT Action HUD. Confirm **Show Action HUD** is off; check it and save. HUD should reappear with preserved Favorites and position, without reloading.
- [ ] Disable and re-enable from Module Settings itself. Confirm the toggle affects **only this client**, not other players.
- [ ] Test **HUD Position** in Module Settings and Lock/Unlock in the HUD window in either order; switching modes must not move the bar. Confirm the mode survives refresh.
- [ ] Verify the other persistent settings appear in both places and control the same preferences; GM-only world theme controls remain restricted to the GM.
- [ ] Regression: spell grouping, item execution, Favorites, Recent, hover previews and themes.

## Prior focused tests for dev.11

- [ ] With Athak selected, open Spells: confirm Cantrips, At-Will, Innate Spellcasting, Ritual-Only, ordinary **prepared** spell levels and Feature Spellcasting appear.
- [ ] Confirm **neither Unprepared Spells nor Item Spellcasting** appears, and their actions do not inflate the Spells button count.
- [ ] Find Necklace of Prayer Beads in its regular inventory category and use its native Item flow to select a casting; check D&D5e and Midi-QOL resource behavior in V13 Dev.
- [ ] Confirm the two feature Cast Activity shortcuts remain under Feature Spellcasting and execute from their native source Activities.
- [ ] If an item Cast Activity was previously pinned in Favorites, confirm it points to the parent Item instead of disappearing; refresh and verify access to that Item.
- [ ] Regression: category search, Favorite/Recent reordering, right-click inspection, hover previews, all seven themes, settings, opacity and HUD positioning.

## Known limits and behavior

- The new Activity pathway calls D&D5e 5.2.x's native `activity.use()` and relies on Foundry to enforce can-use requirements, charge consumption, dialogs and installed automation. **This code has been tested locally using representative models, not in a live Foundry world.**
- An imported `system.method = "atwill"` may still have limited numeric uses. The HUD does not override source documents or decide unlimited casts based on labels.
- Spell grant provenance is not inferred from names or importer-specific descriptions. A normally prepared spell gained from a class feature remains grouped by spell level; only an actual Cast Activity (or method) changes its casting group.
- A feature Cast Activity with no matching cached spell can still appear, using its Activity name or a fallback; its hover description may be limited until the source data provides one.
- Recent actions, appearance, HUD and settings-window positions remain client-specific. Favorites and Custom Hotbar assignments are stored on the Actor and travel with ordinary Actor exports/imports (but are not automatically synchronized across different servers).
- Existing presentation and interaction logic remains RPG-independent. All D&D5e-specific classification and casting logic is internal to the D&D5e adapter.
- V14 and additional RPG adapters remain unverified.
- Historical dev.37 note: that earlier build was a local test artifact, not a stable release. This statement does not describe the current dev.45 package.

Roadmap: https://github.com/LuvacZantor/zft-action-hud/blob/develop/ROADMAP.md

### Dev.13 additions

- Show/hide unequipped inventory separately for Weapons, Equipment, Consumables, Tools, and Containers. Matching checkboxes are available in each applicable action browser and in both settings interfaces. Settings apply to both PCs and NPCs. No Actor inventory changes.
- Show Uncharged Items controls only reliably detected exhausted inventory resources; ambiguous or alternative Activity casting remains visible. All visibility preferences default to shown to preserve existing HUD behavior.
- Optionally collapsed Active Effects strip displays existing Actor effects/statuses and duration metadata when supplied by Foundry. It does **not** apply, remove, or toggle effects.
- Indicators on Item actions whose source Item ID matches an active Actor effect origin; not a universal cast-state indicator.
- Separate Client Debug Logging and GM Debug Logging (World) settings. Logs stay in each local browser console; errors remain visible regardless.
- Foundry 13/D&D5e 5.2.5 remains the development target; native API integration requires in-world testing.

### Dev.14 preview and effects updates

- Item hover previews retain sanitized Foundry description HTML: headings, lists, and tables, including wide compendium tables that scroll within the preview.
- Active Effects strip omits orphaned, unidentified status identifiers without a usable status icon (e.g. Thinking/Magical).
- Right-click an actual Active Effect to confirm removal of its embedded Actor effect. A status-only configured condition uses D&D5e's `toggleStatusEffect` API instead. Actor owner permissions are required; automation can reapply effects.

### Dev.15 starter themes

- Five additional themes alongside the original ZFT Default and Gothic Arcane: Midnight Steel, Emerald Grove, Royal Sapphire, Crimson Ember, and Sunlit Parchment.
- All seven are available to GMs through Campaign Theme and (when the GM permits overrides) to players through Personal Theme. The quick palette button also cycles through all themes and Follow Campaign.
- Theme settings use a single ordered registry shared by both the floating HUD Settings window and Foundry Module Settings; theme selection changes neither underlying Actor data nor HUD geometry.
- Theme colors are applied to HUD, category browser, independent settings window, and rich hover preview. All existing theme IDs are preserved; existing saved themes remain valid.
- Verify contrast and appearance of Sunlit Parchment in the live Foundry V13 test environment, along with right-click effect removal and formatted hover tables from dev.14.

### Dev.16 tooltip improvements

- Active Effects use Foundry V13 native `data-tooltip-html` tooltips, enriched and sanitized for formatted descriptions, with effect name, duration, source and removal instructions. The HUD continues to handle right-click removal.
- Item preview now displays adapter-supplied Activity summaries above the enriched description: activation, range, stored damage and healing dice, saving throws, configured Activity uses/costs, and versatile weapon dice when supplied.
- Items with several Activities show up to four in transient hover; middle-click to pin shows all Activities with scrolling. No independent Activity action buttons are created.
- Damage previews intentionally show source dice/formulas, **not a guaranteed final damage roll**. Character choices, attack ability, item roll data, Midi-QOL, CPR, and other conditional bonuses remain authoritative at roll time.
- Native rich effect tooltips use all seven ZFT theme palettes. Tested locally against V13-style data; actual Foundry V13 and V14 live behavior remain unverified.

### dev.17: Persistent categories and manual HP controls

- Expanded groups, per-category searches and scroll positions are retained across HUD refreshes. HP-only, combat-time and effect duration updates no longer force full browser rerenders.
- The compact Active Effects dock appears above the main HUD, and follows the HUD when moved or resized.
- The current Actor's HP bar opens a manual HP panel: damage (temporary HP first), heal, manually set temporary HP, full heal or set to zero (confirmation). These adjustments require Actor ownership and use the D&D5e adapter.
- Manual HP adjustments deliberately do not roll damage, change defeated status, or alter death saves. GMs can modify Actors they own through Foundry permission rules. Multi-token modifications are not included.


## Dev.18 presentation and Inspiration

- Compact unframed Active Effects icons align right above the HUD. New effects append to the right; wrapped rows expand upward. Rich hover and right-click removal are retained.
- HP panel action labels use fixed semantic red (damage/zero), green (heal/full), blue (temporary) across themes, with higher-contrast shades for Sunlit Parchment.
- Normal HP uses a red bar; dev.19 replaces the proportional temporary HP bar with an exact +N shield indicator, which does not imply any temporary HP maximum.
- D&D5e Inspiration star beside the character name uses the Actor's real inspiration flag: filled/gold when available and outlined otherwise. GMs can grant/remove it; players who own their Actor can spend existing Inspiration but cannot grant it.


## Dev.19 presentation corrections

- Active Effect icons retain the right-aligned, transparent dev.18 layout, with a short duration label (`8h`, `3m`, `2r`) directly on an icon whenever Foundry provides a calculable **remaining** duration. Untimed effects have no badge. The full native tooltip remains available.
- Combat/world time refreshes update visible duration labels in place and refresh tooltip contents without rebuilding the expanded action browser. Actual effect changes still trigger normal Foundry updates.
- Temporary HP no longer has a percentage bar. It appears as a blue shield and exact `+N` value next to current/max HP, with automatic live value/visibility updates. Red normal HP remains proportional to its own maximum.
- HP adjustment logic, inspiration permissions, right-click Active Effect removal, all seven themes and existing inventory/spell organization remain unchanged.


## Dev.20 presentation changes

- Active Effect remaining-time labels have a compact translucent black pill immediately behind the white text. There is still no container around the icon strip or individual icon frames.
- HP adjustment popup is narrower, with a centered Amount field and concise Temp HP footer. All actions, Actor permission checks, and confirmation prompts remain unchanged.
- Character portrait supports double-click to open the native character sheet or focus an existing sheet. Keyboard Enter/Space also works; permissions follow Foundry Actor visibility.
- HP information beside the portrait has a grouped HP label/value, exact blue Temporary HP badge, slightly thicker red bar, and refined spacing.


## Dev.22 minimal HP toolbar

- Replaced dev.21 expanded HP manager with a single compact icon-only row. Removed the chevron, expanded view, header buttons and text labels. Negative controls remain on the left; positive controls and Temporary HP grant are on the right.
- Added compact readout and thin red HP bar directly above the actions, updated on Actor HP changes. Temporary HP is still an exact blue shield number with no maximum.
- The shared amount input is permanently white with dark text in all seven themes. Action icons have descriptive hover titles and accessibility labels; Zero retains confirmation.
- HP, effect durations and browsing still update without full browser rerender; no new world settings or Foundry modules.

## Dev.21 HP manager (superseded by dev.22)

- The default compact HP manager presents Zero (skull), Damage (minus), Amount, Heal (plus), and Full Heal (heart), all on one horizontal row with matching text labels.
- The top-right blue shield displays the current Temporary HP total and applies a higher amount from the same shared input. Like standard D&D5e Temporary HP, a lower new value does not replace a higher existing one.
- Chevron toggles the detailed mode with the original five labeled controls. There is only one amount input; it retains its value across expansion, collapse and Actor HP updates.
- Button borders/backgrounds and soft glows indicate destructive (red), recovery (green), or temporary protection (blue) consistently across themes. The full-action and zero-HP confirmation semantics are unchanged.
- Historical behavior: expansion was remembered in memory only. As of dev.40, manually selected category group states are also stored as client settings.


## dev.25: Actor Favorites and Custom Hotbar

- Favorites now live in Actor flags (`flags.zft-action-hud.favorites`). Existing client Favorites are copied once on an owned Actor if no flag exists. No client list is deleted.
- The optional Custom Hotbar has a fixed slot grid (1–20 rows, up to 20 columns, as of dev.32) stored on the Actor (`flags.zft-action-hud.hotbarSlots`). Each slot contains an Item/action reference with a conservative name/type/artwork fallback for world imports. Duplicate ambiguous matches remain unassigned.
- Hotbar layout size, floating position, visibility, labels, and locking stay in client settings. Docking was subsequently removed in dev.26; both independent locks arrived in dev.27.
- Unlock to drag actions from the category browser/Favorites into slots, reorder/swap slots, or remove items using the small clear control. Left-click uses native D&D5e execution; right-click opens a context menu with Item Sheet and button-color options; hover displays the rich Item preview.
- Slot artwork fills each HUD-sized button. Optional bottom white labels use a dark translucent backdrop.
- Recent Actions remain browser-local. This does not automatically synchronize independent copies of an Actor across servers.
- Tested using local harness; Foundry V13 live GM and player testing is required before release.

### dev.28: Dividers, independent scaling, auto-save clarity

- Custom Hotbar scale is separate from the primary HUD scale (50–150% in 5% increments). Live preview in the floating Settings window, saved on release.
- Unlock the hotbar layout, then use **Dividers** to display boundary markers between columns. Click + to add a separator, drag an existing divider marker to another boundary, or click it to remove; marked boundaries show a slim themed vertical line in every row. Dividers are stored on the Actor under `flags.zft-action-hud.hotbarDividers`, without taking up action slots. Boundaries beyond the current grid width are retained when shrinking.
- The Settings window explicitly states that changes are saved automatically.

## Dev.29 divider positioning and hotbar scaling controls

- Divider lines and editing markers now derive from the rendered slot boundaries rather than separate estimated pixel offsets, including when the bar is scaled or resized.
- With layout unlocked, click **Dividers**, then click a plus to add a boundary. Drag its active marker left/right to relocate it (snaps between columns), or click it to remove it. Divider changes save to the Actor after dropping; canceling a drag leaves the original position. No action slots are consumed or reassigned.
- With layout unlocked, click the **magnifying-glass** in the hotbar header to display its separate **Scale** slider (50–150%, 5% steps). Changes preview live and save on release; the same value remains editable through HUD Settings.


## dev.30: Settings accessibility and unscaled hotbar popover

- HUD Settings is now a wider (up to 450px), larger-text, five-tab window: General, Appearance, Actions, Hotbar, Advanced. Existing controls, auto-save behavior, GM-only settings and theme controls are preserved. Switching tabs does not save or reset form values.
- The custom hotbar magnifier opens a separately mounted, fixed-position scale popover above or below the hotbar. It stays at screen scale 100% while the hotbar scales live underneath it, and saves when released. Clicking outside or the X closes the popover.
- Hotbar scale stays independent of main HUD scale and remains accessible under Settings → Hotbar.
- This is a local development build. Validate appearance and usability in Foundry V13 before stable promotion.

### dev.32: Hotbar interface and scale controls

- Supports up to 20 rows and 20 columns (400 action slots per Actor profile), including Actor flag storage.
- Replaces the profile select with horizontal, scrollable tabs that remain usable when the layout is locked.
- A client-persisted Minimize/Expand button hides only the hotbar grid and editing controls, leaving tabs and both locks visible.
- Scale opens an unscaled screen-space slider on each HUD; hotbar and main Action HUD scales stay independent.
- Matches movement, lock, and collapse button icon semantics between interfaces.


### dev.33 changes (local testing)
- Add per-profile horizontal dividers between rows alongside existing vertical dividers. Both can be created, moved and removed in Dividers edit mode. No action slots are consumed.
- Left-align profile tabs; when tabs overflow, left/right workbook-style navigation buttons scroll them into view.
- Use different icons for layout locking (grid/grip) and position locking (padlock).
- Double-click a profile tab with Layout Lock off to rename it directly; Manage Profiles still offers Rename.


## Dev.34 UI fixes and adapter boundaries (local test build)

- When dragging the main Action HUD, keep any open category browser, HP popup, and external HUD Scale control visible and moving with the HUD. Keep category expansion, search and scroll state. Item hover previews close during a drag; standalone Settings and Actor/Item sheets are not dragged.
- Profile tabs align immediately after the drag grip. Right-click any writable Actor profile tab to rename it inline even when Layout Lock is enabled. Left-click still switches profiles; Manage Profiles remains available.
- Enrich Item description inline attack/damage expressions using Foundry's `TextEditor.enrichHTML` with `rolls: true`, Item document context and Actor roll data; sanitize the resulting HTML for the read-only hover. This depends on the native D&D5e/Foundry enrichers and needs live testing.
- Do not show bare `ft` without a distance in Item preview ranges. Avoid double-showing inherited base damage if the same damage component also exists in Activity parts. Other Activity parts are preserved.
- System-specific HP resource reads, inventory filter choices and action-use help wording now come from the internal D&D5e adapter, not the shared presentation templates. Other systems can provide their own adapter data; no second module is required.
- Existing Foundry V13/D&D5e, Midi-QOL, CPR, profiles, Favorites, drag/drop, themes and Actor flags remain unchanged. Live V13 verification is still required; V14 is not verified.


## dev.36 (local test build)

- New Actors start with **Combat**, **Exploration** and **Support** profiles. All three are permanent: their names and identities cannot be changed or deleted. Their actions, row/column settings, and dividers remain editable. Additional user-created profiles are still supported.
- Old profiles and assignments migrate without deletion, including a previously named **Combat** profile. Its existing actions become the new permanent Combat profile. The original Default layout is preserved for existing characters.
- Automatic Combat profile switching is now **enabled by default** for new client preferences; players may disable it under Settings → Hotbar. Explicitly saved older off preferences remain off.
- Right-click an Action HUD category button to customize its color. Right-click a Custom Hotbar slot to customize its color, reset its color, or (when assigned) open the Item sheet. The color chooser contains a hue wheel, saturation/lightness controls, an OS color chooser, and a six-digit HEX field.
- Only custom overrides are persisted. All unmodified buttons follow the selected theme. Main category colors are client-specific; hotbar slot colors are Actor/profile-specific and travel with exported Actors. Slot colors travel with actions when swapping, and are cleared on replacement.
- Settings → Appearance → **Reset All Button Colors** asks for confirmation, then clears category color overrides for this client and all slot overrides across the selected owned Actor's profiles.
- These changes require live Foundry V13 testing before acceptance, particularly migrated profiles and right-click color selection.

### dev.63 scene navigation stacking fix

- Replaced the Carolingian-only dev.62 selector with a Foundry V13 native `#scene-navigation` selector. Native navigation and its enclosing interface stacking context receive priority above the docked HUD while expanded or keyboard-focused. No HUD offsets, hotbar behavior, or saved settings change.
- Live Foundry V13 verification pending.


### dev.70: Native Macro Directory sorting

Shared and GM floating macro libraries now mirror their selected Foundry Macro Directory folders.
Both alphabetical and manual sorting use the Folder document's native `sorting` property.
When a GM drags a macro to a new button position, gap, or empty grid cell in a manually sorted floating library,
ZFT reindexes that folder's Macro documents using their native integer `sort` keys.
The Foundry sidebar, other connected clients, and the floating libraries therefore read
the same ordering. Shared macro ordering is visible to players with Macro permissions.
Drag-to-character-hotbar continues to copy Macro references; no Actor or Token flags
are used for library ordering. The former ZFT-specific `sharedMacroSort` and
`gmMacroSort` preferences are no longer read or written.
