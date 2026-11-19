/** What `sourcesOf` returns for a transaction (k.prove): its declared function and its store's invariants. */
export type Sources<T, P> = {
  readonly fn: (state: T, payload: P) => T;
  readonly invariants: readonly ((state: T) => boolean)[];
};
