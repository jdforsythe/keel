// Seed 1337
import { test } from "vitest";

// E1753 duplicate code: covered in define-rule.test.ts.
// E1753 stdlib rule outside E2xxx/W2xxx: untestable, the public API has no marker distinguishing a stdlib rule from an app rule.
test.skip("E1753: a stdlib rule outside E2xxx/W2xxx is reported (untestable: no public stdlib marker)", () => {});
// E1754 unsafe without a justification string: untestable, the spec does not name the unsafe call shape the checker matches.
test.skip("E1754: unsafe without a justification string is reported (untestable: unsafe syntax unspecified)", () => {});
// E1755 budget exceeded: untestable, needs budgets.json and package/route measurements the check(files, opts) input has no slot for.
test.skip("E1755: budget exceeded is reported (untestable: budgets.json input unspecified)", () => {});
// Conformance "A tree with only W diagnostics exits 0": untestable here, exit codes belong to the CLI (k.cli), not @keel/check.
test.skip("a tree with only W diagnostics exits 0 (untestable: exit code is a CLI concern)", () => {});
