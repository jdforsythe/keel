// The Problem table of RFC 0255, row by row, on a built copy of `apps/household` (k.derived): each edit, then the
// command the row names, and the outcome the rule now gives. Copies come from the conformance suite's linked-project
// helper (read only here). Row 12 (`keel dev` beside `keel check`) is k.derived clause 18's case and is not repeated.
// Seed 1337 (no generated input).
import { chmodSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  type Tree,
  addSize,
  age,
  brief,
  changed,
  cloneTree,
  codes,
  dropTree,
  editStdText,
  householdTree,
  keel,
  put,
  read,
  snapshot,
  sub,
} from "../conformance/derived-support.ts";

const SLOW = fixedTime(600_000);
let house: Tree;
const made: Tree[] = [];
const fresh = (): Tree => {
  const t = cloneTree(house);
  made.push(t);
  return t;
};
beforeAll(() => {
  house = householdTree();
}, SLOW);
afterAll(() => {
  for (const t of made) dropTree(t);
  dropTree(house);
});

/** No E1005, exit 0, and a frozen check afterwards finds every view current. */
const clean = (t: Tree, out: ReturnType<typeof keel>): void => {
  expect(codes(out, "E1005"), brief(out)).toEqual([]);
  expect(codes(keel(t.dir, ["check", "--frozen"]), "E1005")).toEqual([]);
};
const CONTRACT = "modules/setup/setup.contract.ts";

