// Spec: k.aria, clause "With `brandTokens`, `<Box p={{ base: '3', print: '0' }} direction=\"column\">` puts a rule declaring `padding:var(--k-space-0)` in an `@media print` block after the `@media (min-width: 1024px)` block; a `breakpoint` token `print` is one E1807; `<Box media=\"screen\">` has class `k-media-screen` and `keel.base` holds `@media print{.k-media-screen{display:none!important}}`, and with no `media` written the CSS holds no `k-media-`; `breakInside=\"avoid\"` compiles to `break-inside:avoid`, and `breakInside=\"page\"` is a type error."
// Seed: 1337 (fixed project). No `test.skip`: the case is a plain test and fails until RFC 0249 is built.
// The `keel check` half of the clause's `breakpoint` token `print`: the project's `tokens.ts` evaluated is E1807 at `tokens.ts` line 1, column 1 (k.a11y-static Tokens). The compiled CSS and the type error are packages/ui/conformance/print-props.test.ts.
// ASSUMED, as a11y-static-codes-cli.test.ts: a diagnostic record is `{ kind: "diag", code, path, line, col }`.
import { afterAll, describe, expect, it } from "vitest";
import { TOPOLOGY, keelProject } from "./a11y-project-support.ts";
import { keel, removeProject } from "./test-sim-project.ts";

const created: string[] = [];
afterAll(() => {
  for (const d of created) removeProject(d);
});
const MODULE = `import { module } from "@keel/compiler";\nexport default module({ id: "m", deps: [], capabilities: [], public: { exports: [] } });\n`;
const tokens = (breakpoint: string): string =>
  `import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nexport const tokens = defineTokens({ ...brandTokens, breakpoint: { ...brandTokens.breakpoint, ${breakpoint} } });\n`;
const diags = (breakpoint: string) => {
  const dir = keelProject("print-e1807", {
    "topology.ts": TOPOLOGY,
    "modules/m/module.ts": MODULE,
    "tokens.ts": tokens(breakpoint),
  });
  created.push(dir);
  return keel(dir, ["check"]);
};

describe("k.aria: a `breakpoint` token `print`", () => {
  it("a `breakpoint` token `print` is one E1807 at `tokens.ts` line 1, column 1, and exits 1", () => {
    const run = diags('print: "600px"');
    const d = run.records.filter((r) => r.kind === "diag" && r.code === "E1807");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ path: "tokens.ts", line: 1, col: 1 });
    expect(run.status).toBe(1);
  }, 180_000);

  it("a breakpoint named `printer` is no E1807", () => {
    const run = diags('printer: "600px"');
    expect(run.records.filter((r) => r.kind === "diag" && r.code === "E1807")).toEqual([]);
  }, 180_000);
});
