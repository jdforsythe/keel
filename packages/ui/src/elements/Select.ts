import type { Field } from "@keel/forms";
import type { Computed } from "@keel/reactive";
import { effect } from "@keel/reactive";
import { prop } from "@keel/runtime-dom/ops";
import { appendChildren } from "../internal/appendChildren.ts";
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
import type { Autofill } from "../types/Autofill.ts";
import type { StyleProps } from "../types/StyleProps.ts";

type Option = { readonly value: string; readonly label: string };

/** A select with a visible `<label for>` (`label` required, E1802) and `options` as text nodes. */
export function Select(
  props: StyleProps & {
    readonly label: string;
    /** The input purpose, written as the `autocomplete` attribute (k.a11y). */
    readonly autocomplete?: Autofill;
    readonly disabled?: boolean | Computed<boolean>;
    readonly id?: string /** Written as the `lang` attribute. */;
    readonly lang?: string;
    /** A k.forms field: binds name, id, value, aria wiring; renders its error under the control. */
    readonly field?: Field<unknown>;
    readonly name?: string;
    /** Called with the new value after the field update, if bound (RFC 0009). */
    readonly onChange?: (value: string) => void;
    readonly options?: readonly Option[];
    readonly value?: string | Computed<string>;
  },
): Node {
  return labelled("select", props, false, (id) =>
    make("select", (el) => {
      el.setAttribute("id", id);
      applyIdLang(el, props, false);
      attrOf(el, "name", isGetter(props, "name"), () => props.name);
      attrOf(el, "autocomplete", isGetter(props, "autocomplete"), () => props.autocomplete);
      const v = props.value;
      const optionsOf = (os: readonly Option[] | undefined): Node[] =>
        (os ?? []).map((o) =>
          make("option", (opt) => {
            opt.setAttribute("value", o.value);
            const cur = isGetter(props, "value") ? props.value : v;
            if (typeof cur === "string" && cur === o.value) opt.setAttribute("selected", "");
            opt.appendChild(document.createTextNode(o.label));
          }),
        );
      let shown = props.options;
      appendChildren(el, optionsOf(shown));
      // A new options array replaces the options; a bound value is applied again, an unbound choice stays. The first
      // run only subscribes: a getter may return a new array for the options made above.
      let first = true;
      if (isGetter(props, "options"))
        effect(() => {
          const os = props.options;
          if (first || os === shown) {
            first = false;
            shown = os;
            return;
          }
          shown = os;
          const keep = isGetter(props, "value") && typeof props.value === "string" ? props.value : el.value;
          el.replaceChildren(...optionsOf(os));
          el.value = keep;
        });
      // A reactive value's first value is also the default (rfc:0062): its option carries `selected`.
      if (isReadable(v))
        prop(
          el,
          "value",
          markFirst(
            el,
            "value",
            () => v.get(),
            (x) =>
              Array.from(el.options)
                .find((o) => o.value === x)
                ?.setAttribute("selected", ""),
          ),
        );
      else if (isGetter(props, "value"))
        prop(
          el,
          "value",
          keptFirst(el, "value", () => (typeof props.value === "string" ? props.value : el.value)),
        );
      applyDisabled(el, props);
      applyStyle(el, props);
      const h = props.onChange;
      if (h !== undefined) listen(el, "change", () => h(el.value));
    }),
  );
}
