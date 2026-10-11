# ZFT Action HUD

A planned hybrid action HUD for Foundry VTT, combining a configurable graphical hotbar with an expandable, categorized action menu.

**Project status:** Planning. No functional module build has been released.

## Planned capabilities

- Bottom-center docked HUD by default, with floating positioning, snapping, collapsing, and per-user appearance settings.
- Customizable grids, optional named action groups, drag-and-drop shortcuts, and saved character profiles.
- Manual profile selection plus optional per-player automatic Combat profile switching.
- Native D&D5e action execution and live resource indicators, with compatibility-minded Midi-QOL and CPR integration.
- Persistent GM controls and user-configurable action access.
- One module with internal RPG adapters: D&D5e first, more systems later when needed.
- A theme-neutral functional HUD with interchangeable **base, RPG-system, and campaign-specific visual themes**.
- GM-selectable campaign theme, optional per-player override, and safe fallback to ZFT Default.
- Initial visual targets: **ZFT Default** (dark fantasy) and one contrasting campaign-specific proof-of-concept.
- Optional integration with ZFT Tools; ZFT Tools is not required.

## Visual themes

HUD layout, actions, profiles, and positioning belong to the functional core. An internal theme engine changes colors, typography, frames, textures, icons, tooltips, and decorative effects without changing action behavior.

Theme precedence is ZFT Default fallback, RPG-system theme, GM-selected campaign/world theme, and optional player override where allowed. Two contrasting themes will be used to validate the architecture before expanding the theme catalog.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for agreed design decisions, phased implementation work, acceptance criteria, compatibility testing, and future expansion.

## Development workflow

ZFT projects use the shared [development and release workflow](https://github.com/LuvacZantor/zft-tools/blob/main/DEVELOPMENT.md). Source changes and releases require explicit, task-specific approval.

## References

Design references: [BG3 Inspired HUD](https://github.com/BragginRites/bg3-hud-core) and [Token Action HUD](https://github.com/Larkinabout/fvtt-token-action-hud-core).

License: [MIT](LICENSE).
