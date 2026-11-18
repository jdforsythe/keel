/**
 * A store as resume sees it: `restore(snapshot)` from k-state (k.store `snapshot`/`restore`). A returned refusal
 * (`{ ok: false }`) is an E1253 warning of `resume`.
 */
export interface Restorable {
  restore(snapshot: unknown): void;
}
