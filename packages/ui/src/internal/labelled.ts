import type { Field } from "@keel/forms";
import { text } from "@keel/runtime-dom/ops";

/**
 * Wrap `control` with a visible `<label for>` naming it (after a checkbox, before others). With `field`,
 * `field.bind(control)` owns name, id, value and aria wiring, and the error text renders in an element
 * with id `field.errorId` under the control (k.forms Bindings).
 */
export function labelled(
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  id: string,
  label: string,
  after: boolean,
  field: Field<unknown> | undefined,
): Node {
  const wrap = document.createElement("div");
  const l = document.createElement("label");
  l.setAttribute("for", id);
  l.appendChild(document.createTextNode(label));
  control.setAttribute("id", id);
  if (after) wrap.append(control, l);
  else wrap.append(l, control);
  if (field !== undefined) {
    field.bind(control);
    const msg = document.createElement("span");
    msg.setAttribute("id", field.errorId);
    msg.appendChild(document.createTextNode(""));
    text(msg, () => field.error() ?? "");
    wrap.appendChild(msg);
  }
  return wrap;
}
