/** The harness calls in progress on a `simulate` run's ctxs, and how many of them wait only on an unanswered route. */
export interface HarnessGauge {
  active: number;
  stalled: number;
}
