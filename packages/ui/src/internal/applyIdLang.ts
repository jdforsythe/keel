import { attrOf } from "./attrOf.ts";
import { isGetter } from "./isGetter.ts";

/** The `id` and `lang` attributes of an element from its props, bound when they are getters. */
export function applyIdLang(el: Element, props: { readonly id?: string; readonly lang?: string }, id = true): void {
  if (id) attrOf(el, "id", isGetter(props, "id"), () => props.id);
  attrOf(el, "lang", isGetter(props, "lang"), () => props.lang);
}
