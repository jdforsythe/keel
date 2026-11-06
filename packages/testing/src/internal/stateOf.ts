import type { A11yState } from "../types/A11yState.ts";

const CHECKABLE: ReadonlySet<string> = new Set(["checkbox", "radio", "switch", "menuitemcheckbox", "menuitemradio"]);
const DISABLEABLE: ReadonlySet<string> = new Set([
  "button",
  "fieldset",
  "input",
  "optgroup",
  "option",
  "select",
  "textarea",
]);

/** ARIA state from attributes and live properties; a key appears only when it applies to the element. */
export function stateOf(el: Element, role: string): A11yState {
  const aria = (name: string): string | null => el.getAttribute(`aria-${name}`);
  const tag = el.tagName.toLowerCase();
  const state: {
    checked?: boolean;
    disabled?: boolean;
    expanded?: boolean;
    selected?: boolean;
    invalid?: boolean;
    focused?: boolean;
  } = {};
  if ((DISABLEABLE.has(tag) && el.hasAttribute("disabled")) || aria("disabled") === "true") state.disabled = true;
  if (CHECKABLE.has(role)) {
    const checked = aria("checked");
    state.checked = checked === null ? Reflect.get(el, "checked") === true : checked === "true";
  }
  const expanded = aria("expanded");
  if (expanded !== null) state.expanded = expanded === "true";
  else if (tag === "details") state.expanded = el.hasAttribute("open");
  const selected = aria("selected");
  if (selected !== null) state.selected = selected === "true";
  else if (tag === "option") state.selected = Reflect.get(el, "selected") === true;
  const invalid = aria("invalid");
  if (invalid !== null && invalid !== "false") state.invalid = true;
  if (el.ownerDocument.activeElement === el) state.focused = true;
  return state;
}
