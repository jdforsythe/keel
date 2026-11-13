import axe from "axe-core";
import type { AxeRuleInfo } from "../src/internal/AxeRuleInfo.ts";
import { unsafe } from "./unsafe.ts";

interface Audit {
  readonly rules: readonly AxeRuleInfo[];
}

/** Every rule axe-core 4.14.0 loads, with its tags and default `enabled` (axe's `getRules` omits `enabled`). */
export function axeRuleList(): readonly AxeRuleInfo[] {
  return unsafe(
    "axe-core's typings omit `_audit`, the loaded audit whose rules carry `enabled`; the version is pinned to 4.14.0, where each rule has `id`, `tags` and `enabled`",
    () => {
      const audit = Reflect.get(axe, "_audit") as Audit;
      return audit.rules.map((r) => ({ id: r.id, tags: [...r.tags], enabled: r.enabled }));
    },
  );
}
