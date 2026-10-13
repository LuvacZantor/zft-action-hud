/** Foundry Macro references belong to hotbar slots, not the D&D5e Item adapter. */
const UUID_PATTERN = /^(?:Macro\.[a-zA-Z0-9_-]+|Compendium\.[a-zA-Z0-9_.-]+\.Macro\.[a-zA-Z0-9_-]+)$/;

export function validMacroUuid(uuid) {
  return typeof uuid === 'string' && UUID_PATTERN.test(uuid);
}

export function isMacroReference(ref) {
  return Boolean(ref && typeof ref === 'object' && ref.kind === 'macro' &&
    validMacroUuid(ref.uuid) && ref.id === `macro:${ref.uuid}`);
}

export function macroUuidFromDrop(data) {
  if (!data || data.type !== 'Macro') return null;
  const uuid = typeof data.uuid === 'string' ? data.uuid :
    typeof data.id === 'string' ? `Macro.${data.id}` : null;
  return validMacroUuid(uuid) ? uuid : null;
}

export function macroDocumentSync(uuid) {
  if (!validMacroUuid(uuid)) return null;
  try {
    if (uuid.startsWith('Macro.')) return game.macros?.get?.(uuid.slice(6)) ?? null;
    return globalThis.fromUuidSync?.(uuid) ?? null;
  } catch { return null; }
}

export async function macroDocument(uuid) {
  const local = macroDocumentSync(uuid);
  if (local) return local;
  if (!validMacroUuid(uuid)) return null;
  try { return await globalThis.fromUuid?.(uuid) ?? null; }
  catch { return null; }
}

export function makeMacroReference(uuid, macro = null) {
  if (!validMacroUuid(uuid)) return null;
  return {
    kind: 'macro', id: `macro:${uuid}`, uuid,
    name: String(macro?.name || 'Macro'),
    img: String(macro?.img || 'icons/svg/dice-target.svg')
  };
}

export async function executeHotbarMacro(ref, { actor = null } = {}) {
  if (!isMacroReference(ref)) return { ok: false, reason: 'invalid' };
  const macro = await macroDocument(ref.uuid);
  if (!macro || typeof macro.execute !== 'function') return { ok: false, reason: 'missing' };
  // Native Foundry permission model decides who may execute a Macro. Never
  // elevate privileges or execute its command text in our own context.
  if (macro.canExecute === false ||
      macro.testUserPermission?.(game.user, 'LIMITED') === false) return { ok: false, reason: 'permission' };
  const token = canvas?.tokens?.controlled?.length === 1 ? canvas.tokens.controlled[0] : null;
  try {
    await macro.execute({ actor: actor || null, token });
    return { ok: true };
  } catch (error) {
    console.error('[ZFT] Action HUD Macro execution failed', error);
    return { ok: false, reason: 'error' };
  }
}
