/** Shared three-state client position control for Action HUD and hotbar.
 * Click goes forward, context click goes backward; no RPG-specific data. */
export const POSITION_STATES = Object.freeze(['docked', 'floating', 'locked']);

export function currentPositionState(mode, floatingLocked = false) {
  return mode === 'floating' ? (floatingLocked ? 'locked' : 'floating') : 'docked';
}

export function nextPositionState(current, direction = 1) {
  const index = POSITION_STATES.indexOf(current);
  const start = index < 0 ? 0 : index;
  const step = direction === -1 ? -1 : 1;
  return POSITION_STATES[(start + step + POSITION_STATES.length) % POSITION_STATES.length];
}

export function positionControlPresentation(state, subject = 'HUD') {
  const forward = nextPositionState(state);
  const backward = nextPositionState(state, -1);
  const label = state === 'docked' ? 'Docked' : state === 'locked' ? 'Floating Locked' : 'Floating';
  const actionLabel = target => target === 'docked' ? 'dock' : target === 'locked' ? 'lock' : 'float';
  return {
    icon: state === 'docked' ? 'anchor' : state === 'locked' ? 'lock' : 'up-down-left-right',
    label: `${subject}: ${label}. Left-click to ${actionLabel(forward)}; right-click to ${actionLabel(backward)}.`,
    state, next: forward, previous: backward
  };
}
