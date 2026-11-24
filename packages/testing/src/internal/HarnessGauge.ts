/**
 * The harness calls in progress on a `simulate` run's ctxs, in start order: each says whether it waits on nothing but
 * an unanswered route, and `ready` resolves it (k.drive Driving).
 */
export interface HarnessGauge {
  readonly calls: Set<{ readonly stalled: () => boolean; readonly ready: () => void }>;
}
