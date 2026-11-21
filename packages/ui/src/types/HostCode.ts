import type { HostOut } from "./HostOut.ts";

/** A started host element code: what the runtime calls while the element is mounted. */
type HostRunning<I> = {
  update(value: I, prev: I): void;
  dispose(): void;
};

/**
 * What a `Host`'s `code` resolves to (k.host-code), made by `hostCode` or `customElement`. The runtime calls `start`,
 * which runs `mount` and returns `update` and `dispose` closed over the code's own state. Written as methods, so a
 * `HostCode` of a narrower value is still a `HostCode<unknown, unknown>` where a `Host`'s props are not instantiated.
 */
export type HostCode<I, E = never> = {
  start(node: HTMLElement, value: I, out: HostOut<E>): HostRunning<I>;
};
