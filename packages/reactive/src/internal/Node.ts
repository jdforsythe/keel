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
}
