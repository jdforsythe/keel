import { reveal } from "@keel/runtime-dom/ops";
import { appendChildren } from "../internal/appendChildren.ts";
import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { bound } from "../internal/bound.ts";
import { listen } from "../internal/listen.ts";
import { make } from "../internal/make.ts";
import type { ControlStyles } from "../types/ControlStyles.ts";
import type { StyleProps } from "../types/StyleProps.ts";

const CHOICES = ["system", "light", "dark"] as const;
type Choice = (typeof CHOICES)[number];
/** A year, the cookie's lifetime when a person picks a scheme. */
const YEAR = 31536000;

/** The words of the three options, from the app's message set. */
type Labels = { readonly system: string; readonly light: string; readonly dark: string };
/** Exactly one of `label` (a visible `<label>`, also the select's `aria-label`) and `labelledBy` (an element id). */
type Named =
  | { readonly label: string; readonly labelledBy?: never }
  | { readonly labelledBy: string; readonly label?: never };

/** `<html>`'s `data-k-scheme` when it is `light` or `dark`, else `system`. */
const current = (doc: Document): Choice => {
  const v = doc.documentElement.getAttribute("data-k-scheme");
  return v === "light" || v === "dark" ? v : "system";
};

/** Apply a pick: the attribute on `<html>` and the `keel-scheme` cookie (k.schemes Choice); the cookie holds no identifier. */
const pick = (doc: Document, v: string): void => {
  const secure = doc.location?.protocol === "https:" ? "; Secure" : "";
  if (v === "light" || v === "dark") {
    doc.documentElement.setAttribute("data-k-scheme", v);
    doc.cookie = `keel-scheme=${v}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`;
  } else {
    doc.documentElement.removeAttribute("data-k-scheme");
    doc.cookie = `keel-scheme=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }
};

/**
 * The one control for a person's color scheme (k.schemes Choice): a select with the options `system`, `light` and
 * `dark` in that order, worded by `labels`, its value `<html>`'s `data-k-scheme` else `system`. Picking `light` or
 * `dark` sets the attribute and writes `keel-scheme=<value>; Path=/; Max-Age=31536000; SameSite=Lax` (`; Secure` on
 * https); picking `system` removes the attribute and expires the cookie. Bound (`data-k`); role class `k-control`.
 * Its wrapper, holding the label and the select, renders `hidden` until the runtime mounts or resumes it.
 */
export function SchemeSelect(
  props: StyleProps &
    Named & {
      readonly id: string;
      readonly labels: Labels;
      /** Written as the `lang` attribute. */
      readonly lang?: string;
      /** Part styles: `field` the wrapper, `label` the `<label>`. */
      readonly styles?: ControlStyles;
    },
): Node {
  const control = (id: string): HTMLSelectElement =>
    make("select", (el) => {
      el.setAttribute("id", id);
      applyIdLang(el, props, false);
      if (props.label !== undefined) el.setAttribute("aria-label", props.label);
      if (props.labelledBy !== undefined) el.setAttribute("aria-labelledby", props.labelledBy);
      const now = current(el.ownerDocument);
      appendChildren(
        el,
        CHOICES.map((c) =>
          make("option", (opt) => {
            opt.setAttribute("value", c);
            if (c === now) opt.setAttribute("selected", "");
            opt.appendChild(el.ownerDocument.createTextNode(props.labels[c]));
          }),
        ),
      );
      el.value = now;
      bound(el);
      applyStyle(el, props, "k-control");
      listen(el, "change", () => pick(el.ownerDocument, el.value));
    });
  const label = props.label;
  const styles = props.styles;
  // The wrapper holds the label and the select, `hidden` until script runs (k.schemes Choice).
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
