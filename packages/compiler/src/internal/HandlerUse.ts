import type { HandlerKind } from "./HandlerKind.ts";

/** One use of a handler in a file (k.bundle Handlers): where, and which handlers it may be. */
export type HandlerUse = { readonly start: number; readonly kinds: ReadonlySet<HandlerKind> };
