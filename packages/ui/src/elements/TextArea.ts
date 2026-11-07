import type { Field } from "@keel/forms";
import type { Computed } from "@keel/reactive";
import { element, prop } from "@keel/runtime-dom/ops";
import { applyDisabled } from "../internal/applyDisabled.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { isReadable } from "../internal/isReadable.ts";
import { labelled } from "../internal/labelled.ts";
import { listen } from "../internal/listen.ts";
import { markFirst } from "../internal/markFirst.ts";
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
  // Not `make`: a claimed textarea's text is its markup default, kept for `edited` (rfc:0064).
  return labelled("textarea", props, false, (id) =>
    element("textarea", (el) => {
      el.setAttribute("id", id);
      if (props.name !== undefined) el.setAttribute("name", props.name);
      if (props.rows !== undefined) el.setAttribute("rows", String(props.rows));
      const v = props.value;
      // A reactive value's first value is also the default text (rfc:0062).
      if (isReadable(v))
        prop(
          el,
          "value",
          markFirst(
            el,
            "value",
            () => v.get(),
            (x) => {
              el.textContent = x;
            },
          ),
        );
      else if (v !== undefined) el.textContent = v;
      applyDisabled(el, props.disabled);
      applyStyle(el, props);
      const h = props.onInput;
      if (h !== undefined) listen(el, "input", () => h(el.value));
    }),
  );
}
