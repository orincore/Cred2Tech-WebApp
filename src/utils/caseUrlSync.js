/**
 * What the wizards must do when the case id in the state and the case id in the URL (`?caseId=`) disagree.
 *
 * Normally they agree. They disagree for real when the user navigates (a different case, or "New Case"
 * dropping the id): then the wizard must load that case (`restore`) or start blank (`reset`).
 *
 * They ALSO disagree for a moment when the wizard creates a case itself (first "Request Consent" click):
 * it calls setCaseId(newId) and then navigate(`?caseId=newId`). React Router 7 runs navigations as
 * transitions, so the two updates do not necessarily land in the same render - for one render the state
 * already holds the new case while the URL still has none. Treating that as "the user left the case"
 * reset the whole wizard (blank form, consent request gone) and then reloaded the case from the server:
 * the page "refreshed", the URL changed, and Request Consent had to be clicked again.
 *
 * The wizard therefore remembers the id it just created (`selfCreatedCaseId`); a disagreement that is
 * only "the other side has not caught up yet" about THAT id is not an external change and is ignored.
 * Once state and URL agree on it the memory is cleared, so a later real navigation away from that same
 * case (e.g. "New Case") is handled normally.
 *
 * @returns {{ action: 'none'|'restore'|'reset', clearSelfCreated: boolean }}
 */
export function decideCaseUrlSync({ urlCaseId, caseId, selfCreatedCaseId = null }) {
  const url = urlCaseId || null;
  const id = caseId == null ? null : String(caseId);
  const self = selfCreatedCaseId == null ? null : String(selfCreatedCaseId);

  if (url === id) return { action: 'none', clearSelfCreated: self !== null && self === id };

  // The case this wizard just created: state and URL are simply not in the same render yet.
  if (self && ((id === self && url === null) || (url === self && id === null))) {
    return { action: 'none', clearSelfCreated: false };
  }

  return { action: url ? 'restore' : 'reset', clearSelfCreated: false };
}
