import type { CheckSetup } from "./CheckSetup.ts";
import type { Violation } from "./Violation.ts";
import { assertArtifacts } from "./assertArtifacts.ts";
import { axe } from "./axe.ts";
import { contrastViolations } from "./contrastViolations.ts";
import { piiViolations } from "./piiViolations.ts";
import { recordCheck } from "./recordCheck.ts";
import { violationError } from "./violationError.ts";

const mismatchIds = (e: unknown): string[] => {
  const data: unknown = e instanceof Error ? Reflect.get(e, "data") : undefined;
  const list: unknown = typeof data === "object" && data !== null ? Reflect.get(data, "mismatches") : undefined;
  return Array.isArray(list)
    ? list.map((m: unknown) => String(typeof m === "object" && m !== null ? Reflect.get(m, "id") : ""))
    : [];
};

/**
 * The render checks of k.a11y, after the first render, every `fire` and `settle()`: roles and name sources against
 * `a11y.json` (E1702, with it), axe-core (E1703), render contrast (E1804, with tokens) and personal controls without
 * `autocomplete` (E1821). Every check runs and the run is recorded for `reports/a11y.json`; then the first failing
 * check throws, in that order.
 */
export function renderChecks(setup: CheckSetup): void {
  const { root, page, a11y, tokens } = setup;
  const rules: string[] = [];
  let artifacts: unknown;
  if (a11y !== undefined) {
    rules.push("E1702");
    try {
      assertArtifacts(root, a11y);
    } catch (error) {
      artifacts = error;
    }
  }
  const ax = axe(root, page);
  rules.push(...ax.ran);
  const contrast: Violation[] = tokens === undefined ? [] : contrastViolations(root, tokens);
  if (tokens !== undefined) rules.push("E1804");
  const pii = piiViolations(root);
  rules.push("E1821");
  const violations = [
    ...mismatchIds(artifacts).map((element) => ({ rule: "E1702", element })),
    ...[...ax.violations, ...contrast, ...pii].map(({ rule, element }) => ({ rule, element })),
  ];
  recordCheck({ ...setup.target(), rules: [...rules].sort(), violations });
  if (artifacts !== undefined) throw artifacts;
  if (ax.violations.length > 0) throw violationError("E1703", ax.violations);
  if (contrast.length > 0) throw violationError("E1804", contrast);
  if (pii.length > 0) throw violationError("E1821", pii);
}
