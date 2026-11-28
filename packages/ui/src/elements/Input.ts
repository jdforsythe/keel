import type { Field } from "@keel/forms";
import type { Computed } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { applyDisabled } from "../internal/applyDisabled.ts";
import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { attrOf } from "../internal/attrOf.ts";
import { isGetter } from "../internal/isGetter.ts";
import { isReadable } from "../internal/isReadable.ts";
import { keptFirst } from "../internal/keptFirst.ts";
import { labelled } from "../internal/labelled.ts";
import { listen } from "../internal/listen.ts";
import { make } from "../internal/make.ts";
import { markFirst } from "../internal/markFirst.ts";
import { plain } from "../internal/plain.ts";
import type { Autofill } from "../types/Autofill.ts";
import type { ControlStyles } from "../types/ControlStyles.ts";
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
    /** The input purpose, written as the `autocomplete` attribute (k.a11y). */
    readonly autocomplete?: Autofill;
    readonly disabled?: boolean | Computed<boolean>;
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
    /** A k.forms field: binds name, id, value, aria wiring; renders its error under the control. */
    readonly field?: Field<unknown>;
    /** Part styles: `field` the wrapper, `label` the `<label>`, `error` the field error. */
    readonly styles?: ControlStyles;
    readonly name?: string;
    /** Called with the new value after the field update, if bound (RFC 0009). */
    readonly onInput?: (value: string) => void;
    readonly type?: InputType;
    readonly value?: string | Computed<string>;
  },
): Node {
  return labelled("input", props, false, (id) =>
    make("input", (el) => {
      attrOf(el, "type", isGetter(props, "type"), () => props.type ?? "text");
      el.setAttribute("id", id);
      applyIdLang(el, props, false);
      attrOf(el, "name", isGetter(props, "name"), () => props.name);
      attrOf(el, "autocomplete", isGetter(props, "autocomplete"), () => props.autocomplete);
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
      else {
        if (v !== undefined) el.setAttribute("value", v);
        if (isGetter(props, "value"))
          prop(
            el,
            "value",
            keptFirst(el, "value", () => plain(props.value)),
          );
      }
      applyDisabled(el, props);
      applyStyle(el, props, "k-control");
      const h = props.onInput;
      if (h !== undefined) listen(el, "input", () => h(el.value));
    }),
  );
}
