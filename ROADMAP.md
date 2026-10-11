# ZFT Action HUD: Development Roadmap

Status: Planning  
Initial game system: D&D5e  
Foundry targets: V13 Build 351 and V14 (verify separately)  
Repository: https://github.com/LuvacZantor/zft-action-hud

## Vision

Create a polished, configurable Foundry VTT action HUD that combines the visual hotbar strengths of BG3 Inspired HUD with the organized, accessible action menus of Token Action HUD.

The module should replace the need to run both HUD systems once its functionality has been tested and accepted. It should launch Foundry's native actions and use existing game-system and automation behavior, not become a competing rules or combat automation engine.

## Agreed design decisions

These are approved *requirements*, not claims that implementation is complete.

- [x] Use the module ID **zft-action-hud**.
- [x] Deliver a **hybrid HUD**: customizable graphical hotbar plus compact, categorized action menu.
- [x] Make the **action menu expandable** on demand, not permanently visible.
- [x] Use a configurable BG3-style grid with **optional named action groups**.
- [x] Support multiple named profiles (e.g., Combat, Exploration, Support, custom).
- [x] Allow **manual profile switching** at any time.
- [x] Offer **automatic Combat profile switching as a per-player toggle**, off by default; restore the previous profile at combat end and respect manual overrides.
- [x] Default to **bottom-center docking**, with floating, dragging, optional edge snapping, collapsing, position reset, and remembered per-user position and scale.
- [x] Keep the expandable menu attached to the HUD and within the viewport.
- [x] Support both GM and player use, with independent player configuration and persistent GM controls.
- [x] Use **one module** with internal RPG-specific adapters rather than one Foundry module per RPG.
- [x] Build D&D5e support first; consider other RPG systems when needed.
- [x] Treat **ZFT Tools as an optional shared foundation**, not a mandatory dependency.
- [x] Use **one stable functional HUD layout** with a pluggable visual theme engine. Themes restyle components without replacing their action logic, structure, or layout state.
- [x] Support **base, RPG-system, and campaign-specific themes**, with a GM-selected campaign theme and an optional per-player override.
- [x] Start with **two demonstrator themes**: ZFT Default (neutral dark fantasy) and one visually distinct campaign-specific proof-of-concept (campaign and art direction to be chosen).
- [x] Keep theme definitions modular, so additional campaign looks and future RPG themes do not require rebuilding the core HUD.

## Visual theming architecture

**Core principle:** Construct the functional HUD once, then apply a replaceable visual skin. Switching themes must not alter which actions exist, how Items/Activities execute, how profiles are stored, or where the user positioned the HUD.

### Separation of responsibilities

| Layer | Owns | Must not own |
| --- | --- | --- |
| HUD core | Layout, grids, menus, positioning, dragging, profiles, accessibility, action presentation contracts | Game-specific rules or campaign-specific styling |
| RPG adapter | System-specific actions, resources, labels, and execution | HUD geometry or campaign visual identity |
| Theme engine | Theme registration, selection, inheritance, asset resolution, CSS variables/tokens, appearance application | Action execution, targeting, profiles, gameplay state |
| Theme pack | Colors, fonts, textures, frames, icons, resource meter styles, tooltip styling, optional decorative effects | Changes to controls' functional semantics or stored action data |

The theme engine belongs to **zft-action-hud**, not to **zft-tools** at this stage. Integration with ZFT Tools remains optional.

### Theme precedence and selection

1. **ZFT Default** is the complete built-in fallback theme.
2. An **RPG-system default** may be supplied by the active internal system adapter (for example, D&D5e, with more adapters later).
3. A **campaign/world theme** selected by the GM can override the system default.
4. An **optional per-player theme override** can supersede the world selection if permitted by world settings. Players who do not override inherit the world theme.

Theme selection must be independent from player hotbar profiles, user docking/position settings, and actor selection. A missing, disabled, or incompatible theme must fall back safely to ZFT Default.

