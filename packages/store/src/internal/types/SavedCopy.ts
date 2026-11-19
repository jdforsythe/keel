import type { Saved } from "./Saved.ts";

/**
 * The in-process copy of one `ctx.storage` (`copyOf`, k.persist Server saves): for each key a `stores` factory's store
 * was restored from or saved to, the value last read or committed and its parse. It only spares parsing a value read
 * again: it is reused when `read` returns the same text, and it decides no conflict.
 */
export type SavedCopy = { readonly saved: Map<string, Saved> };
