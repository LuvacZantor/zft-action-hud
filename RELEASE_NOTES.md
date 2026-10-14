# ZFT Action HUD 0.1.0 | Foundry V13

Release-candidate notes, prepared from the `0.1.0-dev.75` development code. **This package is not yet a published GitHub release.**

## Compatibility

- Intended for **Foundry V13 Build 351** and **D&D5e 5.2.5**.
- Manifest restricts Foundry core compatibility to V13. Foundry V14 / D&D5e 6.x testing is a separate milestone.
- Compatibility with specific versions of Midi-QOL and Chris's Premades has not been independently certified; actions continue to invoke native D&D5e workflows.

## Included features

- Expandable character action menus for Weapons, Spells, Features, Consumables, Equipment, Inventory, Skills, Abilities, Saves, and Tools, plus Favorites and Recent.
- Independent, configurable character hotbar with Actor-owned Combat, Exploration, Support, and custom profiles; drag-and-drop Item, Macro, Skill, Saving Throw, Ability Check, and Tool Check shortcuts.
- HP, Inspiration, Active Effect, spell-slot, Item/Activity remaining-use and relevant ammunition/quantity information from native D&D5e data. No separate resource-spending engine.
- Shared and GM Macro windows backed by Foundry Macro Directory folders, including manual folder sorting synchronization.
- Personal themes, six packaged WebP background textures, customizable colors, positioning and scaling; textured Item and Active Effect preview panels; consistent submenu framing.

## Packaging

The complete `zft-action-hud-v0.1.0.zip` contains one `zft-action-hud/` directory with the source, `module.json`, license, release notes, and six theme background WebP images. Unlike the dev.71 through dev.75 testing ZIPs, **no texture assets are omitted**.

## Known test boundaries

- The `dev.70` Shared Macro manual reorder was confirmed working in a live V13 session.
- The later check shortcut, resource display, consumption-cost and tooltip styling changes were locally syntax/fixture-tested but are not claimed to have passed comprehensive live GM/player regression testing.
- Full multiplayer regression is expected to continue during live sessions after release if accepted by the owner; any issues should be tracked as patch candidates.
- No V14 compatibility claim is made.

## Release procedure (not performed)

1. Owner approves the exact V13 release candidate for promotion to `main`.
2. Update and verify `main` under a separately authorized GitHub operation.
3. Create the `v0.1.0` tag pointing to the approved `main` commit, then publish the GitHub Release with the matching ZIP, both under separate authorization.
