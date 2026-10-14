/** Portable character hotbar references to system-native check/roll actions.
 * No modifiers or resource state are persisted; adapters provide live presentation. */
const KINDS = Object.freeze(['skill', 'save', 'ability', 'tool']);
const CHECK_ID = /^[a-zA-Z0-9_.:-]{1,128}$/;

export function validCheckShortcut(kind, id) {
  return KINDS.includes(kind) && typeof id === 'string' && CHECK_ID.test(id);
}

export function makeCheckReference(kind, id, preview = null) {
  if (!validCheckShortcut(kind, id)) return null;
  return {kind: 'check', id: `check:${kind}:${id}`, checkKind: kind, checkId: id,
    name: String(preview?.name || `${kind} ${id}`).slice(0, 160)};
}

export function isCheckReference(ref) {
  return Boolean(ref && typeof ref === 'object' && ref.kind === 'check' &&
    validCheckShortcut(ref.checkKind, ref.checkId) &&
    ref.id === `check:${ref.checkKind}:${ref.checkId}`);
}
