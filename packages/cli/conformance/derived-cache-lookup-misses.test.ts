// Spec: k.compiler, clause "After one `keel check` of that file's project, the next has `counts.evaluated` 1 when one of these is created first: `bind.ts` beside the `bind/index.ts` it imports as `./bind`; `modules/setup/node_modules/<p>`, a copy of the project's package `<p>` it imports; `gen/h.ts`, its `@h/h` resolving to `src/h.ts` by `tsconfig.json` `baseUrl` `.` and `paths` `{"@h/*": ["gen/*", "src/*"]}`; `flag` in a package it imports, whose `existsSync(join(import.meta.dirname, 'flag'))` was false; `node_modules/absent-pkg/index.js`, for a package it imports whose top level is `try { module.exports = require('absent-pkg') } catch { module.exports = 0 }`."
// Also states, k.derived Derivation cache: "its probes, each other question either asks, with the answer (k.check-cache Probes), a path found absent too, whose creation is a miss."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case; the `*.server.ts` file is `modules/setup/gate.guard.ts` (derived-cache-observed-support.ts).
// Each case is "absent at lookup, then created, is a miss; not created, a hit": the first `keel check` has `counts.evaluated` 1; after the creation the next has `counts.evaluated` 1 and `counts.cached` 0; with nothing created the next has
// `counts.evaluated` 0 and `counts.cached` 1. Only counts are asserted (the `paths` case also reports E1751, since the type check does not take `paths`; the exit code is not asserted).
// Code app rules refuse sits in a package under `node_modules` (derived-cache-loader-support.ts), as the RFC's sketches place it.
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { linkAt, pkg, writeAt } from "./derived-cache-loader-support.ts";
import { guardFile } from "./derived-cache-observed-support.ts";
import { type Tree, brief, cloneTree, dropTree, householdTree, keel, sub } from "./derived-support.ts";

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

type Case = {
  name: string;
  /** Builds the project where the thing looked for is absent. */
  prepare: (t: Tree) => void;
  /** Creates it. */
  create: (t: Tree) => void;
};

const CASES: readonly Case[] = [
  {
    name: "`bind.ts` beside the `bind/index.ts` the guard imports as `./bind`",
    prepare: (t) => {
      writeAt(t.dir, "modules/setup/bind/index.ts", "export const bind = 1;\n");
      guardFile(t, 'import { bind } from "./bind";', 'bind === 1 ? "members.signin" : "app.start"');
    },
    create: (t) => {
      writeAt(t.dir, "modules/setup/bind.ts", "export const bind = 2;\n");
    },
  },
  {
    name: "`modules/setup/node_modules/@keel/schema`, a nearer copy of the package the guard imports",
    prepare: (t) => {
      guardFile(t, "");
    },
    create: (t) => {
      linkAt(
        join(t.dir, "modules/setup/node_modules/@keel/schema"),
        realpathSync(join(t.dir, "node_modules/@keel/schema")),
      );
    },
  },
  {
    name: "`gen/h.ts`, before `src/h.ts` in the `paths` target list of `@h/h`",
    prepare: (t) => {
      sub(
        t.dir,
        "tsconfig.json",
        '"jsxImportSource": "@keel/runtime-dom",',
        '"jsxImportSource": "@keel/runtime-dom",\n    "baseUrl": ".",\n    "paths": { "@h/*": ["gen/*", "src/*"] },',
      );
      writeAt(t.dir, "src/h.ts", "export const h = 1;\n");
      guardFile(t, 'import { h } from "@h/h";', 'h === 1 ? "members.signin" : "app.start"');
    },
    create: (t) => {
      writeAt(t.dir, "gen/h.ts", "export const h = 2;\n");
    },
  },
  {
    name: "`flag` in the package the guard imports, whose `existsSync(join(import.meta.dirname, 'flag'))` was false",
    prepare: (t) => {
      pkg(
        t,
        "flag-like",
        "index.mjs",
        "import { existsSync } from 'node:fs';\nimport { join } from 'node:path';\nexport default existsSync(join(import.meta.dirname, 'flag'));\n",
        "declare const x: boolean;\nexport default x;\n",
      );
      guardFile(t, 'import flag from "flag-like";', 'flag ? "members.signin" : "app.start"');
    },
    create: (t) => {
      writeAt(t.dir, "node_modules/flag-like/flag", "");
    },
  },
  {
    name: "`node_modules/absent-pkg/index.js` for a package the guard imports whose top level is `try { module.exports = require('absent-pkg') } catch { module.exports = 0 }`",
    prepare: (t) => {
      pkg(
        t,
        "opt-like",
        "index.cjs",
        "try { module.exports = require('absent-pkg') } catch { module.exports = 0 }\n",
        "declare const x: number;\nexport default x;\n",
      );
      guardFile(t, 'import opt from "opt-like";', 'opt === 1 ? "members.signin" : "app.start"');
    },
    create: (t) => {
      pkg(t, "absent-pkg", "index.js", "module.exports = 1;\n");
    },
  },
];

describe.each(CASES)("k.derived: a lookup that found nothing, $name", (c) => {
  /** A copy after its first `keel check`, which evaluates once. */
  const warm = (): Tree => {
    const t = copy();
    c.prepare(t);
    const first = keel(t.dir, ["check"]);
    expect(first.counts.evaluated, brief(first)).toBe(1);
    return t;
  };

  test(
    "after one `keel check`, creating it makes the next `keel check` have `counts.evaluated` 1 and `counts.cached` 0",
    () => {
      const t = warm();
      c.create(t);
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
    },
    SLOW,
  );

  test(
    "after one `keel check`, creating nothing makes the next `keel check` a hit: `counts.evaluated` 0 and `counts.cached` 1",
    () => {
      const t = warm();
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
    },
    SLOW,
  );
});
