/** Ownership scope; `dispose()` disposes everything created inside it, nested scopes included. Idempotent. */
export interface Scope {
  dispose(): void;
  /** The enclosing scope, if any. */
  readonly parent: Scope | undefined;
  /** Run `fn` once when this scope is disposed (immediately if it already is). */
  onDispose(fn: () => void): void;
  /**
   * Run `fn` with this scope as the owner of what it creates (disposed with this scope), untracked: reads do not
   * subscribe the running computation; writes are still checked against its `writes` (E1201). Returns `fn()`'s
   * value; a throw propagates and the scope stays live. E1206 when this scope is disposed.
   */
  run<T>(fn: () => T): T;
}
