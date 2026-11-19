import { transaction } from "@keel/store";
import { ToastText } from "./ToastText.schema.ts";
import type { Toasts } from "./Toasts.schema.ts";
import { toasts } from "./toasts.ts";

/** Shows a status toast with id `toast<next>` and counts `next` up. */
export const raiseToast = transaction(toasts, "recipes.raiseToast", ToastText, (state, payload) => {
  const toast: Toasts["items"][number] = { id: `toast${state.next}`, text: payload.text, tone: "status" };
  return { next: state.next + 1, items: [...state.items, toast] };
});
