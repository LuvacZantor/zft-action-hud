# ZFT Action HUD: Development Roadmap

Updated: 2026-10-13  
Project: https://github.com/LuvacZantor/zft-action-hud  
Branches: `dev` for development and `main` for stable releases  
Current development build on `dev`: `0.1.0-dev.75`  
Primary release target: **Foundry V13 Build 351, D&D5e 5.2.5**  
Separate later target: Foundry V14, D&D5e 6.x  
Release status: **Preparation in progress. No stable release approved or published.**

## Scope and principles

- Deliver a D&D5e Action HUD and character hotbar that work with native Foundry/D&D5e actions and existing automation, rather than a new rules engine.
- Keep Item/Activity actions, permissions, hotbar profiles, settings, and native Actor data intact.
- Treat code implemented, local automated checks, and live Foundry testing as different levels of evidence.
- Publish a V13-targeted release independently of V14. V14 compatibility work is **not** a V13 release blocker.
- The complete first-release package must include the six approved theme WebP textures. Local testing ZIPs `dev.71` through `dev.75` intentionally omitted `assets/` and are not self-contained release packages.
- Never update `dev`, `main`, tags, releases, or other GitHub state without task-specific approval.

## Feature status through local dev.75

| Capability | Status | Notes |
| --- | --- | --- |
| Expandable D&D5e action menus | Implemented in local test code | Weapons, Spells, Features, Consumables, Equipment, Inventory, Skills, Saves, Abilities, Tools, Favorites, Recent |
| Character hotbar and Actor-owned profiles | Implemented | Slot references, drag/drop, lock controls, profile switching, colors, dividers, scaling, docking |
| Item and Macro hotbar shortcuts | Implemented | Native Item/Activity execution and authorized Macro execution |
| Skills, Saves, Ability and Tool check shortcuts | Implemented in `dev.71+` | Native D&D5e roll methods; pending focused live acceptance |
| Shared and GM Macro floating libraries | Implemented | Native Macro Directory folder ordering; Shared drag/reorder confirmed live in `dev.70` |
| Persistent GM utility controls | **Requirement satisfied by the Shared and GM Macro libraries** | No additional controls planned unless a specific future GM need is identified |
| HP, Inspiration, Active Effects, spell slots | Implemented | Native D&D5e/Foundry information and controls; normal permission checks apply |
| Resource visibility | Implemented / refining in `dev.72-74` | Read-only uses, charges, quantity, resource labels and Activity consumption details; live data verification needed |
| Activity cost display correction | Implemented in `dev.74` | Avoids false spell-slot consumption on Unarmed Strike and other non-spell activities; broader consumption rules need focused live testing |
| Submenu framing | Implemented in `dev.73` | Consistent outer width and subtle offset; internal grids unchanged |
| Hover / effect tooltip background textures | Implemented in `dev.75` | Uses selected theme and Show Theme Background Textures setting; live visual test pending |
| Personal themes and textures | Implemented | ZFT Default plus six named themes; full release must include texture assets |
| Combat-profile auto-switch | Implemented | Session/multi-user transition testing is still incomplete |
| Assigned-character fallback | Implemented | Not the deferred pinned-character feature |

## V13 first stable release: active work

1. **Focused dev.75 acceptance in live V13:** Verify major known changes and no blocking regression in the GM test world. Full group testing is **not feasible solo**; record any untested multiplayer flows transparently instead of asserting they passed.
2. **Keep GitHub development branch synchronized:** `dev` contains the `dev.75` source and preserves the approved theme assets and Git history. New builds still require explicit authorization for further writes.
3. **Prepare a complete standalone V13 release package:** Include all six theme textures; set the stable version consistently in `module.json`, code and release notes; set and verify accurate V13 compatibility metadata after V13 acceptance. Do not use a ZIP missing assets as the complete public release.
4. **Approve and promote to `main` separately:** Commit/merge only the accepted release code with explicit authorization. Create a matching tag and publish the GitHub Release only with separate authorization.
5. **Post-release, test naturally with a live group:** Track real GM/player behavior and resolve any defects as ordinary patch releases instead of demanding exhaustive solo pre-release regression testing.

### Focused V13 acceptance checklist (pending live verification)

- [ ] `dev.75` is installed and starts in Foundry V13 Build 351, D&D5e 5.2.5 without a ZFT startup exception.
- [ ] Weapons, Spells, Features, and Consumables open and invoke native D&D5e actions as expected; Midi-QOL/CPR behavior is not bypassed.
- [ ] Unarmed Strike (Punch/Grapple/Shove), one spell, and one limited-use item show plausible resource Cost details; no invented spell slots.
- [ ] Skills, Saves, Ability Checks, and Tool Checks can be assigned to an unlocked character hotbar, rolled, and retained after refresh.
- [ ] Shared and GM Macro libraries open and use their selected folders; GM ordering and hotbar Macro-copy behavior are intact.
- [ ] Hotbar slots, profile switching, locking, and stored Actor preferences survive a browser refresh.
- [ ] Submenu frames keep the same outer width and subtle offset without changing the internal button/grid layout.
- [ ] Item and Active Effect popouts use the selected theme/texture setting, with readable text.
- [ ] Known blocking issues are documented and resolved or deliberately accepted by the owner before release.

*No full multiplayer regression or V14 verification is asserted by these checks.*

## Separate follow-ups (not blockers for the first V13 release)

| Area | Decision |
| --- | --- |
| Foundry V14 / D&D5e 6.x | Separate compatibility milestone; verify and ship after V13 as warranted |
| Multiplayer regression | Exercise during normal sessions and collect specific issues; no artificial solo sign-off |
| Pinned character | Low-priority backlog; no assigned build |
| Nested Macro Directory folders | Deferred |
| Cleanup/reset restore or import | Separate unresolved maintenance/data recovery workstream; do not assume the existing backup attempt is a verified restore |
| Other RPG adapters and external theme packs | Future enhancements only if needed |
| Action, Bonus Action, Reaction economy | Removed from active plan |
| GM-enforced campaign theming | Superseded by personal theme selection |
| Additional GM utility buttons | No feature gap identified; reopen only for a concrete use case |

## Roadmap maintenance

- Keep `ROADMAP.md` on `dev` up to date when GitHub writes are approved. Current source checkpoint: `dev.75`.
- `module.json` remains authoritative for the code version on each branch; local ZIP versions are not proof of remote updates.
- Do not treat simulated checks as live acceptance or GitHub branch changes as publication.
- The first stable version is expected to be `0.1.0` only **if the owner accepts the corresponding tested source and release scope**.

References: [Repository](https://github.com/LuvacZantor/zft-action-hud) · [ZFT development workflow](https://github.com/LuvacZantor/zft-tools/blob/main/DEVELOPMENT.md)
