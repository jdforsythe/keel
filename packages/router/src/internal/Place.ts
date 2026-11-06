import type { Rec } from "./Rec.ts";

/** The route part of `route.get()` (everything but `pending`). */
export type Place = { readonly id: string | null; readonly params: Rec; readonly search: Rec };
