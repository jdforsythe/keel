import type { Computed } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { applyStyle } from "../internal/applyStyle.ts";
import { controlId } from "../internal/controlId.ts";
import { isReadable } from "../internal/isReadable.ts";
import { labelled } from "../internal/labelled.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/** A multi-line text control with a visible `<label for>` (`label` required, E1802). */
export function TextArea(
  props: StyleProps & {
    readonly label: string;
    readonly id?: string;
    readonly name?: string;
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
  applyStyle(el, props);
  return labelled(el, controlId("textarea", props.label, props.id), props.label, false);
}
