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
    checked?: boolean | "mixed";
    disabled?: boolean;
    expanded?: boolean;
    pressed?: boolean;
    selected?: boolean;
    invalid?: boolean;
    focused?: boolean;
    active?: string;
    sort?: string;
    rowindex?: number;
    rowcount?: number;
  } = {};
  if ((DISABLEABLE.has(tag) && el.hasAttribute("disabled")) || aria("disabled") === "true") state.disabled = true;
  if (CHECKABLE.has(role)) {
    const checked = aria("checked");
    state.checked =
      checked === "mixed" || (checked === null && Reflect.get(el, "indeterminate") === true)
        ? "mixed"
        : checked === null
          ? Reflect.get(el, "checked") === true
          : checked === "true";
  }
  const expanded = aria("expanded");
  if (expanded !== null) state.expanded = expanded === "true";
  else if (tag === "details") state.expanded = el.hasAttribute("open");
  const pressed = aria("pressed");
  if (pressed !== null) state.pressed = pressed === "true";
  const selected = aria("selected");
  if (selected !== null) state.selected = selected === "true";
  else if (tag === "option") state.selected = Reflect.get(el, "selected") === true;
  const invalid = aria("invalid");
  if (invalid !== null && invalid !== "false") state.invalid = true;
  if (el.ownerDocument.activeElement === el) state.focused = true;
  const active = aria("activedescendant");
  if (active !== null && active !== "") state.active = active;
  const sort = aria("sort");
  if (sort !== null) state.sort = sort;
  const int = (v: string | null): number | undefined =>
    v !== null && /^-?\d+$/.test(v.trim()) ? Number(v) : undefined;
  const rowindex = int(aria("rowindex"));
  if (rowindex !== undefined) state.rowindex = rowindex;
  const rowcount = int(aria("rowcount"));
  if (rowcount !== undefined) state.rowcount = rowcount;
  return state;
}
