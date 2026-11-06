import type { Field } from "@keel/forms";
import type { Computed } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { applyDisabled } from "../internal/applyDisabled.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { controlId } from "../internal/controlId.ts";
import { isReadable } from "../internal/isReadable.ts";
import { labelled } from "../internal/labelled.ts";
import { listen } from "../internal/listen.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/** A multi-line text control with a visible `<label for>` (`label` required, E1802). */
export function TextArea(
  props: StyleProps & {
    readonly label: string;
    readonly disabled?: boolean | Computed<boolean>;
    readonly id?: string;
    /** A k.forms field: binds name, id, value, aria wiring; renders its error under the control. */
    readonly field?: Field<unknown>;
    readonly name?: string;
    /** Called with the new value after the field update, if bound (RFC 0009). */
    readonly onInput?: (value: string) => void;
    readonly rows?: number;
    readonly value?: string | Computed<string>;
  },
): Node {
  const el = document.createElement("textarea");
  if (props.name !== undefined) el.setAttribute("name", props.name);
  if (props.rows !== undefined) el.setAttribute("rows", String(props.rows));
  const v = props.value;
  if (isReadable(v)) prop(el, "value", () => v.get());
  else if (v !== undefined) el.appendChild(document.createTextNode(v));
  applyDisabled(el, props.disabled);
  applyStyle(el, props);
  const id = props.field?.id ?? controlId("textarea", props.label, props.id, el.ownerDocument);
  const out = labelled(el, id, props.label, false, props.field);
  const h = props.onInput;
  if (h !== undefined) listen(el, "input", () => h(el.value));
  return out;
}
