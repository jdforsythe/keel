/** Node states, ordered: a mark only ever raises a node's state. */
export const State = { Clean: 0, Check: 1, Dirty: 2, Running: 3 } as const;
