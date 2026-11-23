import type { PartState } from "../aria/PartState.ts";
import type { StyleProp } from "./StyleProp.ts";

type Values = { readonly [P in StyleProp]?: string | Readonly<Record<string, string>> };

/**
 * A style set in `tokens.ts` (k.ui `base` and `look`): style props naming tokens (or keywords), responsive by
 * breakpoint (`{ base: '2', md: '3' }`), and `states`. Token names are checked when the CSS compiles (E1801).
 */
export type StyleSet = Values & { readonly states?: { readonly [S in PartState]?: Values } };
