# ZFT Action HUD: Development Roadmap

Updated: 2026-10-13  
Active branch: [dev](https://github.com/LuvacZantor/zft-action-hud/tree/dev)  
Current development build: **0.1.0-dev.70** (from `module.json`)  
Status: **Active development. No stable release approved or published.**  
Primary live target: **Foundry V13 Build 351 / D&D5e 5.2.5**  
Additional target: **Foundry V14 / D&D5e 6.x, to be tested separately**

> This roadmap tracks current source capabilities, remaining requirements, testing, and deferred decisions. The older planning checklist is superseded by the status below. An implemented feature is **not** automatically considered live-verified or release-ready.

## Vision and boundaries

Build a single, themeable hybrid action HUD with an expandable D&D5e action menu and an independent configurable character hotbar, using the native Foundry/D&D5e actions and existing Midi-QOL / Chris's Premades workflows rather than introducing a competing rules engine.

- The HUD core owns layout, category presentation, drag/drop, hotbar profiles, positioning, and accessibility.
- RPG adapters own system-specific action data, resource calculations, and native execution paths.
- Themes restyle existing interfaces without changing action semantics or character data.
- Foundry ownership and native document permissions remain authoritative.
- Player HUD appearance and positions are personal; character hotbar profiles/assignments are Actor-owned where appropriate; shared macro folder selection is GM/world configured.
- ZFT Tools is optional; no mandatory dependency or second RPG-specific module is planned.
- Keep `main` stable. Use the `dev` branch for authorized development commits. Never promote, tag, or publish without separate owner approval.

## Status legend

| State | Meaning |
| --- | --- |
| Implemented | Feature exists in the current development source; additional testing may still be required |
| Live confirmed | A specifically described scenario was verified in Foundry |
| Partial | Some agreed behavior exists, but capability or acceptance criteria remain unfinished |
| Planned | An accepted or proposed task remains unimplemented, with scope noted below |
| Review | Design or priority has not been finalized |
| Deferred / removed | Not part of the current development queue |
| Release gate | Must be checked before stable promotion |

## Current feature inventory

| Area | Current status | Notes |
| --- | --- | --- |
| Expandable action browser | Implemented | Weapons, Spells, Features, Consumables, Equipment, Inventory, Tools, Abilities, Saves, Skills, Favorites and Recent as applicable to the Actor |
| Native D&D5e execution | Implemented; regression testing needed | Item/Activity, check, save, skill, and applicable tool workflows use native system paths; Midi-QOL/CPR interaction needs live coverage |
| Action browsers and previews | Implemented | Search controls, remembered category/group expansion, Item inspection, scrollable effect information, position-aware hover panels |
| HP, Inspiration, effects | Implemented | Native Actor-backed controls and status presentation; verify permissions and changes on GM/player clients |
| Spell-slot management | Implemented | Native level and Pact slot values, including adjustment controls; no duplicate ZFT slot pool |
| Character hotbar | Implemented | Configurable grid, Item and Macro references, drag/drop, independent layout and position locks, floating/docked positioning, scale |
| Character hotbar profiles | Implemented | Combat, Exploration, Support, and custom profiles; colors, reordering, duplication, optional named row/column dividers |
| Automatic Combat profile | Implemented; test needed | Per-client preference and manual override/restore logic; actual multi-client combat transitions remain a release test |
| Assigned Player Character fallback | Implemented | When no token is controlled, the assigned Foundry character may be used if permitted; this is **not** a pinned-character feature |
| Personal appearance | Implemented | ZFT Default plus six named themes with texture options, per-user theme choice, accent customization, scale/transparency |
| Shared Macro library | Implemented | GM-selected Folder; player visibility remains subject to native Macro permissions; includes direct folder members, not nested folders |
| GM Macro library | Implemented | GM-only floating library backed by a configured Macro Directory folder |
| Native Macro folder sorting | Implemented; one live scenario confirmed | `dev.70` writes Macro document `sort` in a native manually sorted Folder; floating grids follow native manual/alphabetical folder sorting |
| Macro drag-to-character-hotbar | Implemented | Copies a Macro reference to a permitted unlocked character slot; does not clone the Macro |
| Skills and Saves in character hotbar | **Not implemented** | These are available as menu actions but the source deliberately excludes check-type actions from Favorites/hotbar drag |
| Optional pinned character | **Not implemented** | Separate from assigned-character fallback and selected token |
| Non-spell resources | **Partial** | D&D5e uses/availability are surfaced for applicable actions; a comprehensive agreed UI for ammunition, charges, and other tracked pools is outstanding |
| Persistent GM utility controls | **Partial / review** | Existing GM/Shared Macro libraries are implemented; decide if anything beyond them is actually needed |
| V14 compatibility | **Unverified** | Manifest compatibility is not proof that V14 / D&D5e 6.x works |

### Live confirmations to date

- **2026-10-13, dev.70:** Owner confirmed working drag/drop rearrangement for the Shared Macro floating library in the live Foundry environment after the dev.68 and dev.69 attempts failed.
- This does **not** by itself certify GM-library reordering, player-client synchronization, refresh persistence, or V14. Those tests remain listed below.
- Historical README entries describe other individual test results, but unconfirmed end-to-end workflows are not marked as fully accepted here.

## Prioritized active backlog

Priorities below are **proposed sequencing**, not automatic approval to implement, change GitHub, or include extra functionality.

| Priority | Candidate build | Work | Completion criteria |
| --- | --- | --- | --- |
| 1 | dev.71 | Assign Skills and Saving Throws to character hotbar slots | Drag permitted checks/saves to unlocked slots; execute native D&D5e rolls, display accurate labels and values, persist in correct Actor/profile, handle missing references and permissions |
| 2 | dev.72 | Optional pinned-character selection | Explicit opt-in; pinned Actor takes precedence only when enabled; switching/unpinning works without changing native token selection; no inadvertent changes to other clients |
| 3 | dev.73 | Remaining resource presentation | Agree on which charge/ammo/item-use pools are useful; use authoritative Actor/Item/Activity values; respect native consumption and Midi-QOL/CPR |
| 4 | Scope review | Remaining GM utility needs | Decide whether Shared/GM Macro libraries cover the original GM-controls goal; avoid building controls without a concrete use case |
| 5 | Testing | Complete Foundry V13 GM/player regression pass | Verify critical HUD, hotbar, Macro, theme, storage, and permission workflows below |
| 6 | Compatibility | Validate Foundry V14 / D&D5e 6.x separately | Adapt only incompatible APIs and verify native workflows in the V14 test world |
| 7 | Release review | First stable release | Confirm accepted version, remaining defects, release notes, manifest, installation package; request separate approval for `main`, tag, and Release |

### 1. Skills and Saving Throws as hotbar actions (next candidate)

- Reuse existing D&D5e check/roll adapters rather than converting checks into fake Items or Macros.
- Define stable stored references and labels for skill and save actions, consistent with the existing Actor-owned profile model.
- Work with the current drag/drop locks, duplicate/replace/move semantics, profile switching, and missing-reference handling.
- Verify native roll dialogs and relevant system/module hooks still execute.
- **Acceptance:** Owned character, GM actor, refresh, profile change, reassignment, and rejected unauthorized drops behave predictably.
- **Scope note:** Adding Ability checks or Tool proficiency shortcuts may be sensible, but requires a deliberate scope decision; do not silently include them.

### 2. Pinned character (later candidate)

- Introduce an optional *per-user* character pin that does not select or alter canvas tokens.
- Define precedence relative to controlled token, multiple selected tokens, and existing assigned-character fallback.
- Provide an obvious indicator and clear/unpin action; avoid invisible Actor switches.
- **Acceptance:** Pinning, unpinning, token changes, reload, and GM/player ownership all behave as explicitly designed.

### 3. Remaining resource display (later candidate)

- Inventory and Activity availability/uses exist in some form; inspect first instead of duplicating the current implementation.
- Identify which ammunition, charges, consumable uses, or other resource pools need dedicated UI.
- Display current values from native D&D5e documents. Where modification is allowed, use the supported native document/API operation.
- **Acceptance:** Native casting/consumption, Midi-QOL/CPR execution, ownership changes, and refresh never disagree with the sheet.

## Current testing and release gates

- [ ] Verify **both** Shared and GM floating libraries reorder correctly against their respective Foundry Macro Directory folders.
- [ ] Verify moving macros **in Foundry's sidebar** updates floating libraries without needing a manual refresh.
- [ ] Verify GM-defined Shared order is reflected for a logged-in player, including refresh/reconnect.
- [ ] Verify alphabetic/manual Folder sorting transitions, macro creation/deletion/moves, and restricted Macro permissions.
- [ ] Verify copying Macro references onto a character hotbar still works and does not execute the Macro during a drag.
- [ ] Validate hotbar Item/Macro assignments, profile switching, dividers, colors, locks, scaling, and persistence after refresh/reconnect.
- [ ] Validate native item activities, skills, saves, tool rolls, spell pools, HP, Inspiration, and Active Effects for owned and non-owned actors.
- [ ] Validate assigned-character fallback and no/multiple-token selection behavior.
- [ ] Validate automatic Combat profile entry/exit and manual override, including multiple clients.
- [ ] Validate all themes, texture toggle, category layouts, popover positioning, screen sizes, and reduced-motion/contrast where supported.
- [ ] Test Foundry V13 Build 351 with the installed D&D5e 5.2.5, Midi-QOL and CPR configuration, including permission-denied and missing-action cases.
- [ ] Repeat relevant functional and visual verification **independently** on Foundry V14 / D&D5e 6.x; do not infer compatibility from V13.
- [ ] Validate syntax, packaging, manifest, release notes, and a known-good rollback point before stable release.
- [ ] Obtain explicit owner approval before merging to `main`, tagging, or publishing a Release.

## Development milestones (current reality)

| Milestone | Status | Remaining consideration |
| --- | --- | --- |
| Core and D&D5e adapter architecture | Implemented | Audit V13/V14 API boundaries |
| Expandable hybrid HUD and independent hotbar | Implemented | GM/player regression testing |
| Customization, profiles and theme variants | Implemented | User experience, access and persistence testing |
| Native resources and utility controls | Partial | Additional useful pools; GM utility scope |
| Macro libraries and folder-backed ordering | Implemented; partial live confirmation | Player/GM and persistence tests |
| Additional assignable check actions and pinning | Planned | Proposed dev.71 and dev.72 |
| Compatibility and stable release | Release gate | V13 acceptance, V14 verification, explicit approval |

## Superseded, separate, or deferred work

- **Action / Bonus Action / Reaction economy tracking:** Removed from the active development plan. Do not reintroduce without a new request.
- **GM-controlled campaign theme and theme inheritance:** Earlier design proposal was superseded by the personal-theme model in dev.58. Existing legacy settings may remain hidden for compatibility; do not treat old roadmap language as an active requirement.
- **Nested Macro folders:** Deliberately deferred. Shared and GM libraries currently read direct members of their configured folders.
- **Maintenance/data recovery:** A separate unresolved workstream, not part of native Macro sorting or the next proposed feature build. Do not assume cleanup/reset provides a verified restore path.
- **Additional RPG adapters (such as PF2e), external theme packs, community profile import/export, advanced keyboard/touch controls, and extra ZFT Tools integration:** Future enhancements, not first-release commitments.
- **Edge snapping, optional keyboard controls, resource/economy widgets and other older planning ideas:** Reassess explicitly before treating them as required; do not infer they are complete from archived [x] design decisions.

## Roadmap maintenance rules

1. `ROADMAP.md` on `dev` is the authoritative *current backlog*, not an automatically completed checklist.
2. `module.json` is authoritative for the code version. Documentation-only commits do not require an invented new `-dev.N` build.
3. At each accepted development milestone, update feature status, live-test evidence, next priorities, and deferrals. Historical build details belong in `README.md` and commits.
4. Distinguish code implemented from behavior confirmed in a specified live Foundry version.
5. Use [ZFT Development Workflow](https://github.com/LuvacZantor/zft-tools/blob/main/DEVELOPMENT.md): request explicit authorization for each bounded GitHub write; do not update `main`, create tags, or publish Releases implicitly.

## References

- [Repository](https://github.com/LuvacZantor/zft-action-hud)
- [Current development branch](https://github.com/LuvacZantor/zft-action-hud/tree/dev)
- [Development build history](https://github.com/LuvacZantor/zft-action-hud/blob/dev/README.md)
- [ZFT Development Workflow](https://github.com/LuvacZantor/zft-tools/blob/main/DEVELOPMENT.md)
- Design references: [BG3 HUD Core](https://github.com/BragginRites/bg3-hud-core), [Token Action HUD Core](https://github.com/Larkinabout/fvtt-token-action-hud-core)
