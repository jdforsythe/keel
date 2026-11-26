import { effect, owner } from "@keel/reactive";
import { on, prop } from "@keel/runtime-dom/ops";
import type { Value } from "@keel/runtime-dom/ops";
import { appendChildren } from "../internal/appendChildren.ts";
import { applyIdLang } from "../internal/applyIdLang.ts";
import { applyStyle } from "../internal/applyStyle.ts";
import { ariaText } from "../internal/ariaText.ts";
import { bound } from "../internal/bound.ts";
import { isGetter } from "../internal/isGetter.ts";
import { isReadable } from "../internal/isReadable.ts";
import { listen } from "../internal/listen.ts";
import { make } from "../internal/make.ts";
import { put } from "../internal/put.ts";
import { renderChildren } from "../internal/renderChildren.ts";
import type { PartProps } from "./PartProps.ts";
import type { PartRole } from "./PartRole.ts";

type Tag =
  | "ul"
  | "li"
  | "input"
  | "button"
  | "div"
  | "dialog"
  | "nav"
  | "table"
  | "tbody"
  | "tr"
  | "th"
  | "td"
  | "meter"
  | "progress"
  | "section";

const TAGS: Readonly<Record<PartRole, Tag>> = {
  listbox: "ul",
  menu: "ul",
  option: "li",
  menuitem: "li",
  menuitemcheckbox: "li",
  combobox: "input",
  button: "button",
  checkbox: "input",
  tablist: "div",
  tab: "button",
  tabpanel: "div",
  dialog: "dialog",
  alertdialog: "dialog",
  status: "div",
  alert: "div",
  generic: "div",
  navigation: "nav",
  group: "div",
  table: "table",
  rowgroup: "tbody",
  row: "tr",
  columnheader: "th",
  rowheader: "th",
  cell: "td",
  grid: "table",
  gridcell: "td",
  tree: "ul",
  treeitem: "li",
  slider: "input",
  radiogroup: "div",
  radio: "input",
  switch: "button",
  toolbar: "div",
  menubar: "ul",
  menuitemradio: "li",
  meter: "meter",
  progressbar: "progress",
  region: "section",
};
/** The `type` of each role rendered as an `input`. */
const INPUT_TYPES: Readonly<Partial<Record<PartRole, string>>> = {
  checkbox: "checkbox",
  combobox: "text",
  slider: "range",
  radio: "radio",
};
/** Roles their tag already has, so no `role` attribute is written. */
const IMPLICIT =
  "button checkbox dialog generic navigation table rowgroup row columnheader rowheader cell slider radio meter progressbar region".split(
    " ",
  );
/** Props written as `aria-<lower-cased name>`. */
const ARIA =
  "label labelledBy describedBy controls activeDescendant orientation multiselectable selected expanded hasPopup rowCount colCount rowIndex sort readOnly current level setSize posInSet valueText required pressed".split(
    " ",
  );
/** Props of the native controls and of `columnheader` written as the HTML attribute of the same lower-cased name. */
const HTML = "min max step name abbr low high optimum".split(" ");
/** Roles that keep focus where it is on `mousedown`. */
const KEEP_FOCUS = "option menuitem menuitemcheckbox menuitemradio".split(" ");
const FOCUSABLE = 'button,input,select,textarea,a[href],[tabindex="0"]';

const read = (v: unknown): unknown => (isReadable(v) ? v.get() : v);
const flag = (v: unknown): Value => v === true;
const plain = (v: unknown): Value => (typeof v === "string" || typeof v === "number" ? v : null);

/**
 * The control's `value` (`slider`, `radio`) from prop `k`: written as the attribute, the markup default, and when it
 * is a signal, a computed or a getter also bound as the property, so later writes change what the control shows.
 */
function controlValue(el: HTMLElement, props: Readonly<Record<string, unknown>>): void {
  if (!("value" in props)) return;
  const first = plain(read(props.value));
  if (first !== null) el.setAttribute("value", String(first));
  if (isGetter(props, "value") || isReadable(props.value)) {
    if (isReadable(props.value)) bound(el);
    prop(el, "value", () => {
      const v = plain(read(props.value));
      return v === null ? "" : String(v);
    });
  }
}

/**
 * The element stdlib and app widgets are built from (k.aria, k.roles): `role` fixes the tag and the ARIA props it takes. A base
 * element in every k.ui sense: built through the runtime's `element`, so it resumes in place, and bound (`data-k`)
 * when it has an event prop, a `focus` or `open`, or a signal or computed.
 */
