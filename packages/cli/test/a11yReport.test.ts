// a11yReport (k.evidence a11y.json): each claim with the rules mapped to its criterion, the criteria no rule maps to,
// and the contrast table of the project's tokens.ts. Seed 1337.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { WCAG_CRITERIA } from "@keel/testing/a11y";
import { repoRoot } from "@keel/tooling/repo-root";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import type { A11yClaim } from "../src/internal/A11yClaim.ts";
import type { A11yCriteriaMap } from "../src/internal/A11yCriteriaMap.ts";
import { a11yReport } from "../src/internal/a11yReport.ts";

const run = { seed: 1337, numRuns: 50 };
const here = fileURLToPath(new URL(".", import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const project = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(here, ".tmp-a11yReport-"));
  dirs.push(dir);
  // The project has `@keel/ui` installed, as an app does: the report reads `contrastTable` from the project's own copy.
  mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
  symlinkSync(join(repoRoot(import.meta.dirname), "packages", "ui"), join(dir, "node_modules", "@keel", "ui"));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
};

const map: A11yCriteriaMap = new Map([
  ["1.1.1", { render: ["image-alt", "E1802"], static: ["E1802"] }],
  ["1.4.3", { render: ["color-contrast"], static: [] }],
  ["2.4.3", { render: [], static: ["E1820"] }],
]);
const claim = (route: string, criterion: string, rung: "none" | "example"): A11yClaim => ({
  item: `a11y:${route}#${criterion}`,
  route,
  criterion,
  rung,
  evidence: "x",
});

describe("a11yReport", () => {
  test("a11yReport lists each claim with its criterion's render and static rules, sorted together", async () => {
    const claims = [claim("home", "1.1.1", "example"), claim("about", "2.4.3", "none"), claim("home", "9.9.9", "none")];
    const r = await a11yReport(here, claims, map, false);
    expect(r.v).toBe(1);
    expect(r.claims).toEqual([
      { route: "home", criterion: "1.1.1", rung: "example", rules: ["E1802", "E1802", "image-alt"] },
      { route: "about", criterion: "2.4.3", rung: "none", rules: ["E1820"] },
      { route: "home", criterion: "9.9.9", rung: "none", rules: [] },
    ]);
  });

  test("the criteria for a person are the WCAG 2.2 A and AA ones the map does not hold, in the standard's order", async () => {
    const r = await a11yReport(here, [], map, false);
    expect(r.person).toEqual(WCAG_CRITERIA.filter((c) => !map.has(c)));
    expect(r.person).not.toContain("1.1.1");
    expect(r.person).toContain("1.2.1");
    const none = await a11yReport(here, [], new Map(), false);
    expect(none.person).toEqual([...WCAG_CRITERIA]);
    expect(none.claims).toEqual([]);
  });

  test("without tokens the contrast table is empty, whatever tokens.ts the directory holds", async () => {
    const dir = project({ "tokens.ts": 'export const tokens = { color: { a: "#000000", b: "#ffffff" } };\n' });
    expect((await a11yReport(dir, [], map, false)).contrast).toEqual([]);
  });

  test("with tokens.ts it holds contrastTable(tokens): light rows first, then dark, each pair both ways", async () => {
    const dir = project({
      "tokens.ts":
        'export const tokens = { color: { ink: "#000000", paper: { light: "#ffffff", dark: "#808080" } } };\n',
    });
    const r = await a11yReport(dir, [], map, true);
    expect(r.contrast.map((x) => [x.scheme, x.fg, x.bg])).toEqual([
      ["light", "ink", "paper"],
      ["light", "paper", "ink"],
      ["dark", "ink", "paper"],
      ["dark", "paper", "ink"],
    ]);
    expect(r.contrast[0]?.ratio).toBe(21);
    expect(r.contrast[2]?.ratio).toBeCloseTo(5.32, 2);
  });

  test("a default export is read when there is no named tokens export; the named one wins", async () => {
    const byDefault = project({ "tokens.ts": 'export default { color: { a: "#000000", b: "#ffffff" } };\n' });
    expect((await a11yReport(byDefault, [], map, true)).contrast).toHaveLength(4);
    const both = project({
      "tokens.ts":
        'export const tokens = { color: { a: "#000000", b: "#ffffff" } };\nexport default { color: { a: "#000000", b: "#ffffff", c: "#777777" } };\n',
    });
    expect((await a11yReport(both, [], map, true)).contrast).toHaveLength(4);
  });

  test("a tokens file that throws, or no tokens.ts, gives no rows", async () => {
    const throws = project({ "tokens.ts": 'throw new Error("no");\n' });
    expect((await a11yReport(throws, [], map, true)).contrast).toEqual([]);
    const missing = project({});
    expect((await a11yReport(missing, [], map, true)).contrast).toEqual([]);
    const empty = project({ "tokens.ts": "export const other = 1;\n" });
    expect((await a11yReport(empty, [], map, true)).contrast).toEqual([]);
  });

  test("property: one entry per claim, in order, with the claim's own route, criterion and rung", async () => {
    const crit = fc.constantFrom("1.1.1", "1.4.3", "2.4.3", "3.1.1");
    const one = fc.record({
      route: fc.stringMatching(/^[a-z]{1,6}$/),
      criterion: crit,
      rung: fc.constantFrom("none" as const, "example" as const),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(one, { maxLength: 6 }), async (cs) => {
        const r = await a11yReport(
          here,
          cs.map((c) => claim(c.route, c.criterion, c.rung)),
          map,
          false,
        );
        expect(r.claims.map((c) => [c.route, c.criterion, c.rung])).toEqual(
          cs.map((c) => [c.route, c.criterion, c.rung]),
        );
        for (const c of r.claims) {
          const m = map.get(c.criterion);
          expect(c.rules).toEqual(m === undefined ? [] : [...m.render, ...m.static].sort());
        }
      }),
      run,
    );
  });
});
