import type { PartState } from "../aria/PartState.ts";

/**
 * Style states in cascade order (later wins) and each one's class-name segment. The widget states (`selected`,
 * `checked`, `pressed`, `expanded`, `current`, `highlighted`) are taken by `Part`, part styles and `look` and `base`
 * sets (k.aria Part styles). The selectors each is written under are `@keel/ui/css`'s alone (`stateSelectors`), so no
 * client bundle holds them.
 */
export const states: readonly { readonly key: PartState; readonly segment: string }[] = [
  { key: "selected", segment: "selected" },
  { key: "checked", segment: "checked" },
  { key: "pressed", segment: "pressed" },
  { key: "expanded", segment: "expanded" },
  { key: "current", segment: "current" },
  { key: "highlighted", segment: "highlighted" },
  { key: "hover", segment: "hover" },
  { key: "focusVisible", segment: "focus" },
  { key: "active", segment: "active" },
  { key: "disabled", segment: "disabled" },
];
