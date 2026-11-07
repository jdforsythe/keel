import { edited } from "./edited.ts";

/**
 * Wrap a control's `name` binding so that its first value also runs `mark`, which writes it as the control's markup
 * default (the `value` attribute, text, `selected`, `checked`; rfc:0062): server HTML shows it, and later values
 * change the property only, as a browser keeps a default apart from the user's edits. A control the user changed
 * before resume keeps its state on that first run (rfc:0064): no default is written, the property stays.
 */
export function markFirst<T>(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  name: "value" | "checked",
  read: () => T,
  mark: (v: T) => void,
): () => unknown {
  let first = true;
  return () => {
    const v = read();
    if (!first) return v;
    first = false;
    if (edited(el)) return Reflect.get(el, name);
    mark(v);
    return v;
  };
}
