/**
 * Make-before-place checking (k.claim Server, Client): while `on`, each element the runtime makes gets the next
 * `seq` as its stamp, and an op placing an element stamped after `from` and at or before the op's start sets `eager`.
 * The server turns it on for each level's render, an island's client re-render for its own.
 */
export const made: { on: boolean; seq: number; from: number; eager: boolean; readonly stamps: WeakMap<Node, number> } =
  {
    on: false,
    seq: 0,
    from: 0,
    eager: false,
    stamps: new WeakMap(),
  };
