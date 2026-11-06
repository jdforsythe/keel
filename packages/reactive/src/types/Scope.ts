/** Ownership scope; `dispose()` disposes everything created inside it, nested scopes included. Idempotent. */
export interface Scope {
  dispose(): void;
  /** The enclosing scope, if any. */
  readonly parent: Scope | undefined;
  /** Run `fn` once when this scope is disposed (immediately if it already is). */
  onDispose(fn: () => void): void;
}
