import type { Field } from "@keel/forms";
import { text } from "@keel/runtime-dom/ops";
import { appendChildren } from "./appendChildren.ts";
import { controlId } from "./controlId.ts";
import { make } from "./make.ts";

/**
 * A wrapper holding `control(id)` and a visible `<label for>` naming it (after a checkbox, before others). The id is
 * `props.id`, the field's, or `controlId`. With `field`, `field.bind(control)` owns name, id, value and aria wiring,
 * and the error text renders in an element with id `field.errorId` under the control (k.forms Bindings). Nodes are
 * made in document order, so at resume each claims its server element (rfc:0064).
 */
export function labelled<C extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
  kind: string,
  props: { readonly label: string; readonly id?: string; readonly field?: Field<unknown> },
  after: boolean,
  control: (id: string) => C,
): Node {
  return make("div", (wrap) => {
    const id = props.id ?? props.field?.id ?? controlId(kind, props.label, undefined, wrap);
    const label = (): Node =>
      make("label", (l) => {
        l.setAttribute("for", id);
        l.appendChild(document.createTextNode(props.label));
      });
    const l = after ? null : label();
    const c = control(id);
    const kids = l === null ? [c, label()] : [l, c];
    const field = props.field;
    if (field !== undefined) {
      field.bind(c);
      kids.push(
        make("span", (msg) => {
          msg.setAttribute("id", field.errorId);
          msg.appendChild(document.createTextNode(""));
          text(msg, () => field.error() ?? "");
        }),
      );
    }
    appendChildren(wrap, kids);
  });
}
