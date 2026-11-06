import type { Bindable } from "./Bindable.ts";
import type { Node } from "./Node.ts";
import type { Reading } from "./Reading.ts";
import { coerceText } from "./coerceText.ts";
import { unwrap } from "./unwrap.ts";

/** Read a bound element for its field node. An unchecked radio reads as undefined (it does not speak for the field). */
export function readElement(el: Bindable, node: Node): Reading | undefined {
  if (el instanceof HTMLInputElement && el.type === "checkbox") {
    if (unwrap(node).kind === "boolean") return { kind: "value", value: el.checked };
    return el.checked ? coerceText(node, el.value) : { kind: "absent" };
  }
  if (el instanceof HTMLInputElement && el.type === "radio" && !el.checked) return undefined;
  return coerceText(node, el.value);
}
