import { MODULE_ID } from './settings.js';
import { hotbarProfiles } from './actor-quick-access.js';

/** Optional per-client automation. Tracks temporary switches only in this
 * browser session; never imposes a combat profile on other players. */
export class CombatProfileCoordinator {
  constructor(hotbar) { this.hotbar = hotbar; this.session = null; }
  onManualSwitch(actor) {
    if (actor?.uuid === this.session?.actorUuid) this.session.manualOverride = true;
  }
  async sync() {
    const actor = this.hotbar.actor;
    const enabled = game.settings.get(MODULE_ID, 'autoCombatProfile');
    const combat = game.combat;
    const participating = Boolean(actor && enabled && combat?.started &&
      [...(combat.combatants ?? [])].some(entry => entry.actor?.id === actor.id || entry.actorId === actor.id));
    if (this.session && (!participating || this.session.actorUuid !== actor?.uuid || this.session.combatId !== combat?.id)) {
      const previous = this.session;
      this.session = null;
      if (!previous.manualOverride && previous.actor?.isOwner &&
          hotbarProfiles(previous.actor).active === previous.combatProfileId &&
          hotbarProfiles(previous.actor).profiles.some(p => p.id === previous.previousId)) {
        await this.hotbar.switchForCombat(previous.actor, previous.previousId);
      }
    }
    if (!participating || this.session || !actor?.isOwner) return;
    const state = hotbarProfiles(actor);
    const target = state.profiles.find(p => p.id === 'combat');
    if (!target || target.id === state.active) return;
    this.session = { actor, actorUuid:actor.uuid, combatId:combat.id,
      previousId:state.active, combatProfileId:target.id, manualOverride:false };
    await this.hotbar.switchForCombat(actor, target.id);
  }
}
