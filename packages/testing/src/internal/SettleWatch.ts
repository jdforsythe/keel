/**
 * What a `settle` reports to the `simulate` run whose clock its ctx shares: `watch()` marks a harness call in progress
 * and returns its handle; `stalled(true)` says the call waits on nothing but an unanswered route (it is stalled on
 * `ctx.net`), `stalled(false)` that it moves again; `end()` says it is over.
 */
export type SettleWatch = () => { readonly stalled: (on: boolean) => void; readonly end: () => void };
