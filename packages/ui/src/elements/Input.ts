import type { Field } from "@keel/forms";
import type { Computed } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { applyDisabled } from "../internal/applyDisabled.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { isReadable } from "../internal/isReadable.ts";
import { labelled } from "../internal/labelled.ts";
import { listen } from "../internal/listen.ts";
import { make } from "../internal/make.ts";
import { markFirst } from "../internal/markFirst.ts";
import type { StyleProps } from "../types/StyleProps.ts";

type InputType = "text" | "email" | "password" | "number" | "search" | "tel" | "url" | "date";

/**
 * A text-like input with a visible `<label for>` (`label` required, E1802). Style props apply to the
 * control. `id` defaults to one derived from the label; a reactive `value` binds the `value` property and writes its
 * first value as the `value` attribute (not for `password`).
 */
export function Input(
  props: StyleProps & {
    readonly label: string;
    readonly disabled?: boolean | Computed<boolean>;
    readonly id?: string;
    /** A k.forms field: binds name, id, value, aria wiring; renders its error under the control. */
    readonly field?: Field<unknown>;
    readonly name?: string;
    /** Called with the new value after the field update, if bound (RFC 0009). */
    readonly onInput?: (value: string) => void;
    readonly type?: InputType;
    readonly value?: string | Computed<string>;
  },
): Node {
  return labelled("input", props, false, (id) =>
    make("input", (el) => {
      el.setAttribute("type", props.type ?? "text");
      el.setAttribute("id", id);
      if (props.name !== undefined) el.setAttribute("name", props.name);
      const v = props.value;
      // A reactive value's first value is also the default (rfc:0062); a password never enters the markup.
      if (isReadable(v))
        prop(
          el,
          "value",
          markFirst(
            el,
            "value",
            () => v.get(),
            (x) => {
              if (props.type !== "password") el.setAttribute("value", x);
            },
          ),
        );
      else if (v !== undefined) el.setAttribute("value", v);
      applyDisabled(el, props.disabled);
      applyStyle(el, props);
      const h = props.onInput;
      if (h !== undefined) listen(el, "input", () => h(el.value));
    }),
  );
}
