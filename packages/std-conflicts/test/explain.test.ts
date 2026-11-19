// E2701 and W2702 are registered in the k.check registry when the package loads, so `keel explain` answers them.
// Seed 1337
import { explain } from "@keel/check/explain";
import { describe, expect, test } from "vitest";
import "../src/index.ts";

describe("std.conflicts: explain", () => {
  test.each(["E2701", "W2702"])("%s has an explanation that names std.conflicts", (code) => {
    const text = explain(code);
    expect(text).toContain(code);
    expect(text).toContain("Fix:");
    expect(text).toContain("see: std.conflicts");
  });
});
