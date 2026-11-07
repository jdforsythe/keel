import type { Opened } from "./Opened.ts";

/** A request's instance of one `stores` factory: what the factory returned (`fn`'s `stores`) and its restored stores. */
export type Held = { readonly value: unknown; readonly opened: readonly Opened[] };
