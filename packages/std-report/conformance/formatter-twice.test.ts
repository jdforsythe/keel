// Spec: std.report, clause "A second `formatter('report.tally', ...)` throws E1053."
// Seed 1337 (no random inputs)
import { formatter } from "@keel/cli";
import { Tally } from "@keel/std-report";
import "@keel/std-report/tools";
import { expect, test } from "vitest";

test("A second `formatter('report.tally', ...)` throws E1053.", () => {
  let thrown: unknown;
  try {
    formatter("report.tally", { schema: Tally, compact: (r) => r.id, pretty: (r) => r.id });
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect(String(thrown instanceof Error ? thrown.message : thrown)).toContain("E1053");
});
