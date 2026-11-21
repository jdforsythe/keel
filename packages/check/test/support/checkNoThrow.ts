import { check } from "../../src/index.ts";
import type { CheckOptions, CheckResult, SourceFile } from "../../src/index.ts";

/**
 * `check`, failing the test when a rule threw (E1756): a test that filters the diagnostics for one code would
 * otherwise read a throwing rule as a clean file.
 */
export function checkNoThrow(files: readonly SourceFile[], options: CheckOptions = {}): CheckResult {
  const result = check(files, options);
  const threw = result.diagnostics.find((d) => d.code === "E1756");
  if (threw !== undefined) throw new Error(`a rule threw in ${threw.path}: ${threw.message}`);
  return result;
}
