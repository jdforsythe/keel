import type { Scope } from "../types/Scope.ts";
/**
 * One graph node. Signals have no `fn`; computeds, effects and resources do (it returns "value changed");
 * scopes only own children. Effects and resources are pushed by the commit, never pulled by a read.
 */
export interface Node {
  /** Stable per module instance, increasing in creation order. */
  id: number;
  kind: "signal" | "computed" | "effect" | "resource" | "scope";
  fn: (() => boolean) | undefined;
  sources: Node[];
  observers: Node[];
  state: number;
  owner: Node | null;
  owned: Node[];
  writes: readonly unknown[];
  gone: boolean;
  /** Scope nodes only: the public handle. */
  handle?: Scope;
  /** Scope nodes only: callbacks run on dispose. */
  hooks?: (() => void)[] | undefined;
  /** Scope nodes only: receives errors thrown by effects/computeds it owns. */
  onError?: ((error: unknown) => void) | undefined;
  /** Effect-like nodes only: threw into an `onError`; never runs again. */
  failed?: boolean;
  /** Computed nodes only: its last run threw, so it stayed Dirty while its readers ran; the next change marks them. */
  threw?: boolean;
}