describe("RFC 0255 Problem table on apps/household", () => {
  test(
    "1: renaming the id app.start.intro is no E1005; ids.json follows",
    () => {
      const t = fresh();
      sub(t.dir, "modules/app/StartPage.tsx", 'id="app.start.intro"', 'id="app.start.lead"');
      const out = keel(t.dir, ["check"]);
      clean(t, out);
      expect(read(t.dir, ".keel/ids.json")).toContain("app.start.lead");
    },
    SLOW,
  );

  test(
    "2: an API entry setup.ping added to the contract and routes.ts is no E1005; routes.json and surface.json follow",
    () => {
      const t = fresh();
      sub(
        t.dir,
        CONTRACT,
        '  "setup.household": {',
        '  "setup.ping": { method: "GET", path: "/api/ping", output: Household },\n  "setup.household": {',
      );
      sub(
        t.dir,
        "modules/setup/routes.ts",
        '  "setup.household": {',
        '  "setup.ping": { loader: loader(setup, "setup.ping", {}, async () => ok({ name: null })), guard: member },\n  "setup.household": {',
      );
      sub(
        t.dir,
        "modules/setup/routes.ts",
        'import { manifest } from "@keel/router";',
        'import { loader, manifest } from "@keel/router";\nimport { ok } from "@keel/schema";',
      );
      const out = keel(t.dir, ["check"]);
      expect(codes(out, "E1005"), brief(out)).toEqual([]);
      expect(read(t.dir, ".keel/routes.json")).toContain("/api/ping");
      expect(read(t.dir, ".keel/surface.json")).toContain("/api/ping");
    },
    SLOW,
  );

  test(
    "3: the path /api/household changed to /api/home is no E1005",
    () => {
      const t = fresh();
      sub(t.dir, CONTRACT, '"/api/household"', '"/api/home"');
      const out = keel(t.dir, ["check"]);
      expect(out.status, brief(out)).toBe(0);
      clean(t, out);
      expect(read(t.dir, ".keel/surface.json")).toContain("/api/home");
    },
    SLOW,
  );

  test(
    "4 and 5: a required store field after keel build is E1563 with --base, with .keel/ present or absent",
    () => {
      for (const drop of [false, true]) {
        const t = fresh();
        const base = join(t.base, "base.json");
        copyFileSync(join(t.dir, ".keel/surface.json"), base);
        if (drop) rmSync(join(t.dir, ".keel"), { recursive: true, force: true });
        addSize(t.dir);
        const out = keel(t.dir, ["check", "--base", base]);
        expect(
          codes(out, "E1563").map((d) => d.message),
          brief(out),
        ).toEqual([expect.stringContaining("size")]);
        expect(codes(out, "E1005")).toEqual([]);
      }
    },
    SLOW,
  );

  test(
    "6 and 7: a package change in a linked @keel/std-text is seen: E1563 for min 2 with --base, a rewritten surface for min 0",
    () => {
      const t = fresh();
      const base = join(t.base, "base.json");
      copyFileSync(join(t.dir, ".keel/surface.json"), base);
      editStdText(t, "min ?? 1", "min ?? 2", true);
      expect(codes(keel(t.dir, ["check", "--base", base]), "E1563")).toHaveLength(1);
      const u = fresh();
      editStdText(u, "min ?? 1", "min ?? 0", true);
      const out = keel(u.dir, ["check"]);
      expect(out.refreshed, brief(out)).toBe(1);
      expect(read(u.dir, ".keel/surface.json")).toContain("line(0..40)");
    },
    SLOW,
  );

  test(
    "8: storage added to topology.ts gives its E1572 and no E1005; the deploy files follow",
    () => {
      const t = fresh();
      sub(t.dir, "topology.ts", 'adapter: "node",', 'adapter: "node",\n    storage: "sqlite",');
      const out = keel(t.dir, ["check"]);
      expect(codes(out, "E1572"), brief(out)).not.toEqual([]);
      clean(t, out);
    },
    SLOW,
  );

  test(
    "9: a pale page text colour in tokens.ts is E1804 at once and writes no file",
    () => {
      const t = fresh();
      const tokens = read(t.dir, "tokens.ts").replace(
        "  base: {\n    ...brandTokens.base,",
        '  color: { ...brandTokens.color, muted: "#cccccc" },\n  base: {\n    ...brandTokens.base,\n    page: { ...brandTokens.base.page, fg: "muted" },',
      );
      put(t.dir, "tokens.ts", tokens);
      age(t.dir);
      const before = snapshot(t.dir);
      const out = keel(t.dir, ["check"]);
      expect(codes(out, "E1804").length, brief(out)).toBeGreaterThan(0);
      expect(changed(before, snapshot(t.dir))).toEqual([]);
    },
    SLOW,
  );

  test(
    "10: keel test after an id rename passes and leaves every view current, surface.json included",
    () => {
      const t = fresh();
      sub(t.dir, "modules/app/StartPage.tsx", 'id="app.start.links"', 'id="app.start.list"');
      const ran = keel(t.dir, ["test", "test/start.test.ts"]);
      expect(ran.status, brief(ran)).toBe(0);
      expect(codes(keel(t.dir, ["check", "--frozen"]), "E1005")).toEqual([]);
    },
    SLOW,
  );

  test(
    "11: keel test with .keel/ read-only runs its tests; a differing view is W1018, never T0001",
    () => {
      const t = fresh();
      sub(t.dir, "modules/app/StartPage.tsx", 'id="app.start.links"', 'id="app.start.list"');
      chmodSync(join(t.dir, ".keel"), 0o555);
      try {
        const ran = keel(t.dir, ["test", "test/start.test.ts"]);
        expect(codes(ran, "T0001"), brief(ran)).toEqual([]);
        expect(ran.status, brief(ran)).toBe(0);
        expect(codes(ran, "W1018").length, brief(ran)).toBeGreaterThan(0);
      } finally {
        chmodSync(join(t.dir, ".keel"), 0o755);
      }
    },
    SLOW,
  );

  test(
    "13: a surface.json of version 2 with sources is rewritten, not E1005",
    () => {
      const t = fresh();
      const text = read(t.dir, ".keel/surface.json");
      put(t.dir, ".keel/surface.json", text.replace('"version":3', '"sources":{"x.ts":"fnv1a:0"},"version":2'));
      const out = keel(t.dir, ["check"]);
      expect(codes(out, "E1005"), brief(out)).toEqual([]);
      expect(read(t.dir, ".keel/surface.json")).toBe(text);
      expect(existsSync(join(t.dir, ".keel/surface.json"))).toBe(true);
    },
    SLOW,
  );
});
