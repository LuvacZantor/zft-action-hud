/** Scoped, previewable maintenance of Action HUD hotbar data only.
 * Never touch Favorites, Recent, client settings, other modules, compendiums or scene Actors
 * during the world-directory bulk operations. */
import { MODULE_ID } from './settings.js';
import { BUILTIN_PROFILES, HOTBAR_FLAG, HOTBAR_DIVIDERS_FLAG,
  HOTBAR_ROW_DIVIDERS_FLAG, HOTBAR_PROFILES_FLAG, hotbarProfiles,
  hasPendingHotbarSelection, awaitHotbarSelection } from './actor-quick-access.js';

const LEGACY_FLAGS = [HOTBAR_FLAG, HOTBAR_DIVIDERS_FLAG, HOTBAR_ROW_DIVIDERS_FLAG];
const BACKUP_FLAGS = [HOTBAR_PROFILES_FLAG, ...LEGACY_FLAGS];
const LOG = '[ZFT] Hotbar Maintenance';
const clean = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const hasValue = (actor, key) => actor?.getFlag?.(MODULE_ID, key) !== undefined;
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function populated(profile) {
  if (!profile || typeof profile !== 'object') return false;
  // Treat labels, dimensions and colors as meaningful user configuration too.
  return (Array.isArray(profile.slots) && profile.slots.some(Boolean)) ||
    (Array.isArray(profile.dividers) && profile.dividers.length > 0) ||
    (Array.isArray(profile.rowDividers) && profile.rowDividers.length > 0) ||
    Object.keys(clean(profile.colors)).length > 0 ||
    Object.values(clean(profile.dividerLabels)).some(axis => Object.values(clean(axis)).some(Boolean)) ||
    Boolean(profile.accent) ||
    (profile.rows != null && Number(profile.rows) !== 2) ||
    (profile.columns != null && Number(profile.columns) !== 6);
}
function legacyPopulated(actor) {
  return (Array.isArray(actor.getFlag?.(MODULE_ID, HOTBAR_FLAG)) &&
    actor.getFlag(MODULE_ID, HOTBAR_FLAG).some(Boolean)) ||
    (Array.isArray(actor.getFlag?.(MODULE_ID, HOTBAR_DIVIDERS_FLAG)) &&
    actor.getFlag(MODULE_ID, HOTBAR_DIVIDERS_FLAG).length > 0) ||
    (Array.isArray(actor.getFlag?.(MODULE_ID, HOTBAR_ROW_DIVIDERS_FLAG)) &&
    actor.getFlag(MODULE_ID, HOTBAR_ROW_DIVIDERS_FLAG).length > 0);
}

export function inspectHotbarMaintenance(actor) {
  const stored = actor?.getFlag?.(MODULE_ID, HOTBAR_PROFILES_FLAG);
  const hasModern = Boolean(stored && Array.isArray(stored.profiles) && stored.profiles.length);
  const modernFlagPresent = hasValue(actor,HOTBAR_PROFILES_FLAG);
  const oldFlags = LEGACY_FLAGS.filter(key => hasValue(actor,key));
  const legacyOnly = !hasModern && legacyPopulated(actor);
  const defaults = hasModern ? stored.profiles.filter(profile => profile?.id === 'default' ||
    String(profile?.name || '').toLowerCase() === 'default') : [];
  const emptyDefaults = defaults.filter(profile => !populated(profile)).length;
  const populatedDefaults = defaults.length - emptyDefaults + (legacyOnly ? 1 : 0);
  const hasConfiguration = modernFlagPresent || oldFlags.length > 0;
  return {
    hasModern, hasConfiguration, oldFlags, legacyOnly,
    emptyDefaults, populatedDefaults,
    needsCleanup: emptyDefaults > 0 || (hasModern && oldFlags.length > 0) || legacyOnly ||
      (!hasModern && oldFlags.length > 0 && !legacyPopulated(actor)),
    needsReset: hasConfiguration
  };
}

