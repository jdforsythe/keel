import type { Computed } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { applyStyle } from "../internal/applyStyle.ts";
import { controlId } from "../internal/controlId.ts";
import { isReadable } from "../internal/isReadable.ts";
import { labelled } from "../internal/labelled.ts";
import type { StyleProps } from "../types/StyleProps.ts";

type Option = { readonly value: string; readonly label: string };

/** A select with a visible `<label for>` (`label` required, E1802) and `options` as text nodes. */
export function Select(
  props: StyleProps & {
    readonly label: string;
    readonly id?: string;
    readonly name?: string;
    readonly options?: readonly Option[];
    readonly value?: string | Computed<string>;
  },
): Node {
  const el = document.createElement("select");
  if (props.name !== undefined) el.setAttribute("name", props.name);
  const v = props.value;
  for (const o of props.options ?? []) {
    const opt = document.createElement("option");
    opt.setAttribute("value", o.value);
    if (typeof v === "string" && v === o.value) opt.setAttribute("selected", "");
    opt.appendChild(document.createTextNode(o.label));
    el.appendChild(opt);
  }
  if (isReadable(v)) prop(el, "value", () => v.get());
  applyStyle(el, props);
  return labelled(el, controlId("select", props.label, props.id), props.label, false);
}
