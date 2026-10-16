/* Three different endings. None of them may be described as done
   when a required step failed. */

export function deletionCopy(action, mode) {
  const cloud = mode === 'cloud' || mode === 'rest';
  if (action === 'device') {
    return {
      title: 'Clear this browser?',
      body: cloud
        ? 'This removes the cached copy, Todoist token, coach keys, and calendar access on this browser. The account, and the workspace on the server, stay.'
        : 'This profile lives only in this browser. Clearing it deletes the tasks here. There is no second copy.',
      confirm: 'Clear this browser',
      success: cloud
        ? 'Cleared on this browser. The account still has the workspace.'
        : 'Cleared on this browser.',
      failure: 'This browser was not cleared.'
    };
  }
  if (action === 'workspace') {
    return {
      title: 'Delete this workspace?',
      body: cloud
        ? 'This deletes tasks, notes, and history for this account, on this browser and on the server. The sign-in stays. This does not delete the account.'
        : 'This deletes the tasks and history of this profile. The sign-in stays.',
      confirm: 'Delete the workspace',
      success: 'The workspace is deleted. You are still signed in.',
      failure: 'The workspace was not deleted.'
    };
  }
  return {
    title: 'Delete this account?',
    body: cloud
      ? 'This deletes the sign-in, workspace, history, public card, username, leaderboard entry, feedback, owned rooms and desks, trusted summaries, and room or desk memberships saved on this device. If the server refuses a required step, the account stays. A room membership known only to another device may still need its host to remove it.'
      : 'This deletes the local profile and its tasks on this browser. It does not delete a Google or email account.',
    confirm: 'Delete the account',
    success: cloud ? 'The account is deleted.' : 'The local profile is deleted.',
    failure: 'The account was not deleted.'
  };
}

export const CLOUD_WORKSPACE_DELETE_REQUIRED = Object.freeze([
  'workspace', 'history', 'legacy history'
]);

export const CLOUD_ACCOUNT_DELETE_REQUIRED = Object.freeze([
  ...CLOUD_WORKSPACE_DELETE_REQUIRED,
  'public card', 'leaderboard', 'username', 'study rooms', 'shared desks',
  'trusted summaries', 'feedback'
]);

/** Required steps gate the success sentence. Optional misses are named,
    but they do not turn a finished account deletion into a success if the
    sign-in itself failed. */
export function summariseSteps(steps, required) {
  const list = Array.isArray(steps) ? steps : [];
  const need = required && required.length ? required : list.map((step) => step.name);
  const failed = list.filter((step) => step && !step.ok && need.includes(step.name));
  if (!failed.length) return { ok: true, failed: [], message: '' };
  const names = failed.map((step) => step.name).join(', ');
  return {
    ok: false,
    failed: failed.map((step) => step.name),
    message: 'Not finished. ' + names + ' did not succeed, so this was not deleted.'
  };
}
