// Spec: k.compiler, clause "That `*.server.ts` file importing a package whose top level awaits `import()` of a name built at run time, the absolute path of a file `c.cjs`, makes `keel check` report one E1050 and exit 1; of a file `m.json`, after one `keel check`, changing `m.json`'s bytes makes the next `keel check` have `counts.evaluated` 1."
// Also states, k.compiler Build-time evaluation: "A `require` from `createRequire` takes a built-in, a `.json` file or a name resolving to nothing (Node's not-found error); a computed `import()` and another `require`, a built-in, an absolute path or a name bundling left unresolved."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case; the `*.server.ts` file is `modules/setup/gate.guard.ts` (derived-cache-observed-support.ts).
// The package `dyn-like` holds the `import()`, as the RFC's sketch does (app code may not: E1607); its name is built as `[<absolute path of the copy's c>, 'cjs'].join('.')`.
// A hit (`counts.cached` 1) is the control of each miss: the same bytes written again change nothing.
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { e1050Raw, pkg, writeAt } from "./derived-cache-loader-support.ts";
import { cacheEntries, dropCache, guardFile } from "./derived-cache-observed-support.ts";
import { type Tree, brief, cloneTree, dropTree, householdTree, keel, read } from "./derived-support.ts";

const SLOW = fixedTime(600_000);

let house: Tree | undefined;
const made: Tree[] = [];
afterAll(() => {
  for (const t of made) dropTree(t);
});
const copy = (): Tree => {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  const t = cloneTree(house);
  made.push(t);
  return t;
};

/** `dyn-like`: its top level awaits `import()` of `<absolute path of the copy's file>.<ext>`, built at run time. */
function dynLike(t: Tree, stem: string, ext: string): void {
  pkg(
    t,
    "dyn-like",
    "index.mjs",
    `const n = [${JSON.stringify(join(t.dir, stem))}, ${JSON.stringify(ext)}].join('.');\nexport default (await import(n)).default;\n`,
    "declare const x: { min: number };\nexport default x;\n",
  );
}

const REDIRECT = 'dyn.min === 1 ? "members.signin" : "app.start"';
const GUARD = 'import dyn from "dyn-like";\n';

describe("k.compiler: a computed `import()` in code the evaluation loads", () => {
  test(
    "That `*.server.ts` file importing a package whose top level awaits `import()` of a name built at run time, the absolute path of a file `c.cjs`, makes `keel check` report one E1050 and exit 1",
    () => {
      const t = copy();
      writeAt(t.dir, "modules/setup/c.cjs", "module.exports = { min: 1 };\n");
      dynLike(t, "modules/setup/c", "cjs");
      dropCache(t.dir);
      guardFile(t, GUARD, REDIRECT);
      const out = keel(t.dir, ["check"]);
      expect(e1050Raw(out), brief(out)).toHaveLength(1);
      expect(out.status, brief(out)).toBe(1);
      expect(cacheEntries(t.dir)).toEqual([]);
    },
    SLOW,
  );

  describe("of a file `m.json`", () => {
    const warm = (): { t: Tree; first: string } => {
      const t = copy();
      writeAt(t.dir, "modules/setup/m.json", '{"min":1}\n');
      dynLike(t, "modules/setup/m", "json");
      guardFile(t, GUARD, REDIRECT);
      const out = keel(t.dir, ["check"]);
      expect(e1050Raw(out), brief(out)).toEqual([]);
      expect(out.status, brief(out)).toBe(0);
      const first = read(t.dir, ".keel/routes.json");
      expect(first).toContain("members.signin");
      return { t, first };
    };

    test(
      "after one `keel check`, changing `m.json`'s bytes makes the next `keel check` have `counts.evaluated` 1",
      () => {
        const { t, first } = warm();
        writeAt(t.dir, "modules/setup/m.json", '{"min":2}\n');
        const out = keel(t.dir, ["check"]);
        expect(e1050Raw(out), brief(out)).toEqual([]);
        expect(out.counts.evaluated, brief(out)).toBe(1);
        expect(out.counts.cached, brief(out)).toBe(0);
        expect(read(t.dir, ".keel/routes.json")).not.toBe(first);
        expect(read(t.dir, ".keel/routes.json")).toContain("app.start");
      },
      SLOW,
    );

    test(
      "after one `keel check`, writing `m.json` with the same bytes makes the next `keel check` a hit: `counts.evaluated` 0 and `counts.cached` 1",
      () => {
        const { t, first } = warm();
        writeAt(t.dir, "modules/setup/m.json", '{"min":1}\n');
        const out = keel(t.dir, ["check"]);
        expect(out.counts.evaluated, brief(out)).toBe(0);
        expect(out.counts.cached, brief(out)).toBe(1);
        expect(read(t.dir, ".keel/routes.json")).toBe(first);
      },
      SLOW,
    );
  });
});
