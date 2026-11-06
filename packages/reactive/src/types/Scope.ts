/** Ownership scope; `dispose()` disposes everything created inside it, nested scopes included. Idempotent. */
export interface Scope {
  dispose(): void;
}
