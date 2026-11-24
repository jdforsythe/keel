/**
 * What a `settle` reports to the `simulate` run whose clock its ctx shares (k.drive Driving): `watch(stalled)` marks a
 * harness call in progress, `stalled` true while it waits on nothing but an unanswered route; `ready` resolves on the
 * drive turn where nothing of the run is pending but harness calls in progress, and `end()` says the call is over.
 * Outside `simulate` it gives `undefined`.
 */
export type SettleWatch = (
  stalled: () => boolean,
) => { readonly ready: Promise<void>; readonly end: () => void } | undefined;
