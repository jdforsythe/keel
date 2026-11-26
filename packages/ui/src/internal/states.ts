import type { PartState } from "../aria/PartState.ts";

/**
 * Style states in cascade order (later wins): class-name segment and the selectors the rule is written under. The
 * widget states (`selected`, `checked`, `pressed`, `expanded`, `current`, `highlighted`) are taken by `Part`, part styles
 * and `look` and `base` sets (k.aria Part styles).
 */
export const states: readonly { readonly key: PartState; readonly segment: string; readonly sel: readonly string[] }[] =
  [
    { key: "selected", segment: "selected", sel: ['[aria-selected="true"]'] },
    { key: "checked", segment: "checked", sel: ['[aria-checked="true"]', ":checked"] },
    { key: "pressed", segment: "pressed", sel: ['[aria-pressed="true"]'] },
    { key: "expanded", segment: "expanded", sel: ['[aria-expanded="true"]'] },
    { key: "current", segment: "current", sel: ['[aria-current]:not([aria-current="false"])'] },
    { key: "highlighted", segment: "highlighted", sel: ["[data-k-highlighted]"] },
    { key: "hover", segment: "hover", sel: [":hover"] },
    { key: "focusVisible", segment: "focus", sel: [":focus-visible"] },
    { key: "active", segment: "active", sel: [":active"] },
    { key: "disabled", segment: "disabled", sel: [":disabled", '[aria-disabled="true"]'] },
  ];
