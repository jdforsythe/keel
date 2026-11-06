import type { Computed } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { applyStyle } from "../internal/applyStyle.ts";
import { controlId } from "../internal/controlId.ts";
import { isReadable } from "../internal/isReadable.ts";
import { labelled } from "../internal/labelled.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/** A checkbox followed by its visible `<label for>` (`label` required, E1802). */
export function Checkbox(
  props: StyleProps & {
    readonly label: string;
    readonly id?: string;
    readonly name?: string;
    readonly checked?: boolean | Computed<boolean>;
  },
): Node {
  const el = document.createElement("input");
  el.setAttribute("type", "checkbox");
  if (props.name !== undefined) el.setAttribute("name", props.name);
  const c = props.checked;
  if (isReadable(c)) prop(el, "checked", () => c.get());
  else if (c === true) el.setAttribute("checked", "");
  applyStyle(el, props);
  return labelled(el, controlId("checkbox", props.label, props.id), props.label, true);
}