### Implementation boundaries

- Use namespaced CSS custom properties/design tokens for palette, typography, border treatments, contrast, textures, and restrained visual effects.
- Use theme manifests/registry entries to declare theme IDs, labels, assets, styles, optional inheritance, and compatible UI/theme API versions.
- Apply styles through isolated HUD-scoped selectors, not broad Foundry or D&D5e global overrides.
- Keep DOM structure, interactive hit targets, grid semantics, docking and sizing logic, menus, and accessibility behavior owned by the core.
- Themes may replace decorative art (frames, backgrounds, button treatments, resource meters, tooltip chrome), but must not move critical controls or alter action behavior. The theme must work in docked and floating modes.
- Respect reduced-motion/high-contrast accessibility settings, preserve legibility, and support safe runtime theme switching without full HUD state loss.
- Do not copy copyrighted third-party imagery, icons, or code without the necessary rights and attribution. Independently authored or appropriately licensed assets only.
- Future external/community-distributed theme packs are an extensibility goal, **not** a requirement to ship separate theme modules in the first release.

### Initial theme validation

- **ZFT Default:** Neutral, readable dark-fantasy look suitable across D&D campaigns.
- **Campaign proof-of-concept:** A second, clearly different visual identity selected during design (e.g., gothic horror, arcane fantasy, or science fiction) to prove the same HUD renders correctly with a different skin.

The two themes must share identical functional controls and saved profiles. The contrasting theme is a validation target, not a commitment to a particular campaign's copyrighted artwork.

## Status legend

- **Planned**: requirements identified; implementation not started.
- **In Progress**: being implemented or revised.
- **Testing**: packaged for live Foundry testing.
- **Completed**: acceptance criteria satisfied in the specified target environments.
- **Deferred**: explicitly outside the current release scope.

## Milestones

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation, theme engine architecture, and visual design | Planned |
| 2 | Functional hybrid HUD prototype | Planned |
| 3 | Customization and profiles | Planned |
| 4 | Combat and automation integration | Planned |
| 5 | Theme expansion, visual polish, and user experience | Planned |
| 6 | Compatibility, testing, and first release | Planned |

## Phase 1: Foundation and visual design

**Goal:** Define a maintainable single-module framework with system-specific adapters and a themeable, functionally stable HUD layout.

- [ ] Produce visual mockups for bottom-docked and floating configurations.
- [ ] Design the hotbar, expandable action menu, named groups, tooltips, profile selector, and GM area.
- [ ] Define stable HUD component contracts that do not depend on theme-specific HTML or action logic.
- [ ] Design the theme registry, manifests, CSS design tokens, scoped styles, fallback behavior, and asset loading.
- [ ] Define theme precedence, GM world selection, per-player overrides, and permission boundaries.
- [ ] Approve visual directions for ZFT Default and a contrasting campaign-specific proof-of-concept.
- [ ] Define a game-system adapter contract: enumerate actions, categorize them, expose display data and resources, and execute actions.
- [ ] Separate UI, settings, actor/token state, profile persistence, adapters, and integrations.
- [ ] Establish client (per-user), actor, and world setting ownership and permissions.
- [ ] Identify approved APIs and compatibility boundaries for V13/V14 and D&D5e generations.
- [ ] Decide storage of profiles and item/activity references so renamed, deleted, and reimported objects behave predictably.

**Acceptance:** A reviewable theme-neutral UI layout, documented RPG and theme interfaces, clear world/player theme selection rules, and no unexplained coupling to D&D5e or ZFT Tools.

## Phase 2: Functional hybrid HUD prototype

**Goal:** Make the HUD useful for normal D&D5e actions before extensive customization.

