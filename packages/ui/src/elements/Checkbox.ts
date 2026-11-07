import type { Field } from "@keel/forms";
import type { Computed } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { applyDisabled } from "../internal/applyDisabled.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { controlId } from "../internal/controlId.ts";
import { isReadable } from "../internal/isReadable.ts";
import { labelled } from "../internal/labelled.ts";
import { listen } from "../internal/listen.ts";
import { markFirst } from "../internal/markFirst.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/** A checkbox followed by its visible `<label for>` (`label` required, E1802). */
export function Checkbox(
  props: StyleProps & {
    readonly label: string;
    readonly disabled?: boolean | Computed<boolean>;
    readonly id?: string;
    /** A k.forms field: binds name, id, value, aria wiring; renders its error under the control. */
    readonly field?: Field<unknown>;
    readonly name?: string;
    /** Called with the new checked state after the field update, if bound (RFC 0009). */
    readonly onChange?: (checked: boolean) => void;
    readonly checked?: boolean | Computed<boolean>;
  },
): Node {
  const el = document.createElement("input");
  el.setAttribute("type", "checkbox");
  if (props.name !== undefined) el.setAttribute("name", props.name);
  const c = props.checked;
  // A reactive state's first value is also the default (rfc:0062).
  if (isReadable(c))
    prop(
      el,
      "checked",
      markFirst(
        () => c.get(),
        (x) => {
          if (x) el.setAttribute("checked", "");
        },
      ),
    );
  else if (c === true) el.setAttribute("checked", "");
  applyDisabled(el, props.disabled);
  applyStyle(el, props);
  const id = props.id ?? props.field?.id ?? controlId("checkbox", props.label, undefined, el.ownerDocument);
  const out = labelled(el, id, props.label, true, props.field);
  const h = props.onChange;
  if (h !== undefined) listen(el, "change", () => h(el.checked));
  return out;
}
