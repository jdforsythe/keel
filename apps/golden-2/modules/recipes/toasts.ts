import { invariant, store } from "@keel/store";
import { Toasts } from "./Toasts.schema.ts";

/** The toasts `BoxShell`'s Toaster shows; pages raise them through `raiseToast`. */
export const toasts = store(Toasts, { next: 1, items: [] }, { id: "recipes.toasts" });

invariant(toasts, (state) => new Set(state.items.map((t) => t.id)).size === state.items.length);
