import type { Computed } from "@keel/reactive";

/** Element children: text (always a text node), DOM nodes, reactive text, or a list of these. */
export type Child = string | number | Node | Computed<string | number> | readonly Child[];
