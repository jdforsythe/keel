// Spec: k.cli, Rules "E1053 formatter kind, std command or shell target registered twice"
// Spec: k.shell, Shell target "`shellTarget(shell, target)` (`@keel/cli`) once; a second throws E1053."
// Seed: 1337 (no generated input: the two shells are the closed set).
// The registry is per process: each shell is registered once in this file (the first call succeeds, the second throws).
import { shellTarget } from "@keel/cli";
import { describe, expect, test } from "vitest";

const target = {
  platforms: [],
  files: () => ({}),
  tools: () => [],
  build: () => ({ artifact: "x" }),
  ci: () => [],
};
const attempt = (shell: "capacitor" | "tauri"): unknown => {
  try {
    shellTarget(shell, target);
    return undefined;
  } catch (e) {
    return e;
  }
};

describe("k.cli E1053: shell target", () => {
  test("a second `shellTarget('tauri', t)` throws E1053", () => {
    expect(attempt("tauri")).toBeUndefined();
    const second = attempt("tauri");
    expect(String(second instanceof Error ? second.message : second)).toContain("E1053");
  });

  test("a second `shellTarget('capacitor', t)` throws E1053", () => {
    expect(attempt("capacitor")).toBeUndefined();
    const second = attempt("capacitor");
    expect(String(second instanceof Error ? second.message : second)).toContain("E1053");
  });
});
