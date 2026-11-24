/** The harness calls in progress on a `simulate` run's ctxs; each says whether it waits on nothing but an unanswered route. */
export interface HarnessGauge {
  readonly calls: Set<{ stalled: () => boolean }>;
}
