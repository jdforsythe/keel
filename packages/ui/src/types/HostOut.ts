/** What host element code is given at `mount` to report back (k.host-code): `emit(e)` and a `signal` that aborts after `dispose`. */
export type HostOut<E> = {
  readonly emit: (e: E) => void;
  readonly signal: AbortSignal;
};