- [ ] Render a bottom-center graphical hotbar and expandable categorized action menu.
- [ ] Implement the initial theme engine with safe default fallback and scoped appearance tokens.
- [ ] Apply **ZFT Default** to the working HUD without embedding its visual identity in action/layout logic.
- [ ] Apply the contrasting **campaign proof-of-concept theme** to the same UI to validate theme interchangeability.
- [ ] Include Attacks, Spells, Features, Skills, Saves, Inventory/Items, and Macros as applicable.
- [ ] Follow a selected, controlled token and provide a clear no-selection state.
- [ ] Resolve relevant D&D5e Items and Activities and execute through native system paths.
- [ ] Provide basic hover descriptions and right-click access to relevant Item/configuration sheets.
- [ ] Implement initial floating mode with drag handle; moving the HUD must not trigger its action buttons.
- [ ] Open and dismiss the action menu reliably, including Escape and outside-click.
- [ ] Make the interface work for player-owned characters and permitted GM-controlled actors.

**Acceptance:** In a live Foundry world, an authorized player and GM can select a token, find an action, use it, and move or dismiss the HUD without UI errors. Both initial themes must render the same controls without affecting action execution or saved positioning.

## Phase 3: Customization and profiles

**Goal:** Let players configure their workspace without GM intervention.

- [ ] Drag, rearrange, duplicate, replace, and remove shortcuts.
- [ ] Support adjustable rows, columns, icon sizes, optional named groups, and visibility controls.
- [ ] Create, rename, switch, and retain multiple character-specific profiles.
- [ ] Save positions, scale, docking/collapse options, and visual preferences per user.
- [ ] Expose authorized world/campaign theme selection and optional independent per-player theme selection.
- [ ] Persist theme choices separately from saved action profiles.
- [ ] Support docked, floating, edge-snapped, and collapsed presentation; provide Reset Position.
- [ ] Keep menus visible by choosing an appropriate opening direction near screen edges.
- [ ] Implement optional automatic Combat profile selection with a per-player toggle, default off.
- [ ] Restore the previous profile when combat ends; preserve a manual choice made during combat.
- [ ] Ensure saved data survives refresh, reconnect, token re-selection, and appropriate actor changes.

**Acceptance:** Multiple users can keep independent HUD preferences, and profile switching operates consistently through a combat start/end cycle without overriding a manual choice.

## Phase 4: Combat and automation integration

**Goal:** Reflect existing workflows instead of duplicating automation.

- [ ] Display live spell slots, charges, ammunition, item uses, and other supported resources.
- [ ] Show available/spent Action, Bonus Action, and Reaction indicators using authoritative integration data where available.
- [ ] Preserve native D&D5e targeting and Midi-QOL workflow execution.
- [ ] Integrate with Midi-QOL and CPR/Chris's Premades when present, using their supported interfaces.
- [ ] Avoid new mandatory third-party dependencies unless explicitly approved.
- [ ] Support persistent GM macro controls and optional pinned-character selection independent of ordinary token changes.
- [ ] Update only affected HUD elements when values change; avoid unnecessary full renders.
- [ ] Fail safely and explain when an action is unavailable, not owned, invalid, or unsupported.

**Acceptance:** Automated and nonautomated actions produce the same expected Foundry workflows as using the underlying Item/Activity directly, including correct resources and permissions.

## Phase 5: Theme expansion, visual polish and usability

**Goal:** Refine the built-in themes and make the combined HUD attractive, readable, and unobtrusive.

- [ ] Polish ZFT Default and the initial campaign proof-of-concept, including consistent button, tooltip, resource-meter, and menu styling.
- [ ] Validate contrast, icon readability, reduced-motion preferences, and theme switching across docked and floating configurations.
- [ ] Establish a repeatable approach to adding RPG/campaign themes without changing the core UI.
- [ ] Provide detailed, readable, scrollable tooltips with description, activation, range, targeting, damage, and costs where applicable.
- [ ] Add responsive scaling, icon sizing, restrained status coloring, and configurable transparency.
- [ ] Refine menu animation, focus/hover states, placement, collapse behavior, and readability at different resolutions.
- [ ] Ensure menus and tooltips do not block unrelated Foundry canvas interactions.
- [ ] Provide sensible initial layouts without forcing players to configure every character manually.

