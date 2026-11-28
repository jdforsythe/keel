import type { PiiClass } from "./PiiClass.ts";

/** One marked leaf: its dotted path from the root (`*` for an array item or record value) and its class. */
export type PiiPath = { readonly path: string; readonly class: PiiClass };
