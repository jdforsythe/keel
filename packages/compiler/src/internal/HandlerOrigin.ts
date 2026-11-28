import type { HandlerKind } from "./HandlerKind.ts";

/** The handlers a module specifier exports, by exported name; `undefined` for a module that exports none. */
export type HandlerOrigin = (source: string) => ReadonlyMap<string, HandlerKind> | undefined;
