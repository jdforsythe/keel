import { transaction } from "@keel/store";
import { ToastRef } from "./ToastRef.schema.ts";
import { toasts } from "./toasts.ts";

/** Removes the toast with this id; an unknown id leaves the toasts unchanged. */
export const dismissToast = transaction(toasts, "recipes.dismissToast", ToastRef, (state, payload) => ({
  next: state.next,
  items: state.items.filter((t) => t.id !== payload.id),
}));
