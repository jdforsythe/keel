import type { Field } from "@keel/forms";
import { attr, text } from "@keel/runtime-dom/ops";
import { appendChildren } from "./appendChildren.ts";
import { attrOf } from "./attrOf.ts";
import { bound } from "./bound.ts";
import { controlId } from "./controlId.ts";
import { isGetter } from "./isGetter.ts";
import { make } from "./make.ts";

/**
 * A wrapper holding `control(id)` and a visible `<label for>` naming it (after a checkbox, before others). The id is
 * `props.id`, the field's, or `controlId`. With `field`, `field.bind(control)` owns name, id, value and aria wiring,
 * and the error text renders in an element with id `field.errorId` under the control (k.forms Bindings); both are
 * bound (`data-k`, rfc:0067). Nodes are
 * made in document order, so at resume each claims its server element (rfc:0064).
 */
export function labelled<C extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
  kind: string,
  props: { readonly label: string; readonly id?: string; readonly field?: Field<unknown> },
  after: boolean,
  control: (id: string) => C,
): Node {
  return make("div", (wrap) => {
    const first = props.id ?? props.field?.id ?? controlId(kind, props.label, undefined, wrap);
    // A getter `id` binds the control's id and the label's `for` (a field owns the id instead).
    const live = isGetter(props, "id") && props.field === undefined;
    const id = (): string => props.id ?? first;
    const label = (): Node =>
      make("label", (l) => {
        attrOf(l, "for", live, id);
        const t = l.appendChild(document.createTextNode(props.label));
        if (isGetter(props, "label")) text(t, () => props.label);
      });
    const l = after ? null : label();
    const c = control(first);
    if (live) attr(c, "id", id);
    const kids = l === null ? [c, label()] : [l, c];
    const field = props.field;
    if (field !== undefined) {
      bound(c);
      field.bind(c);
      kids.push(
        make("span", (msg) => {
          bound(msg);
          msg.setAttribute("id", field.errorId);
          msg.appendChild(document.createTextNode(""));
          text(msg, () => field.error() ?? "");
        }),
      );
    }
    appendChildren(wrap, kids);
  });
}
