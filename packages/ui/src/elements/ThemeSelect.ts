import { renderCtx } from "@keel/runtime-dom/internal";
import { reveal } from "@keel/runtime-dom/ops";
import { appearance } from "../appearance.ts";
import { appearanceOf } from "../internal/appearanceOf.ts";
import { appendChildren } from "../internal/appendChildren.ts";
import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { bound } from "../internal/bound.ts";
import { listen } from "../internal/listen.ts";
import { make } from "../internal/make.ts";
import type { ControlStyles } from "../types/ControlStyles.ts";
import type { StyleProps } from "../types/StyleProps.ts";

/** Exactly one of `label` (a visible `<label>`, also the select's `aria-label`) and `labelledBy` (an element id). */
type Named =
  | { readonly label: string; readonly labelledBy?: never }
  | { readonly labelledBy: string; readonly label?: never };

/**
 * The one control for a person's theme (k.schemes Choice), as `SchemeSelect` is for the scheme: a select with the
 * option `default` then each `choice` theme `appearance(ctx)` knows, in `themes` order, each option's text the string
 * `labels` holds under its name, else the name; its value `<html>`'s `data-k-theme` when that names an option, else
 * `default`. A pick goes through `appearance(ctx)`: a theme sets `data-k-theme` and writes `keel-theme=<name>` for a
 * year, `default` removes both. `labels` keys other than `default` and the themes are E1816 (`keel check`). Bound
 * (`data-k`); role class `k-control`; the wrapper renders `hidden` until the runtime mounts or resumes it.
 */
export function ThemeSelect(
  props: StyleProps &
    Named & {
      readonly id: string;
      readonly labels: Readonly<Record<string, string>>;
      /** Written as the `lang` attribute. */
      readonly lang?: string;
      /** Part styles: `field` the wrapper, `label` the `<label>`. */
      readonly styles?: ControlStyles;
    },
): Node {
  const ctx = renderCtx();
  const themes = ctx === undefined ? [] : appearanceOf(ctx).themes;
  const now = ctx === undefined ? "default" : appearance(ctx).theme();
  const control = (id: string): HTMLSelectElement =>
    make("select", (el) => {
      el.setAttribute("id", id);
      applyIdLang(el, props, false);
      if (props.label !== undefined) el.setAttribute("aria-label", props.label);
      if (props.labelledBy !== undefined) el.setAttribute("aria-labelledby", props.labelledBy);
      appendChildren(
        el,
        ["default", ...themes].map((t) =>
          make("option", (opt) => {
            opt.setAttribute("value", t);
            if (t === now) opt.setAttribute("selected", "");
            opt.appendChild(el.ownerDocument.createTextNode(props.labels[t] ?? t));
          }),
        ),
      );
      el.value = now;
      bound(el);
      applyStyle(el, props, "k-control");
      listen(el, "change", () => {
        if (ctx !== undefined) appearance(ctx).set({ theme: el.value });
      });
    });
  const label = props.label;
  const styles = props.styles;
  return make("div", (wrap) => {
    reveal(wrap);
    applyStyle(wrap, styles?.field ?? {});
    const kids: Node[] = [];
    if (label !== undefined)
      kids.push(
        make("label", (l) => {
          l.setAttribute("for", props.id);
          applyStyle(l, styles?.label ?? {}, "k-label");
          l.appendChild(l.ownerDocument.createTextNode(label));
        }),
      );
    kids.push(control(props.id));
    appendChildren(wrap, kids);
  });
}
