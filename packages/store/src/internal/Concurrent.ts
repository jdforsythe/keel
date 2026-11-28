/** What a transaction does with a concurrent write (its `base` is not the store's head): refuse it or apply it. */
export type Concurrent = "reject" | "rebase";