export const freshHotbarProfiles = () => ({schema:2,active:'combat',profiles:BUILTIN_PROFILES.map(({id,name}) => ({
  id,name,rows:2,columns:6,slots:[],dividers:[],rowDividers:[],
  dividerLabels:{columns:{},rows:{}},colors:{},accent:null
}))});

/** One atomic update per Actor. Deletion operations use Foundry's `-=` syntax. */
export async function updateHotbarMaintenance(actor, operation) {
  if (!actor?.isOwner || typeof actor.update !== 'function') throw new Error('Actor ownership is required.');
  if (hasPendingHotbarSelection(actor)) await awaitHotbarSelection(actor);
  const check=inspectHotbarMaintenance(actor);
  if (!(operation === 'cleanup' ? check.needsCleanup : check.needsReset)) return false;
  const patch={};
  if (operation === 'reset') {
    patch[`flags.${MODULE_ID}.${HOTBAR_PROFILES_FLAG}`]=freshHotbarProfiles();
  } else if (operation === 'cleanup') {
    const state=hotbarProfiles(actor);
    const kept=state.profiles.filter(profile =>
      !(profile.id === 'default' || profile.name.toLowerCase() === 'default') || populated(profile));
    if (check.hasModern || check.legacyOnly) {
      state.profiles=kept;
      if (!kept.some(profile => profile.id === state.active)) state.active='combat';
      patch[`flags.${MODULE_ID}.${HOTBAR_PROFILES_FLAG}`]=state;
    }
  } else throw new Error('Invalid maintenance operation.');
  for (const key of check.oldFlags) patch[`flags.${MODULE_ID}.-=${key}`]=null;
  await actor.update(patch);
  return true;
}

function targetsFor(scope, current) {
  if (scope==='current') return current && current.isOwner ? [current] : [];
  if (scope!=='all' || !game.user?.isGM) throw new Error('GM access required for all-character maintenance.');
  // game.actors contains directory Actors; synthetic scene-token Actors are not here.
  const actors = game.actors?.contents || Array.from(game.actors?.values?.() || []);
  return actors.filter(actor => actor?.type==='character' && !actor?.pack && actor?.isOwner);
}
function snapshot(actors, operation, scope) {
  return {
    format:'zft-action-hud-hotbar-backup',version:1,operation,scope,
    module:MODULE_ID,createdAt:new Date().toISOString(),
    actors:actors.map(actor=>({
      uuid:actor.uuid,id:actor.id,name:actor.name,type:actor.type,
      synthetic:actor.isToken === true || actor.parent?.documentName === 'Token',
      // Keep raw values, including current and any legacy keys, for manual recovery.
      flags:Object.fromEntries(BACKUP_FLAGS.filter(k=>hasValue(actor,k))
        .map(k=>[k,actor.getFlag(MODULE_ID,k)]))
    }))
  };
}
function backupName(){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
  const part=k=>p.find(x=>x.type===k)?.value||'00';
  return `zft-action-hud-hotbar-backup_${part('year')}${part('month')}${part('day')}-${part('hour')}${part('minute')}.json`;
}
function downloadSnapshot(data) {
  const json=JSON.stringify(data,null,2);
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  try {
    const link=document.createElement('a');link.href=url;link.download=backupName();
    document.body.append(link);link.click();link.remove();
  } finally {setTimeout(()=>URL.revokeObjectURL(url),10000);}
}
function actorDetails(scope, count, examples) {
  return scope==='current'
    ? `<p>Selected character: <strong>${escapeHtml(examples[0]?.name||'None')}</strong>.</p>`
    : `<p>Directory player characters: <strong>${count}</strong>. NPCs, unlinked scene tokens and compendiums are excluded.</p>`;
}

