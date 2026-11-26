// Spec: k.scaffold, clause "`keel scaffold project p` writes `modules/app/HomePage.tsx` and `modules/app/home.route.test.ts`, and `keel test` in `p` after its install passes that one test."
// Seed: none (one real project, the real `keel` binary: scaffold, then `keel test`). The home page text (k.create Files: heading `app.home.title` the project name,
// paragraph `app.home.next` naming `modules/app/HomePage.tsx` and `keel docs`) is asserted on the written source, since the clause names the files and the passing test.
// ASSUMED: the `keel test` summary record is `{ kind: "summary", name: "test", ok, counts: { tests, failed } }` (as generators-leave-check-clean.test.ts).
import { testTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, keel, readTree } from "./keel-cli.ts";
import { scaffolded } from "./agent-files-support.ts";

let dir = "";
let proj = "";
let tree = new Map<string, string>();

beforeAll(() => {
  ({ dir, proj } = scaffolded());
  tree = readTree(proj);
}, testTime(60_000));
afterAll(() => cleanup(dir));

describe("k.scaffold project: the home route", () => {
  it("`keel scaffold project p` writes `modules/app/HomePage.tsx` and `modules/app/home.route.test.ts`", () => {
    expect(tree.has("modules/app/HomePage.tsx")).toBe(true);
    expect(tree.has("modules/app/home.route.test.ts")).toBe(true);
    expect([...tree.keys()].filter((p) => /\.test\.tsx?$/.test(p))).toEqual(["modules/app/home.route.test.ts"]);
  });

  it("the page renders `app.home.title` and `app.home.next`, which names `modules/app/HomePage.tsx` and `keel docs`; the route `app.home` is at `/`", () => {
    const page = tree.get("modules/app/HomePage.tsx") ?? "";
    expect(page).toContain("app.home.title");
    expect(page).toContain("app.home.next");
    expect(page).toContain("modules/app/HomePage.tsx");
    expect(page).toContain("keel docs");
    const contract = tree.get("modules/app/app.contract.ts") ?? "";
    expect(contract).toContain("app.home");
    expect(contract).toMatch(/['"]\/['"]/);
    const test = tree.get("modules/app/home.route.test.ts") ?? "";
    expect(test).toContain("app.home");
    expect(test).toContain("a11y");
    expect(test).toContain("app.home.title");
  });

  it(
    "`keel test` in `p` after its install passes that one test",
    () => {
      const r = keel(proj, ["test"]);
      const detail = JSON.stringify(r.records.slice(0, 20));
      expect(r.status, detail).toBe(0);
      const summary = r.records.find((x) => x.kind === "summary" && x.name === "test");
      expect(summary?.ok, detail).toBe(true);
      const counts = summary?.counts;
      const c: Record<string, unknown> = typeof counts === "object" && counts !== null ? { ...counts } : {};
      expect(c.failed, detail).toBe(0);
      expect(Number(c.tests), detail).toBe(1);
    },
    testTime(120_000),
  );
});
