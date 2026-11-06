/** A store as resume sees it: `restore(snapshot)` from k-state (k.store `snapshot`/`restore`). */
export interface Restorable {
  restore(snapshot: unknown): void;
}
