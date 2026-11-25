/**
 * The scrub's matcher (`automatonOf`): a trie of the folded forms of a list of value sets with Aho-Corasick failure
 * links, in typed arrays indexed by node.
 */
export interface Automaton {
  /** Each code unit's image under case folding (`foldTable`); text and forms go through the same table. */
  readonly fold: Uint16Array;
  /** The child of `s` on the folded unit `c`, or -1; a binary search of at most 17 steps. */
  readonly go: (s: number, c: number) => number;
  readonly fail: Int32Array;
  /** The deepest node on a node's failure chain, itself included, where a form of 3 or more units ends, or -1. */
  readonly long: Int32Array;
  /** The same for a form of 1 or 2 units. */
  readonly short: Int32Array;
  readonly depth: Int32Array;
  /** -1 where no form ends; else the lowest index of a set holding a form that ends there. */
  readonly pass: Int32Array;
  /** Whether a match ending at the node takes in the character before it, and the one after it and any `=` then. */
  readonly before: Uint8Array;
  readonly after: Uint8Array;
}