/** DialogV2 confirmation supports the Foundry V13 ApplicationV2 interface. */
export async function performHotbarMaintenance({operation,scope,actor,onComplete=()=>{}}) {
  if (!['cleanup','reset'].includes(operation) || !['current','all'].includes(scope)) throw new Error('Unknown maintenance operation.');
  if (scope==='all' && !game.user?.isGM) throw new Error('GM access required.');
  const actors=targetsFor(scope,actor);
  if (!actors.length) {ui.notifications?.warn('No eligible characters found.');return {updated:0,failed:0};}
  const inspected=actors.map(actor=>({actor,check:inspectHotbarMaintenance(actor)}));
  const affected=inspected.filter(({check})=>operation==='cleanup'?check.needsCleanup:check.needsReset);
  const empty=inspected.reduce((n,item)=>n+item.check.emptyDefaults,0);
  const populatedCount=inspected.reduce((n,item)=>n+item.check.populatedDefaults,0);
  if (!affected.length) {ui.notifications?.info('No hotbar data needs this operation.');return {updated:0,failed:0};}
  const isReset=operation==='reset';
  const title=isReset?'Reset Hotbar Profiles':'Clean Up Legacy Hotbar Data';
  const explanation=isReset
    ? '<p><strong>Destructive:</strong> Deletes hotbar assignments, custom profiles, divider labels and slot colors. Recreates empty Combat, Exploration and Support profiles. Favorites, Recent and HUD preferences are preserved.</p>'
    : '<p>Removes only empty legacy Default profiles and redundant old hotbar flags. Populated Default profiles and all existing assignments remain intact.</p>';
  const content=`${actorDetails(scope,actors.length,actors)}<p>Characters to change: <strong>${affected.length}</strong>.<br>Empty Default profiles: ${empty}.<br>Populated Default profiles preserved by cleanup: ${populatedCount}.</p>${explanation}<p>A JSON backup download starts <strong>before</strong> any Actor is modified. Verify that your browser permits downloads.</p>`;
  const confirmed=await foundry.applications.api.DialogV2.confirm({
    window:{title},modal:true,content,yes:{label:'Back Up and Continue'},no:{label:'Cancel'}
  });
  if (!confirmed) return {updated:0,failed:0,cancelled:true};
  // Preview can become stale while a modal is open: re-inspect before mutation.
  const final=affected.filter(({actor})=>operation==='cleanup'
    ? inspectHotbarMaintenance(actor).needsCleanup : inspectHotbarMaintenance(actor).needsReset).map(x=>x.actor);
  if (!final.length) {ui.notifications?.info('No changes required.');return {updated:0,failed:0};}
  try {downloadSnapshot(snapshot(final,operation,scope));}
  catch(error){console.error(LOG,'Backup download failed',error);ui.notifications?.error('Could not prepare hotbar backup; no character data changed.');return {updated:0,failed:0,backupFailed:true};}
  if (isReset) {
    // The backup is offered before the final destructive confirmation, so the
    // GM/player can verify it exists instead of racing straight into writes.
    const second=await foundry.applications.api.DialogV2.confirm({
      window:{title:scope==='all'?'Confirm World-Wide Hotbar Reset':'Confirm Character Hotbar Reset'},modal:true,
      content:`<p>Verify that the JSON backup has downloaded before continuing.</p><p>Reset hotbar profiles for <strong>${final.length}</strong> character(s)? This cannot be undone automatically.</p>`,
      yes:{label:scope==='all'?'Reset All Character Hotbars':'Reset Hotbar'},no:{label:'Cancel'}
    });
    if (!second) return {updated:0,failed:0,cancelled:true};
  }
  let updated=0;const failures=[];
  for (const target of final) {
    try {if(await updateHotbarMaintenance(target,operation)) updated++;}
    catch(error){failures.push({actor:target.name,error});console.error(LOG,`Cannot ${operation} ${target.name}`,error);}
  }
  onComplete();
  const result={updated,failed:failures.length};
  if(failures.length){
    ui.notifications?.warn(`Hotbar ${operation}: ${updated} updated, ${failures.length} failed. Check console. Keep the JSON backup.`);
  } else ui.notifications?.info(`Hotbar ${operation}: ${updated} character(s) updated. Keep the JSON backup.`);
  return result;
}
