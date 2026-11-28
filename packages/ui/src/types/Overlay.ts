import type { ColorValue } from "./ColorValue.ts";

/** An overlay token (k.values Overlays): an `<alpha>` color, or a `{ light, dark }` pair of them, and the 1 to 8 color tokens it may sit on. */
export type Overlay = { readonly value: ColorValue; readonly over: readonly string[] };
