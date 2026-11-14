import type { PartState } from "../aria/PartState.ts";

/**
 * Style states in cascade order (later wins): class-name segment and the selectors the rule is written under. The
 * widget states (`selected`, `checked`, `expanded`, `highlighted`) are taken by `Part` and part styles (k.aria).
 */
export const states: readonly { readonly key: PartState; readonly segment: string; readonly sel: readonly string[] }[] =
  [
    { key: "selected", segment: "selected", sel: ['[aria-selected="true"]'] },
    { key: "checked", segment: "checked", sel: ['[aria-checked="true"]', ":checked"] },
    { key: "expanded", segment: "expanded", sel: ['[aria-expanded="true"]'] },
    { key: "highlighted", segment: "highlighted", sel: ["[data-k-highlighted]"] },
    { key: "hover", segment: "hover", sel: [":hover"] },
    { key: "focusVisible", segment: "focus", sel: [":focus-visible"] },
    { key: "active", segment: "active", sel: [":active"] },
    { key: "disabled", segment: "disabled", sel: [":disabled"] },
  ];
