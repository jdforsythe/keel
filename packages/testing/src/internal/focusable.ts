import { cannotBeFocused } from "./cannotBeFocused.ts";
import { inDisabledFieldset } from "./inDisabledFieldset.ts";

const FORM_CONTROLS: ReadonlySet<string> = new Set(["button", "input", "select", "textarea"]);
const EMBEDS: ReadonlySet<string> = new Set(["iframe", "embed", "object"]);

/**
 * True when a user can focus `el`: not hidden (`hidden`, `inert`, `display: none`, `visibility: hidden`, on the
 * element or an ancestor; `aria-hidden` does not count), not disabled (itself or by a disabled `fieldset`
 * outside its first `legend`), and a `button`, `input` other than `type="hidden"`, `select`, `textarea`, the
 * first `summary` of a `details`, an `a` or `area` with `href`, an `iframe`, `embed`, `object`, an `audio` or
 * `video` with `controls`, `contenteditable` other than `false`, or with a `tabindex` (any value: a script can
 * focus `tabindex="-1"`). Decided here because happy-dom focuses any element.
 */
export function focusable(el: Element): boolean {
  if (cannotBeFocused(el) || Reflect.get(el, "disabled") === true) return false;
  const tag = el.tagName.toLowerCase();
  if (FORM_CONTROLS.has(tag) && inDisabledFieldset(el)) return false;
  if (tag === "input" && el.getAttribute("type")?.toLowerCase() === "hidden") return false;
  const editable = el.getAttribute("contenteditable")?.toLowerCase();
  return (
    FORM_CONTROLS.has(tag) ||
    EMBEDS.has(tag) ||
    (tag === "summary" &&
      el.parentElement?.tagName.toLowerCase() === "details" &&
      Array.from(el.parentElement.children).find((c) => c.tagName.toLowerCase() === "summary") === el) ||
    ((tag === "a" || tag === "area") && el.hasAttribute("href")) ||
    ((tag === "audio" || tag === "video") && el.hasAttribute("controls")) ||
    (editable !== undefined && editable !== "false") ||
    el.hasAttribute("tabindex")
  );
}