export function Part(props: PartProps): Node {
  const p: Readonly<Record<string, unknown>> = props;
  const role = props.role;
  const tag =
    role === "rowgroup" && props.head === true ? "thead" : role === "group" && props.list === true ? "ul" : TAGS[role];
  const fill = (el: HTMLElement): void => {
    const type = INPUT_TYPES[role];
    if (type !== undefined) el.setAttribute("type", type);
    if (tag === "button") el.setAttribute("type", "button");
    if (tag === "th") el.setAttribute("scope", role === "columnheader" ? "col" : "row");
    applyIdLang(el, props);
    if (!IMPLICIT.includes(role)) el.setAttribute("role", role);
    if (role === "combobox") el.setAttribute("aria-autocomplete", "list");
    for (const k of ARIA) put(el, p, k, `aria-${k.toLowerCase()}`, ariaText);
    for (const k of HTML) put(el, p, k, k, plain);
    put(el, p, "colSpan", "colspan", ariaText);
    put(el, p, "hidden", "hidden", flag);
    if (tag === "button" || tag === "input") put(el, p, "disabled", "disabled", flag);
    else put(el, p, "disabled", "aria-disabled", ariaText);
    put(el, p, "tabIndex", "tabindex", ariaText);
    if (role === "checkbox" || role === "radio") {
      const c = props.checked;
      if (c === true) el.setAttribute("checked", "");
      if (isReadable(c)) bound(el);
      prop(el, "checked", () => read(c) === true);
      if (role === "checkbox") prop(el, "indeterminate", () => read(c) === "mixed");
    } else put(el, p, "checked", "aria-checked", ariaText);
    if (role === "slider" || role === "radio") controlValue(el, p);
    if (role === "meter" || role === "progressbar") put(el, p, "value", "value", plain);
    if (role === "slider") {
      const input = props.onInput;
      listen(el, "input", input && (() => input(Number(Reflect.get(el, "value")))));
    }
    if (role === "radio") {
      const change = props.onChange;
      listen(el, "change", change && (() => change()));
    }
    if (role === "combobox") {
      const value = props.value;
      if (typeof value === "string") el.setAttribute("value", value);
      else if (value !== undefined) {
        bound(el);
        prop(el, "value", () => value.get());
      }
      const input = props.onInput;
      if (input !== undefined) listen(el, "input", () => input(String(Reflect.get(el, "value"))));
    }
    applyStyle(el, p);
    if ("children" in props) appendChildren(el, renderChildren(props.children));
    const key = props.onKey;
    if (key !== undefined)
      listen(el, "keydown", (e) => {
        if (
          e instanceof KeyboardEvent &&
          key({ key: e.key, shift: e.shiftKey, alt: e.altKey, mod: e.ctrlKey || e.metaKey })
        ) {
          // Handled: an ancestor part's `onKey` (a Dialog around a Menu) does not see it.
          e.preventDefault();
          e.stopPropagation();
        }
      });
    const click = props.onClick;
    listen(el, "click", click && (() => click()));
    const focusIn = props.onFocus;
    listen(el, "focus", focusIn && (() => focusIn()));
    const blur = props.onBlur;
    listen(el, "blur", blur && (() => blur()));
    if (KEEP_FOCUS.includes(role)) on(el, "mousedown", (e) => e.preventDefault());
    if (props.focus !== undefined) {
      bound(el);
      let was: boolean | undefined;
      effect(() => {
        const now = read(props.focus) === true;
        // After the commit: handlers that focus and blur run may commit transactions.
        if (was === false && now) queueMicrotask(() => el.focus());
        was = now;
      });
    }
    if ("activeDescendant" in props && props.activeDescendant !== undefined)
      highlight(el, () => read(props.activeDescendant));
  };
  if (role === "dialog" || role === "alertdialog") {
    const dismiss = props.onDismiss;
    return make("dialog", (el) => {
      fill(el);
      bound(el);
      let shown = false;
      let back: Element | null = null;
      // `returnFocus` names the trigger (a click may leave focus on `body`); gone, the element focused at open, else
      // `main` (`tabindex="-1"`), as after a navigation (k.head).
      const restore = (): void => {
        const doc = el.ownerDocument;
        const named = read(props.returnFocus);
        const to = [typeof named === "string" ? doc.getElementById(named) : null, back, doc.querySelector("main")].find(
          (x) => x instanceof HTMLElement && x.isConnected && x !== doc.body,
        );
        if (to instanceof HTMLElement) {
          if (to.localName === "main" && !to.hasAttribute("tabindex")) to.setAttribute("tabindex", "-1");
          to.focus();
        }
        back = null;
      };
      effect(() => {
        const open = read(props.open) === true;
        queueMicrotask(() => {
          if (!el.isConnected || open === shown) return;
          shown = open;
          if (open) {
            back = el.ownerDocument.activeElement;
            el.showModal();
            const first = el.querySelector(FOCUSABLE);
            if (first instanceof HTMLElement) first.focus();
            else {
              el.setAttribute("tabindex", "-1");
              el.focus();
            }
          } else {
            if (el.open) el.close();
            restore();
          }
        });
      });
      // An open dialog removed with its scope (a confirm that deletes its own row) returns focus the same way, once
      // the DOM has settled, unless focus already went somewhere else.
      owner()?.onDispose(() => {
        if (!shown) return;
        shown = false;
        const doc = el.ownerDocument;
        queueMicrotask(() => {
          const a = doc.activeElement;
          if (a === null || a === doc.body || !a.isConnected || el.contains(a)) restore();
        });
      });
      on(el, "cancel", (e) => {
        e.preventDefault();
        dismiss?.();
      });
      on(el, "close", () => {
        if (read(props.open) === true) dismiss?.();
      });
    });
  }
  return make(tag, fill);
}

/** Marks the element `id()` names `data-k-highlighted` (the one before loses it) and scrolls it into view on a change. */
function highlight(el: Element, id: () => unknown): void {
  let lit: Element | null = null;
  let first = true;
  effect(() => {
    const at = id();
    const initial = first;
    first = false;
    queueMicrotask(() => {
      if (!el.isConnected) return;
      const t = typeof at === "string" && at !== "" ? el.ownerDocument.getElementById(at) : null;
      if (t === lit) return;
      lit?.removeAttribute("data-k-highlighted");
      t?.setAttribute("data-k-highlighted", "");
      lit = t;
      if (t !== null && !initial) t.scrollIntoView({ block: "nearest" });
    });
  });
}
