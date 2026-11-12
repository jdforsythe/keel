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
import type { StyleProps } from "../types/StyleProps.ts";

/** A checkbox followed by its visible `<label for>` (`label` required, E1802). */
export function Checkbox(
  props: StyleProps & {
    readonly label: string;
    readonly disabled?: boolean | Computed<boolean>;
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
    /** A k.forms field: binds name, id, value, aria wiring; renders its error under the control. */
    readonly field?: Field<unknown>;
    readonly name?: string;
    /** Called with the new checked state after the field update, if bound (RFC 0009). */
    readonly onChange?: (checked: boolean) => void;
    readonly checked?: boolean | Computed<boolean>;
  },
): Node {
  return labelled("checkbox", props, true, (id) =>
    make("input", (el) => {
      el.setAttribute("type", "checkbox");
      el.setAttribute("id", id);
      applyIdLang(el, props, false);
      attrOf(el, "name", isGetter(props, "name"), () => props.name);
      const c = props.checked;
      // A reactive state's first value is also the default (rfc:0062).
      if (isReadable(c))
        prop(
          el,
          "checked",
          markFirst(
            el,
            "checked",
            () => c.get(),
            (x) => {
              if (x) el.setAttribute("checked", "");
            },
          ),
        );
      else {
        if (c === true) el.setAttribute("checked", "");
        if (isGetter(props, "checked"))
          prop(
            el,
            "checked",
            keptFirst(el, "checked", () => props.checked === true),
          );
      }
      applyDisabled(el, props);
      applyStyle(el, props);
      const h = props.onChange;
      if (h !== undefined) listen(el, "change", () => h(el.checked));
    }),
  );
}
