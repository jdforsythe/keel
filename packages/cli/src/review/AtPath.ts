import type { Raw } from "./Raw.ts";

/** A raw escape and the git-root path it sits at. */
export type AtPath = { readonly path: string; readonly raw: Raw };
