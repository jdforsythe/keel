import type { Held } from "./Held.ts";

/** The held content a fragment returned by a resumed island's `children` stands for. */
export const heldOf = new WeakMap<Node, Held>();
