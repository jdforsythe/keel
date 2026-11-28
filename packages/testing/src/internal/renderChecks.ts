import type { CheckSetup } from "./CheckSetup.ts";
import type { Violation } from "./Violation.ts";
import { assertArtifacts } from "./assertArtifacts.ts";
import { axe } from "./axe.ts";
import { contrastViolations } from "./contrastViolations.ts";
import { insertedStatus } from "./insertedStatus.ts";
import { piiViolations } from "./piiViolations.ts";
import { recordCheck } from "./recordCheck.ts";
import { reversedFocus } from "./reversedFocus.ts";
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
 * `a11y.json` (E1702, with it), axe-core (E1703), render contrast and reversed focus order (E1804, E1820, with tokens) and personal controls without
 * `autocomplete` (E1821); after a `fire` or `settle()` that kept the page, a `status` region inserted holding text
 * under an element the root held at the last check (E1826). Every check runs and the run is recorded for `reports/a11y.json`; then the first failing
 * check throws, in that order.
 */
export function renderChecks(setup: CheckSetup): void {
  const { root, page, a11y, tokens, before } = setup;
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
  const order: Violation[] = tokens === undefined ? [] : reversedFocus(root, tokens);
  if (tokens !== undefined) rules.push("E1804", "E1820");
  const pii = piiViolations(root);
  rules.push("E1821");
  const live: Violation[] = before === undefined ? [] : insertedStatus(root, before);
  if (before !== undefined) rules.push("E1826");
  const violations = [
    ...mismatchIds(artifacts).map((element) => ({ rule: "E1702", element })),
    ...[...ax.violations, ...contrast, ...order, ...pii, ...live].map(({ rule, element }) => ({ rule, element })),
  ];
  recordCheck({ ...setup.target(), rules: [...rules].sort(), violations });
  if (artifacts !== undefined) throw artifacts;
  if (ax.violations.length > 0) throw violationError("E1703", ax.violations);
  if (contrast.length > 0) throw violationError("E1804", contrast);
  if (order.length > 0) throw violationError("E1820", order);
  if (pii.length > 0) throw violationError("E1821", pii);
  if (live.length > 0) throw violationError("E1826", live);
}
