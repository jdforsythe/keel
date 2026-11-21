/** What host element code is given at `mount` to report back (k.host-code): `emit(e)`, and `signal`, aborted after `dispose`. */
type Out<E> = { readonly emit: (e: E) => void; readonly signal: AbortSignal };

/** Host element code as the runtime calls it (`@keel/ui`'s `HostCode`): `start` runs `mount`. */
export type HostStart<I, E> = {
  start(node: HTMLElement, value: I, out: Out<E>): { update(value: I, prev: I): void; dispose(): void };
};
