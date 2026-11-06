/**
 * One graph node. Signals have no `fn`; computeds and effects do (it returns "value changed");
 * scopes have neither sources nor `fn` and only own children.
 */
export interface Node {
  fn: (() => boolean) | undefined;
  sources: Node[];
  observers: Node[];
  state: number;
  effect: boolean;
  owner: Node | null;
  owned: Node[];
  writes: readonly unknown[];
  gone: boolean;
}
