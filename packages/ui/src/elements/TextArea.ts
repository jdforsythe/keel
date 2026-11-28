import type { Field } from "@keel/forms";
import type { Computed } from "@keel/reactive";
import { element, prop } from "@keel/runtime-dom/ops";
import { applyDisabled } from "../internal/applyDisabled.ts";
import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { attrOf } from "../internal/attrOf.ts";
import { isGetter } from "../internal/isGetter.ts";
import { isReadable } from "../internal/isReadable.ts";
import { keptFirst } from "../internal/keptFirst.ts";
import { labelled } from "../internal/labelled.ts";
import { listen } from "../internal/listen.ts";
import { markFirst } from "../internal/markFirst.ts";
import { plain } from "../internal/plain.ts";
import type { Autofill } from "../types/Autofill.ts";
import type { ControlStyles } from "../types/ControlStyles.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/** A multi-line text control with a visible `<label for>` (`label` required, E1802). */
export function TextArea(
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
    readonly rows?: number;
    readonly value?: string | Computed<string>;
  },
): Node {
  // Not `make`: a claimed textarea's text is its markup default, kept for `edited` (rfc:0064).
  return labelled("textarea", props, false, (id) =>
    element("textarea", (el) => {
      el.setAttribute("id", id);
      applyIdLang(el, props, false);
      attrOf(el, "name", isGetter(props, "name"), () => props.name);
      attrOf(el, "autocomplete", isGetter(props, "autocomplete"), () => props.autocomplete);
      attrOf(el, "rows", isGetter(props, "rows"), () => props.rows);
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
      else {
        if (v !== undefined) el.textContent = v;
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
