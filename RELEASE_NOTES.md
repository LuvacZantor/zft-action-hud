# ZFT Action HUD v0.1.1 | Foundry V13

## Patch changes (v0.1.1)

- Fixed a player-client regression where the expanded Foundry V13 scene-navigation interface overlaid and intercepted clicks on the docked Action HUD, custom hotbar and settings window.
- Removed only the `dev.63` `#interface` / `#ui-left` CSS elevation selectors from `styles/hud.css`. Original HUD, custom hotbar and settings window stacking levels (`90`, `92`, and `95`) are unchanged.
- Updated `module.json`, runtime `VERSION` and version-specific console labels to `0.1.1`.
- No Actor data, hotbar profiles, saved settings, action execution, templates, or theme textures were changed.

**Known tradeoff:** Foundry's scene-navigation menu can appear behind the docked Action HUD again. A safer navigation-only stacking fix may be developed and tested separately.

## Validation

- The same CSS regression fix was deployed as `0.1.0-hotfix.1` and confirmed working during the live Foundry V13 session on October 16, 2026.
- Patch promotion and ZIP integrity checks do not independently verify all actions, Macro workflows, or Foundry V14.
- The original hotfix branch remains available for reference.

## Compatibility

- **Foundry VTT:** V13 Build 351 (manifest maximum: V13).
- **D&D5e:** 5.2.5.
- V14 / D&D5e 6.x remains separately unverified.
- Native D&D5e actions continue to drive execution; specific Midi-QOL and Chris's Premades versions are not independently certified.

## Included features (carried forward from v0.1.0)

- Expandable Weapons, Spells, Features, Consumables, Equipment, Inventory, Skills, Abilities, Saves, Tools, Favorites, and Recent menus.
- Character hotbar with Actor-owned Combat, Exploration, Support, and custom profiles, and draggable Item, Macro, Skill, Saving Throw, Ability Check and Tool Check shortcuts.
- Native HP, Inspiration, effects, spell slots, item/activity uses, ammunition and quantity indicators.
- Shared and GM Macro libraries backed by Foundry Macro Directory folders with native sorting.
- Personal themes, positioning, scaling, customizable colors, hover previews, effect tooltips and six packaged WebP theme textures.

## Packaging and installation

The complete `zft-action-hud-v0.1.1.zip` contains a single `zft-action-hud/` top-level directory with all module files, documentation and six theme background WebP images.

Back up the existing module folder, replace it with the complete ZIP's `zft-action-hud/` directory, then restart Foundry if the module version does not update; have all clients hard refresh (`Ctrl+F5`). Avoid merging old hotfix override files into the new installation.

## GitHub release status

`main` now contains the approved `0.1.1` patch source. The `v0.1.1` tag and GitHub Release have **not** been created or published; they require separate owner approval. The previous `v0.1.0` tag remains historical.
