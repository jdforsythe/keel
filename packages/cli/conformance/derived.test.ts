import { type ChildProcess, spawn } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Spec: k.derived, clause "In a copy of `examples/client-only-api` after `keel build`, adding a page route `app.about` at `/about` to its contract and binding it to `HomePage`, then `keel check`, reports no E1005, exits 0, prints `1 refreshed` in its trailer, and leaves `.keel/routes.json` byte-identical to what `keel build` of that tree writes."
// Spec: k.derived, clause "In that copy, after renaming an element id in a page component, `keel check` reports no E1005 and leaves `.keel/ids.json` and `.keel/a11y.json` byte-identical to what `keel build` writes."
// Spec: k.derived, clause "A second `keel check` with no file changed writes no file, every `.keel/` file keeping its modification time, its compact trailer holds no `refreshed`, and its json summary's `counts.refreshed` is 0."
// Spec: k.derived, clause "After the edit of clause 1, `keel check --frozen` exits 1 with one E1005, at `.keel/routes.json`, and no file in `.keel/` changes."
// Spec: k.derived, clause "After the edit of clause 1, `keel check` with `CI=true` gives the output of clause 4, and with `CI=false` the output of clause 1."
// Spec: k.derived, clause "Changing one byte of `.keel/ids.json` makes `keel check` rewrite it with `1 refreshed` and exit 0, and makes `keel check --frozen` report one E1005 at that file."
// Spec: k.derived, clause "A file `.keel/x.json` is one E1005 under `keel check` and under `keel check --frozen`, and is still there after both."
// Spec: k.derived, clause "With the copy's `.keel/` folder at mode 0555 and the edit of clause 1, `keel check` exits 0 with one W1018 per differing view and no E1005, and `keel test` runs every test with one W1018 per differing view and no T0001."
// Spec: k.derived, clause "In a copy of `apps/household` whose `@keel/std-text` is a linked copy, after `keel build`, changing `line`'s default `min` from 1 to 2 in that copy makes `keel check --base <the surface keel build wrote>` report one E1563 at `modules/setup/Household.schema.ts`, and makes `keel check` without `--base` print `1 refreshed`."
// Spec: k.derived, clause "In a copy of `apps/household` with `.keel/` deleted, giving the `setup.household` store's state a required field makes `keel check --base <the committed surface>` report one E1563 naming that field."
// Spec: k.derived, clause "In a fixture whose page renders `<button id=\"p.b\">` and whose test renders it with `renderRoute`, replacing `.keel/a11y.json` with one giving `p.b` role `link` leaves `keel test` passing."
// Spec: k.derived, clause "In that fixture with `.keel/` deleted, a passing `renderRoute` under `keel test` records a run whose `rules` hold E1702."
// Spec: k.derived, clause "`keel lsp` diagnostics for an unsaved buffer adding the page route of clause 1 write no file in `.keel/`."
// Spec: k.derived, clause "Two `keel check` processes started together after the edit of clause 1 both exit 0, and afterwards each `.keel/` file is byte-identical to what `keel build` writes and no `*.tmp` file is left."
// Spec: k.derived, clause "After one `keel check`, replacing each entry in `node_modules/.cache/keel/derived/` with `{}` or its first 40 bytes leaves the next `keel check` printing the same stdout bytes and writing the same files as a run with the folder deleted."
// Spec: k.derived, clause "After one `keel check` of the household copy, rewriting a file of the linked `@keel/std-text` copy that the evaluation loaded, with its old modification time, makes the next `keel check` evaluate again, as a run with `node_modules/.cache/keel` deleted does."
// Spec: k.derived, clause "After one `keel check`, re-indenting a contract file and adding a comment to it makes the next `keel check` write no file."
// Spec: k.derived, clause "While `keel dev` serves the copy of clause 1, within 2 s of the edit `.keel/routes.json` is byte-identical to what `keel build` writes, and a `keel check` run then writes no file."
// Spec: k.derived, clause "In a fixture with one page route `r` and a passing `renderRoute` test of it, with `.keel/` deleted, `keel test` then `keel ledger` give the same `a11y:.:r#<criterion>` items and rungs as with `.keel/` present, and a page route `s` added after `keel build` with no build since gets its `a11y:.:s#<criterion>` items."
// Spec: k.derived, clause "No fixture makes `keel check` report W1005."
// Spec: k.derived, clause "`keel scaffold project p` writes a `.gitignore` holding the lines `.keel/a11y.json`, `.keel/deps.json`, `.keel/ids.json`, `.keel/routes.json`, `.keel/std.json` and `.keel/styles.json`, and no line matching `.keel/surface.json`."
// Spec: k.derived, clause "After `keel build` of the copy of clause 1, setting the colour its page text uses so that text falls under 4.5:1 against its background makes the next `keel check` report E1804 at that text and write no file."
// Seed 1337 (recorded). The real binary over copies of `examples/client-only-api` and `apps/household` (derived-support.ts), built once and cloned per case.
// Clause 1's edit adds the page route `app.about` at `/about` to the example's contract and binds it to `HomePage` (derived-support.ts `addRoute`).
// ASSUMED: "what `keel build` writes" is read by running `keel build` in the same tree after the run under test: a view the run left stale changes.
// ASSUMED: `--format=compact` trailer `ok check <n> files, <k> refreshed, ...`; a W1018 names the view in its `path` or its message.
// ASSUMED: the default of `line` in the linked `@keel/std-text` is written `min ?? 1` in `line.ts` of the copy (std.text: `line({ min = 1, max })`).
// ASSUMED: k.derived 19's page routes `r` and `s` are `m.r` and `m.s` (E1155: a route id of module `m` is `m.<name>`), their items `a11y:.:m.r#<criterion>`.
// The page of clauses 11 and 12 renders `<Button id="p.b">` (a `@keel/ui` button, whose element is a `button`).
import { lsp } from "@keel/cli";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TOPOLOGY, keelProject, runsOf, testHead } from "./a11y-project-support.ts";
import {
  BIN,
  type Out,
  SEED,
  type Tree,
  a11yItems,
  addRoute,
  addSize,
  age,
  apiTree,
  brief,
  build,
  canConnect,
  changed,
  childEnv,
  cloneTree,
  codes,
  dropTree,
  editStdText,
  freePort,
  householdTree,
  keel,
  keelAsync,
  put,
  read,
  renameId,
  snapshot,
  sub,
  tmpFiles,
  until,
  views,
} from "./derived-support.ts";

