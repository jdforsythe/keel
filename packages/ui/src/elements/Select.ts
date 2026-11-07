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

type Option = { readonly value: string; readonly label: string };

/** A select with a visible `<label for>` (`label` required, E1802) and `options` as text nodes. */
export function Select(
  props: StyleProps & {
    readonly label: string;
    readonly disabled?: boolean | Computed<boolean>;
    readonly id?: string;
    /** A k.forms field: binds name, id, value, aria wiring; renders its error under the control. */
    readonly field?: Field<unknown>;
    readonly name?: string;
    /** Called with the new value after the field update, if bound (RFC 0009). */
    readonly onChange?: (value: string) => void;
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
  // A reactive value's first value is also the default (rfc:0062): its option carries `selected`.
  if (isReadable(v))
    prop(
      el,
      "value",
      markFirst(
        () => v.get(),
        (x) =>
          Array.from(el.options)
            .find((o) => o.value === x)
            ?.setAttribute("selected", ""),
      ),
    );
  applyDisabled(el, props.disabled);
  applyStyle(el, props);
  const id = props.id ?? props.field?.id ?? controlId("select", props.label, undefined, el.ownerDocument);
  const out = labelled(el, id, props.label, false, props.field);
  const h = props.onChange;
  if (h !== undefined) listen(el, "change", () => h(el.value));
  return out;
}
