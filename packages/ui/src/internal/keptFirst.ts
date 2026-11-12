import { edited } from "./edited.ts";

/**
 * The read of a `value` or `checked` binding for a getter prop: every run reads (and so tracks) `read`; the first
 * keeps the property of a control the user changed before resume, later runs write the new value.
 */
export function keptFirst<T>(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  name: "value" | "checked",
  read: () => T,
): () => unknown {
  let first = true;
  return () => {
    const v = read();
    if (!first) return v;
    first = false;
    return edited(el) ? Reflect.get(el, name) : v;
  };
}