/** Each case runs commands of the binary (docs/TESTING.md Wall-clock bounds): the machine's own work. */
const SLOW = fixedTime(600_000);
const NO_ROOT = process.getuid?.() !== 0;

let api: Tree;
let house: Tree;
const made: Tree[] = [];
const dirs: string[] = [];
const children: ChildProcess[] = [];
const fresh = (t: Tree): Tree => {
  const c = cloneTree(t);
  made.push(c);
  return c;
};
/** A copy of the built example with clause 1's edit applied. */
const edited = (): Tree => {
  const c = fresh(api);
  addRoute(c.dir);
  return c;
};
const CACHE = "node_modules/.cache/keel";
const CONTRACT = "modules/app/app.contract.ts";

beforeAll(() => {
  api = apiTree();
  made.push(api);
}, SLOW);
afterAll(() => {
  for (const c of children) if (c.exitCode === null && c.pid !== undefined) process.kill(-c.pid, "SIGKILL");
  for (const t of made) dropTree(t);
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const houseTree = (): Tree => {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  return house;
};

/** The bytes of the views, then `keel build`, then the views again: equal when the run under test left what a build writes. */
function matchesBuild(dir: string): void {
  const before = views(dir);
  build(dir);
  expect(views(dir)).toEqual(before);
}
const noW1005 = (out: Out): void => expect(codes(out, "W1005"), brief(out)).toEqual([]);

describe("k.derived: a run reads the tree, not the views", () => {
  test(
    "In a copy of `examples/client-only-api` after `keel build`, adding a page route `app.about` at `/about` to its contract and binding it to `HomePage`, then `keel check`, reports no E1005, exits 0, prints `1 refreshed` in its trailer, and leaves `.keel/routes.json` byte-identical to what `keel build` of that tree writes.",
    () => {
      const t = edited();
      const out = keel(t.dir, ["check"]);
      expect(codes(out, "E1005"), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
      expect(out.refreshed).toBe(1);
      noW1005(out);
      matchesBuild(t.dir);
    },
    SLOW,
  );

  test(
    "In a copy of `examples/client-only-api` after `keel build`, adding a page route `app.about` at `/about` to its contract and binding it to `HomePage`, then `keel check`, reports no E1005, exits 0, prints `1 refreshed` in its trailer, and leaves `.keel/routes.json` byte-identical to what `keel build` of that tree writes." +
      " (the compact trailer shows the count)",
    () => {
      const t = edited();
      const out = keel(t.dir, ["check", "--format=compact"]);
      expect(out.trailer, brief(out)).toMatch(/^ok check \d+ files, 1 refreshed, 0 errors/);
    },
    SLOW,
  );

  test(
    "In a copy of `examples/client-only-api` after `keel build`, adding a page route `app.about` at `/about` to its contract and binding it to `HomePage`, then `keel check`, reports no E1005, exits 0, prints `1 refreshed` in its trailer, and leaves `.keel/routes.json` byte-identical to what `keel build` of that tree writes." +
      " (a contract path changed)",
    () => {
      const t = fresh(api);
      sub(t.dir, CONTRACT, 'path: "/releases"', 'path: "/notes"');
      const out = keel(t.dir, ["check"]);
      expect(codes(out, "E1005"), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
      expect(out.refreshed).toBe(1);
      matchesBuild(t.dir);
    },
    SLOW,
  );

  test(
    "In that copy, after renaming an element id in a page component, `keel check` reports no E1005 and leaves `.keel/ids.json` and `.keel/a11y.json` byte-identical to what `keel build` writes.",
    () => {
      const t = fresh(api);
      renameId(t.dir);
      const out = keel(t.dir, ["check"]);
      expect(codes(out, "E1005"), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
      matchesBuild(t.dir);
      expect(read(t.dir, ".keel/ids.json")).toContain("app.home.heading");
    },
    SLOW,
  );

  test(
    "A second `keel check` with no file changed writes no file, every `.keel/` file keeping its modification time, its compact trailer holds no `refreshed`, and its json summary's `counts.refreshed` is 0.",
    () => {
      const t = edited();
      expect(keel(t.dir, ["check"]).status).toBe(0);
      age(t.dir);
      const before = snapshot(t.dir);
      const out = keel(t.dir, ["check"]);
      expect(out.status, brief(out)).toBe(0);
      expect(changed(before, snapshot(t.dir))).toEqual([]);
      expect(out.refreshed).toBe(0);
      const compact = keel(t.dir, ["check", "--format=compact"]);
      expect(compact.trailer, brief(compact)).toMatch(/^ok check /);
      expect(compact.trailer).not.toContain("refreshed");
    },
    SLOW,
  );

  test(
    "A second `keel check` with no file changed writes no file, every `.keel/` file keeping its modification time, its compact trailer holds no `refreshed`, and its json summary's `counts.refreshed` is 0." +
      " (a built tree, over random subsets of edits: the count is the number of views that differ)",
    () => {
      const t = fresh(api);
      const files = [".keel/ids.json", ".keel/deps.json", ".keel/styles.json", ".keel/std.json", ".keel/a11y.json"];
      fc.assert(
        fc.property(fc.subarray(files), (picked) => {
          build(t.dir);
          for (const f of picked) put(t.dir, f, `${read(t.dir, f).trimEnd()} \n`);
          age(t.dir);
          const before = snapshot(t.dir);
          const out = keel(t.dir, ["check"]);
          expect(out.status, brief(out)).toBe(0);
          expect(out.refreshed).toBe(picked.length);
          const moved = changed(before, snapshot(t.dir));
          expect(moved).toEqual([...picked].sort());
          if (picked.length === 0) expect(out.refreshed).toBe(0);
        }),
        { seed: SEED, numRuns: 5 },
      );
    },
    SLOW,
  );

  test(
    "After the edit of clause 1, `keel check --frozen` exits 1 with one E1005, at `.keel/routes.json`, and no file in `.keel/` changes.",
    () => {
      const t = edited();
      age(t.dir);
      const before = snapshot(t.dir);
      const out = keel(t.dir, ["check", "--frozen"]);
      const e = codes(out, "E1005");
      expect(out.status, brief(out)).toBe(1);
      expect(e.map((d) => d.path)).toEqual([".keel/routes.json"]);
      expect(changed(before, snapshot(t.dir))).toEqual([]);
    },
    SLOW,
  );

  test(
    "After the edit of clause 1, `keel check` with `CI=true` gives the output of clause 4, and with `CI=false` the output of clause 1.",
    () => {
      const frozen = edited();
      const want = keel(frozen.dir, ["check", "--frozen"]);
      const ci = edited();
      const got = keel(ci.dir, ["check"], { CI: "true" });
      expect(got.stdout).toBe(want.stdout);
      expect(got.status).toBe(want.status);
      const off = edited();
      const out = keel(off.dir, ["check"], { CI: "false" });
      expect(codes(out, "E1005"), brief(out)).toEqual([]);
      expect(out.status).toBe(0);
      expect(out.refreshed).toBe(1);
    },
    SLOW,
  );

  test(
    "After the edit of clause 1, `keel check` with `CI=true` gives the output of clause 4, and with `CI=false` the output of clause 1." +
      " (each way to be frozen, and the values of CI that are not)",
    () => {
      const stale = edited();
      age(stale.dir);
      const before = snapshot(stale.dir);
      const ways: { args: string[]; env: Record<string, string> }[] = [
        { args: ["--frozen"], env: {} },
        { args: [], env: { KEEL_FROZEN: "1" } },
        { args: [], env: { CI: "true" } },
      ];
      for (const w of ways) {
        const out = keel(stale.dir, ["check", ...w.args], w.env);
        expect(out.status, brief(out)).toBe(1);
        expect(codes(out, "E1005")).toHaveLength(1);
        expect(changed(before, snapshot(stale.dir))).toEqual([]);
      }
      fc.assert(
        fc.property(fc.constantFrom("1", "yes", "TRUE", "on"), (ci) => {
          const out = keel(stale.dir, ["check"], { CI: ci });
          expect(codes(out, "E1005")).toHaveLength(1);
          expect(changed(before, snapshot(stale.dir))).toEqual([]);
        }),
        { seed: SEED, numRuns: 3 },
      );
      fc.assert(
        fc.property(fc.constantFrom("", "0", "false"), (ci) => {
          const t = edited();
          const out = keel(t.dir, ["check"], { CI: ci });
          expect(codes(out, "E1005"), brief(out)).toEqual([]);
          expect(out.refreshed).toBe(1);
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW,
  );

  test(
    "After the edit of clause 1, `keel check` with `CI=true` gives the output of clause 4, and with `CI=false` the output of clause 1." +
      " (a frozen command's children are frozen: keel test writes no view)",
    () => {
      const t = edited();
      age(t.dir);
      const before = snapshot(t.dir, ["node_modules", "reports", "dist"]);
      const out = keel(t.dir, ["test", "--frozen"]);
      expect(codes(out, "E1052"), brief(out)).toEqual([]);
      expect(changed(before, snapshot(t.dir, ["node_modules", "reports", "dist"]))).toEqual([]);
    },
    SLOW,
  );

  test(
    "Changing one byte of `.keel/ids.json` makes `keel check` rewrite it with `1 refreshed` and exit 0, and makes `keel check --frozen` report one E1005 at that file.",
    () => {
      const t = fresh(api);
      const ids = ".keel/ids.json";
      const good = read(t.dir, ids);
      fc.assert(
        fc.property(fc.integer({ min: 0, max: good.length - 1 }), (pos) => {
          const bad = `${good.slice(0, pos)}${good[pos] === "X" ? "Y" : "X"}${good.slice(pos + 1)}`;
          put(t.dir, ids, bad);
          age(t.dir);
          const before = snapshot(t.dir);
          const frozen = keel(t.dir, ["check", "--frozen"]);
          expect(
            codes(frozen, "E1005").map((d) => d.path),
            brief(frozen),
          ).toEqual([ids]);
          expect(changed(before, snapshot(t.dir))).toEqual([]);
          const out = keel(t.dir, ["check"]);
          expect(out.status, brief(out)).toBe(0);
          expect(out.refreshed).toBe(1);
          expect(read(t.dir, ids)).toBe(good);
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    SLOW,
  );

  test(
    "A file `.keel/x.json` is one E1005 under `keel check` and under `keel check --frozen`, and is still there after both.",
    () => {
      const t = fresh(api);
      put(t.dir, ".keel/x.json", "{}\n");
      for (const args of [["check"], ["check", "--frozen"]]) {
        const out = keel(t.dir, args);
        expect(
          codes(out, "E1005").map((d) => d.path),
          brief(out),
        ).toEqual([".keel/x.json"]);
        expect(existsSync(join(t.dir, ".keel/x.json"))).toBe(true);
      }
    },
    SLOW,
  );

  test.skipIf(!NO_ROOT)(
    "With the copy's `.keel/` folder at mode 0555 and the edit of clause 1, `keel check` exits 0 with one W1018 per differing view and no E1005, and `keel test` runs every test with one W1018 per differing view and no T0001.",
    () => {
      const t = edited();
      chmodSync(join(t.dir, ".keel"), 0o555);
      try {
        const out = keel(t.dir, ["check"]);
        expect(out.status, brief(out)).toBe(0);
        expect(codes(out, "E1005")).toEqual([]);
        expect(codes(out, "W1018"), brief(out)).toHaveLength(1);
        const ran = keel(t.dir, ["test"]);
        expect(codes(ran, "T0001"), brief(ran)).toEqual([]);
        expect(ran.status, brief(ran)).toBe(0);
        expect(ran.counts.tests).toBeGreaterThan(0);
        expect(ran.counts.failed).toBe(0);
        const w = codes(ran, "W1018");
        expect(w, brief(ran)).toHaveLength(1);
        for (const d of w) expect(`${d.path} ${d.message}`).toMatch(/\.keel\/routes\.json/);
      } finally {
        chmodSync(join(t.dir, ".keel"), 0o755);
      }
    },
    SLOW,
  );

  test(
    "In a copy of `apps/household` whose `@keel/std-text` is a linked copy, after `keel build`, changing `line`'s default `min` from 1 to 2 in that copy makes `keel check --base <the surface keel build wrote>` report one E1563 at `modules/setup/Household.schema.ts`, and makes `keel check` without `--base` print `1 refreshed`.",
    () => {
      const t = fresh(houseTree());
      const base = join(t.base, "base-surface.json");
      copyFileSync(join(t.dir, ".keel/surface.json"), base);
      editStdText(t, "min ?? 1", "min ?? 2", false);
      const out = keel(t.dir, ["check", "--base", base]);
      const e = codes(out, "E1563");
      expect(
        e.map((d) => d.path),
        brief(out),
      ).toEqual(["modules/setup/Household.schema.ts"]);
      expect(codes(out, "E1005")).toEqual([]);
      const plain = fresh(houseTree());
      editStdText(plain, "min ?? 1", "min ?? 2", false);
      const second = keel(plain.dir, ["check"]);
      expect(second.refreshed, brief(second)).toBe(1);
    },
    SLOW,
  );

  test(
    "In a copy of `apps/household` whose `@keel/std-text` is a linked copy, after `keel build`, changing `line`'s default `min` from 1 to 2 in that copy makes `keel check --base <the surface keel build wrote>` report one E1563 at `modules/setup/Household.schema.ts`, and makes `keel check` without `--base` print `1 refreshed`." +
      " (the default min 1 to 0)",
    () => {
      const t = fresh(houseTree());
      editStdText(t, "min ?? 1", "min ?? 0", false);
      const out = keel(t.dir, ["check"]);
      expect(codes(out, "E1005"), brief(out)).toEqual([]);
      expect(out.refreshed).toBe(1);
      expect(read(t.dir, ".keel/surface.json")).toContain("line(0..40)");
    },
    SLOW,
  );

  test(
    "In a copy of `apps/household` with `.keel/` deleted, giving the `setup.household` store's state a required field makes `keel check --base <the committed surface>` report one E1563 naming that field.",
    () => {
      const t = fresh(houseTree());
      const base = join(t.base, "committed-surface.json");
      copyFileSync(join(t.dir, ".keel/surface.json"), base);
      rmSync(join(t.dir, ".keel"), { recursive: true, force: true });
      addSize(t.dir);
      const out = keel(t.dir, ["check", "--base", base]);
      const e = codes(out, "E1563");
      expect(e, brief(out)).toHaveLength(1);
      expect(e[0]?.message).toContain("size");
    },
    SLOW,
  );

  test(
    "In a copy of `apps/household` with `.keel/` deleted, giving the `setup.household` store's state a required field makes `keel check --base <the committed surface>` report one E1563 naming that field." +
      " (with the built .keel present, the real E1563 and no request to run keel build)",
    () => {
      const t = fresh(houseTree());
      const base = join(t.base, "committed-surface.json");
      copyFileSync(join(t.dir, ".keel/surface.json"), base);
      addSize(t.dir);
      const out = keel(t.dir, ["check", "--base", base]);
      expect(codes(out, "E1563"), brief(out)).toHaveLength(1);
      expect(codes(out, "E1005")).toEqual([]);
      expect(out.stdout).not.toContain("run keel build");
    },
    SLOW,
  );

  test(
    "After the edit of clause 1, `keel check --frozen` exits 1 with one E1005, at `.keel/routes.json`, and no file in `.keel/` changes." +
      " (a deploy file: storage added to topology.ts)",
    () => {
      const t = fresh(houseTree());
      sub(t.dir, "topology.ts", 'adapter: "node",', 'adapter: "node",\n    storage: "sqlite",');
      age(t.dir);
      const before = snapshot(t.dir);
      const frozen = keel(t.dir, ["check", "--frozen"]);
      expect(codes(frozen, "E1005").map((d) => d.path)).toEqual(
        expect.arrayContaining(["deploy/compose.yaml", "deploy/web/Dockerfile"]),
      );
      expect(changed(before, snapshot(t.dir))).toEqual([]);
      const out = keel(t.dir, ["check"]);
      expect(codes(out, "E1005"), brief(out)).toEqual([]);
      expect(codes(out, "E1572"), brief(out).concat(" (the edit's own error)")).not.toEqual([]);
      expect(codes(keel(t.dir, ["check", "--frozen"]), "E1005")).toEqual([]);
    },
    SLOW,
  );

  test(
    "a version 2 surface.json whose sources hashes differ is no staleness: only its bytes differ (k.compat Surface, k.derived Frozen)",
    () => {
      const t = fresh(api);
      const text = read(t.dir, ".keel/surface.json");
      put(
        t.dir,
        ".keel/surface.json",
        text.replace('"version":3', '"version":2,"sources":{"modules/app/routes.ts":"fnv1a:00000000"}'),
      );
      const out = keel(t.dir, ["check"]);
      expect(codes(out, "E1005"), brief(out)).toEqual([]);
      expect(out.refreshed).toBe(1);
      expect(read(t.dir, ".keel/surface.json")).toBe(text);
    },
    SLOW,
  );
});

describe("k.derived: keel test and the a11y artifacts", () => {
  /** A project with one page `m.r`, one passing `renderRoute` test, built. */
  function a11yProject(): string {
    const dir = keelProject("derived-a11y", {
      "topology.ts": TOPOLOGY,
      "modules/m/m.contract.ts": `import { contract } from "@keel/router/contract";\nexport const m = contract("m", {\n  "m.r": { path: "/r" },\n});\n`,
      "tsconfig.json": `${JSON.stringify({ extends: "@keel/compiler/tsconfig.strict.json", compilerOptions: { jsxImportSource: "@keel/runtime-dom" }, include: ["modules"] }, null, 2)}\n`,
      "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`,
      "vite.config.ts": `import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n`,
      "modules/m/Page.tsx": `import { Button } from "@keel/ui";\n\nexport default function Page() {\n  return (\n    <Button id="p.b" type="button">\n      Go\n    </Button>\n  );\n}\n`,
      "modules/m/routes.ts": `import { manifest } from "@keel/router";\nimport { m } from "./m.contract.ts";\nimport Page from "./Page.tsx";\n\nexport const routes = manifest(m, {\n  "m.r": { component: Page, title: () => "r" },\n});\n`,
      "modules/m/test/r.test.ts": `${testHead(false)}
it("renders the route r", async () => {
  const h = await renderRoute("m.r", { routes, ctx: ctx() });
  expect(h.find("p.b").text).toBe("Go");
  h.dispose();
});
`,
    });
    dirs.push(dir);
    build(dir);
    return dir;
  }

  /** `text` (an a11y.json) with the role of element `id` set to `role`. */
  function withRole(text: string, id: string, role: string): string {
    const v: unknown = JSON.parse(text);
    if (typeof v !== "object" || v === null) throw new Error("a11y.json is no object");
    const data: unknown = Reflect.get(v, "data");
    if (typeof data !== "object" || data === null) throw new Error("a11y.json holds no data");
    const entry: unknown = Reflect.get(data, id);
    if (typeof entry !== "object" || entry === null) throw new Error(`a11y.json holds no ${id}`);
    Reflect.set(entry, "role", role);
    return `${JSON.stringify(v)}\n`;
  }

  test(
    'In a fixture whose page renders `<button id="p.b">` and whose test renders it with `renderRoute`, replacing `.keel/a11y.json` with one giving `p.b` role `link` leaves `keel test` passing.',
    () => {
      const dir = a11yProject();
      const good = read(dir, ".keel/a11y.json");
      put(dir, ".keel/a11y.json", withRole(good, "p.b", "link"));
      const out = keel(dir, ["test"]);
      expect(codes(out, "E1702"), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
      expect(read(dir, ".keel/a11y.json")).toBe(good);
    },
    SLOW,
  );

  test(
    "In that fixture with `.keel/` deleted, a passing `renderRoute` under `keel test` records a run whose `rules` hold E1702.",
    () => {
      const dir = a11yProject();
      rmSync(join(dir, ".keel"), { recursive: true, force: true });
      const out = keel(dir, ["test"]);
      expect(out.status, brief(out)).toBe(0);
      const runs = runsOf(dir).filter((r) => r.route === "m.r");
      expect(runs.length).toBeGreaterThan(0);
      for (const r of runs) expect(r.rules).toContain("E1702");
    },
    SLOW,
  );

  test(
    "In that copy, after renaming an element id in a page component, `keel check` reports no E1005 and leaves `.keel/ids.json` and `.keel/a11y.json` byte-identical to what `keel build` writes." +
      " (keel test after the rename: it passes and leaves the views a build writes)",
    () => {
      const t = fresh(houseTree());
      sub(t.dir, "modules/app/StartPage.tsx", 'id="app.start.intro"', 'id="app.start.lead"');
      sub(t.dir, "test/start.test.ts", "app.start.intro", "app.start.lead");
      const out = keel(t.dir, ["test", "test/start.test.ts"]);
      expect(out.status, brief(out)).toBe(0);
      matchesBuild(t.dir);
    },
    SLOW,
  );

  test(
    "In a fixture with one page route `r` and a passing `renderRoute` test of it, with `.keel/` deleted, `keel test` then `keel ledger` give the same `a11y:.:r#<criterion>` items and rungs as with `.keel/` present, and a page route `s` added after `keel build` with no build since gets its `a11y:.:s#<criterion>` items.",
    () => {
      const dir = a11yProject();
      expect(keel(dir, ["test"]).status).toBe(0);
      const present = a11yItems(dir);
      expect(present.length).toBeGreaterThan(0);
      for (const i of present) expect(i).toMatch(/^a11y:\.:m\.r#/);
      rmSync(join(dir, ".keel"), { recursive: true, force: true });
      expect(keel(dir, ["test"]).status).toBe(0);
      expect(a11yItems(dir)).toEqual(present);
      sub(dir, "modules/m/m.contract.ts", "});\n", '  "m.s": { path: "/s" },\n});\n');
      sub(dir, "modules/m/routes.ts", "});\n", '  "m.s": { component: Page, title: () => "s" },\n});\n');
      const added = a11yItems(dir);
      expect(added.filter((i) => i.startsWith("a11y:.:m.s#")).length).toBeGreaterThan(0);
      expect(added.filter((i) => i.startsWith("a11y:.:m.r#"))).toEqual(present);
    },
    SLOW,
  );
});

describe("k.derived: other readers and writers", () => {
  test(
    "`keel lsp` diagnostics for an unsaved buffer adding the page route of clause 1 write no file in `.keel/`.",
    async () => {
      const t = fresh(api);
      age(t.dir);
      const before = snapshot(t.dir);
      const frame = (m: unknown): string => {
        const body = JSON.stringify(m);
        return `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n${body}`;
      };
      const server = lsp(() => ({ cwd: t.dir, files: [] }));
      await server.receive(
        frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: `file://${t.dir}` } }),
      );
      const text = read(t.dir, CONTRACT).replace("});\n", '  "app.about": { path: "/about" },\n});\n');
      await server.receive(
        frame({
          jsonrpc: "2.0",
          method: "textDocument/didOpen",
          params: { textDocument: { uri: `file://${t.dir}/${CONTRACT}`, languageId: "typescript", version: 1, text } },
        }),
      );
      expect(changed(before, snapshot(t.dir))).toEqual([]);
    },
    SLOW,
  );

  test(
    "Two `keel check` processes started together after the edit of clause 1 both exit 0, and afterwards each `.keel/` file is byte-identical to what `keel build` writes and no `*.tmp` file is left.",
    async () => {
      const t = edited();
      const [a, b] = await Promise.all([keelAsync(t.dir, ["check"]), keelAsync(t.dir, ["check"])]);
      expect(a.status, brief(a)).toBe(0);
      expect(b.status, brief(b)).toBe(0);
      expect(tmpFiles(t.dir)).toEqual([]);
      matchesBuild(t.dir);
    },
    SLOW,
  );

  const cacheFiles = (dir: string): string[] => {
    const out: string[] = [];
    const walk = (d: string): void => {
      if (!existsSync(d)) return;
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(d, e.name));
        else out.push(join(d, e.name));
      }
    };
    walk(join(dir, CACHE, "derived"));
    return out;
  };

  test(
    "After one `keel check`, replacing each entry in `node_modules/.cache/keel/derived/` with `{}` or its first 40 bytes leaves the next `keel check` printing the same stdout bytes and writing the same files as a run with the folder deleted.",
    () => {
      const t = edited();
      keel(t.dir, ["check"]);
      expect(cacheFiles(t.dir).length, "an entry of the derivation cache").toBeGreaterThan(0);
      rmSync(join(t.dir, CACHE), { recursive: true, force: true });
      const control = keel(t.dir, ["check"]);
      const controlFiles = snapshot(t.dir);
      for (const damage of [(_: string) => "{}", (s: string) => s.slice(0, 40)]) {
        for (const f of cacheFiles(t.dir)) writeFileSync(f, damage(readFileSync(f, "utf8")));
        const out = keel(t.dir, ["check"]);
        expect(out.stdout).toBe(control.stdout);
        expect(out.status).toBe(control.status);
        expect(changed(controlFiles, snapshot(t.dir))).toEqual([]);
      }
    },
    SLOW,
  );

  test(
    "After one `keel check` of the household copy, rewriting a file of the linked `@keel/std-text` copy that the evaluation loaded, with its old modification time, makes the next `keel check` evaluate again, as a run with `node_modules/.cache/keel` deleted does.",
    () => {
      const mk = (): Tree => {
        const t = fresh(houseTree());
        expect(keel(t.dir, ["check"]).status).toBe(0);
        return t;
      };
      const warm = mk();
      editStdText(warm, "min ?? 1", "min ?? 2", true);
      const out = keel(warm.dir, ["check"]);
      const cold = mk();
      editStdText(cold, "min ?? 1", "min ?? 2", true);
      rmSync(join(cold.dir, "node_modules/.cache/keel"), { recursive: true, force: true });
      const control = keel(cold.dir, ["check"]);
      expect(out.stdout).toBe(control.stdout);
      expect(read(warm.dir, ".keel/surface.json")).toBe(read(cold.dir, ".keel/surface.json"));
      expect(read(warm.dir, ".keel/surface.json")).toContain("line(2..40)");
    },
    SLOW,
  );

  test(
    "After one `keel check`, re-indenting a contract file and adding a comment to it makes the next `keel check` write no file.",
    () => {
      const t = edited();
      expect(keel(t.dir, ["check"]).status).toBe(0);
      const text = read(t.dir, CONTRACT);
      put(
        t.dir,
        CONTRACT,
        `// a comment\n${text
          .split("\n")
          .map((l) => (l === "" ? l : `      ${l.trimStart()}`))
          .join("\n")}`,
      );
      age(t.dir);
      const before = snapshot(t.dir);
      const out = keel(t.dir, ["check"]);
      expect(out.status, brief(out)).toBe(0);
      expect(changed(before, snapshot(t.dir))).toEqual([]);
      expect(out.refreshed).toBe(0);
    },
    SLOW,
  );

  test(
    "While `keel dev` serves the copy of clause 1, within 2 s of the edit `.keel/routes.json` is byte-identical to what `keel build` writes, and a `keel check` run then writes no file.",
    async () => {
      const want = edited();
      build(want.dir);
      const expected = read(want.dir, ".keel/routes.json");
      const t = fresh(api);
      const port = await freePort();
      const child = spawn(process.execPath, [BIN, "dev", "--port", String(port)], {
        cwd: t.dir,
        env: childEnv({}),
        detached: true,
        stdio: "ignore",
      });
      children.push(child);
      const stop = (): Promise<void> =>
        new Promise((resolve) => {
          if (child.exitCode !== null || child.pid === undefined) return resolve();
          child.once("exit", () => resolve());
          process.kill(-child.pid, "SIGTERM");
        });
      try {
        expect(await until(() => canConnect(port), fixedTime(120_000)), "keel dev serves").toBe(true);
        addRoute(t.dir);
        expect(await until(() => read(t.dir, ".keel/routes.json") === expected, fixedTime(2_000))).toBe(true);
        const skip = ["node_modules", ".keel-dev", "dist"];
        const before = snapshot(t.dir, skip);
        const out = keel(t.dir, ["check"]);
        expect(out.status, brief(out)).toBe(0);
        expect(changed(before, snapshot(t.dir, skip))).toEqual([]);
      } finally {
        await stop();
      }
    },
    SLOW,
  );

  test(
    "No fixture makes `keel check` report W1005.",
    () => {
      const t = fresh(api);
      sub(t.dir, CONTRACT, "export const app", 'const base = "/rel";\nexport const app');
      sub(t.dir, CONTRACT, 'path: "/releases"', 'path: base + "eases"');
      for (const args of [["check"], ["check", "--frozen"]]) noW1005(keel(t.dir, args));
      const h = fresh(houseTree());
      for (const args of [["check"], ["check", "--frozen"]]) noW1005(keel(h.dir, args));
    },
    SLOW,
  );

  test(
    "`keel scaffold project p` writes a `.gitignore` holding the lines `.keel/a11y.json`, `.keel/deps.json`, `.keel/ids.json`, `.keel/routes.json`, `.keel/std.json` and `.keel/styles.json`, and no line matching `.keel/surface.json`.",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "keel-derived-scaffold-"));
      dirs.push(dir);
      const out = keel(dir, ["scaffold", "project", "p"]);
      expect(out.status, brief(out)).toBe(0);
      const lines = read(join(dir, "p"), ".gitignore").split("\n");
      for (const v of ["a11y", "deps", "ids", "routes", "std", "styles"]) expect(lines).toContain(`.keel/${v}.json`);
      expect(lines.filter((l) => l.includes(".keel/surface.json"))).toEqual([]);
    },
    SLOW,
  );
});

// k.derived Derivations: a derivation that fails reports its codes at `keel check` as at `keel build`, and writes no view (no numbered clause; k.compat's E1006 clause is asserted in compat-0092.test.ts).

describe("k.derived: tokens are evaluated by each run", () => {
  /** `tokens.ts` whose page text takes a colour of 1.53:1 against its background (ASSUMED: the page text takes `base.page`'s `fg` on its `bg`, as `brandTokens` names them). */
  const PALE = [
    'import { brandTokens } from "@keel/ui/brand";',
    "",
    "export const tokens = {",
    "  ...brandTokens,",
    '  color: { ...brandTokens.color, muted: "#cccccc" },',
    '  base: { ...brandTokens.base, page: { ...brandTokens.base.page, fg: "muted" } },',
    "};",
    "",
  ].join("\n");

  test(
    "After `keel build` of the copy of clause 1, setting the colour its page text uses so that text falls under 4.5:1 against its background makes the next `keel check` report E1804 at that text and write no file.",
    () => {
      const t = fresh(api);
      put(t.dir, "tokens.ts", PALE);
      age(t.dir);
      const before = snapshot(t.dir);
      const out = keel(t.dir, ["check"]);
      const hits = codes(out, "E1804");
      expect(hits.length, brief(out)).toBeGreaterThan(0);
      expect(changed(before, snapshot(t.dir))).toEqual([]);
    },
    SLOW,
  );
});
