import type { PartState } from "../aria/PartState.ts";

/** The selectors each style state's rule is written under (k.aria Part styles); compiled CSS only. */
export function stateSelectors(state: PartState): readonly string[] {
  switch (state) {
    case "selected":
      return ['[aria-selected="true"]'];
    case "checked":
      return ['[aria-checked="true"]', ":checked"];
    case "pressed":
      return ['[aria-pressed="true"]'];
    case "expanded":
      return ['[aria-expanded="true"]'];
    case "current":
      return ['[aria-current]:not([aria-current="false"])'];
    case "highlighted":
      return ["[data-k-highlighted]"];
    case "hover":
      return [":hover"];
    case "focusVisible":
      return [":focus-visible"];
    case "active":
      return [":active"];
    case "disabled":
      return [":disabled", '[aria-disabled="true"]'];
  }
}
