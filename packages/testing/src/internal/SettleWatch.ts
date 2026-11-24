/**
 * What a `settle` reports to the `simulate` run whose clock its ctx shares: `watch()` marks a harness call in progress
 * and returns its handle; `stalled(probe)` gives the question the drive asks on its own turn, true while the call
 * waits on nothing but an unanswered route (k.drive Driving), `null` for none; `end()` says it is over.
 */
export type SettleWatch = () => {
  readonly stalled: (probe: (() => boolean) | null) => void;
  readonly end: () => void;
};