**Acceptance:** Players can use the HUD throughout a session without persistent screen obstruction, unexpected clicks, illegible tooltips, or lost layout settings.

## Phase 6: Compatibility, testing, and first release

**Goal:** Release an accepted D&D5e implementation without disrupting production.

- [ ] Validate Foundry V13 Build 351 independently.
- [ ] Validate Foundry V14 independently.
- [ ] Verify actual installed D&D5e versions and target the corresponding adapter paths; do not assume D&D5e 5.x and 6.x are interchangeable.
- [ ] Test both GM and player clients, owned and unlinked tokens, different actors, and permission failures.
- [ ] Test with Midi-QOL/CPR enabled and disabled when the integration is optional.
- [ ] Test profile persistence, automatic combat switching, floating positioning, resource refreshes, and recovery from missing actions.
- [ ] Test both initial theme skins, runtime theme switching, RPG/world/player precedence, invalid-theme fallback, and user permission boundaries.
- [ ] Check UI conflicts with BG3 Inspired HUD and Token Action HUD during migration/testing; avoid permanently running competing HUD controls.
- [ ] Validate module manifest, script syntax, packaging, logging, documentation, and installation instructions.
- [ ] Preserve a known-good fallback and complete live acceptance testing before promoting a build to stable.
- [ ] Publish the first stable release only after explicit approval under the ZFT development workflow.

**Acceptance:** Supported version combinations have passed documented live Foundry tests and the owner has explicitly accepted the release candidate.

## Future expansion (not in the first release)

- Additional RPG adapters (such as PF2e) inside the same module, added only when needed.
- Profile import/export and reusable community/world templates.
- Additional RPG/campaign themes, optional external theme packs, and expanded accessibility controls.
- Advanced keyboard shortcuts and optional ZFT Tools integration.

## Open design and implementation questions

Track these during the relevant phase rather than guessing:

- Exact appearance and placement of the character portrait, profiles, GM macro controls, and resource indicators.
- Whether combat auto-switching should key off the active encounter, actor participation, or another defined combat state.
- Ownership and persistence model for character profiles shared by multiple users.
- Keyboard controls, touch usability, screen scaling, and small-resolution behavior.
- The precise supported Foundry/D&D5e version matrix as upstream systems evolve.
- Third-party license obligations before reusing any implementation or assets.
- Exact appearance and asset sources for the campaign proof-of-concept theme.
- Whether campaign theme choice should be advisory or enforceable by GM (default proposal: players may override when permitted).
- Theme pack registration/versioning details and the scope of runtime theme overrides.

## Reference implementations

These are design and behavioral references, not bundled dependencies:

- BG3 HUD Core: https://github.com/BragginRites/bg3-hud-core
- BG3 HUD D&D5e: https://github.com/BragginRites/bg3-hud-dnd5e
- Token Action HUD Core: https://github.com/Larkinabout/fvtt-token-action-hud-core
- Token Action HUD D&D5e: https://github.com/Larkinabout/fvtt-token-action-hud-dnd5e

## Development and roadmap maintenance

- This ROADMAP.md is the authoritative roadmap for ZFT Action HUD.
- Mark individual tasks and milestone statuses only when their state changes; an agreed requirement is not a completed feature.
- Record major scope changes, decisions, and deferred items here as work progresses.
- Keep the README linked to this file.
- Follow the shared ZFT workflow at https://github.com/LuvacZantor/zft-tools/blob/main/DEVELOPMENT.md.
- Keep main stable. Implement and test active work through local builds and an authorized development branch; never write to any GitHub branch, tag, release, or other repository state without explicit task-specific approval.
- Use a planned initial development build such as 0.1.0-dev.1 when runnable code begins; do not claim an existing build or live validation from this planning document.
