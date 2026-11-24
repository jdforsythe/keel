import { fail } from "./fail.ts";

/**
 * The `fire` action for `change` with `value`: a person's pick in a `<select>` without `multiple`. The enabled
 * option of that value becomes selected, then `input` (bubbling, composed) and `change` (bubbling) are dispatched at
 * the select; the option already selected dispatches nothing. E1726 on any other element, a `multiple` select, or no
 * enabled option of that value; nothing changes. The message never holds the value.
 */
export function pickOption(el: Element, value: string): () => void {
  if (!(el instanceof HTMLSelectElement) || el.multiple)
    throw fail("E1726", `${el.id} takes no value on change: not a single select`, { id: el.id, type: "change" });
  const option = Array.from(el.options).find((o) => o.value === value && !o.disabled && !disabledGroup(o));
  if (option === undefined)
    throw fail("E1726", `${el.id} has no enabled option with that value`, { id: el.id, type: "change" });
  return () => {
    if (option.selected) return;
    option.selected = true;
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
}

/** True when `option` sits in a disabled `<optgroup>`, which a person cannot pick from. */
function disabledGroup(option: HTMLOptionElement): boolean {
  const group = option.parentElement;
  return group instanceof HTMLOptGroupElement && group.disabled;
}
