// Spec: k.check-cache, clause "In the household copy of k.derived clause 9 whose `modules/setup/gate.guard.ts` imports a package whose top level reads `statSync(<f>).mtimeMs` of a file `f.txt` in the copy, after one `keel check`, setting `f.txt`'s modification time makes the next `keel check` have `counts.evaluated` 1; with `.ino` read instead, so does replacing `f.txt` by a copy of the same bytes and time; with only its bytes and `size` read, setting its time leaves `counts.cached` 1."
// Spec: k.check-cache, clause "In that copy with the package reading `process.env.REPRO_X` through `Object.getOwnPropertyDescriptor(globalThis, 'process').get.call(globalThis)`, a `keel check` with `REPRO_X=2` after one with `REPRO_X=1` has `counts.evaluated` 1."
// Spec: k.check-cache, clause "In that copy with the package reading `new Date(0).getHours()` and `new Intl.NumberFormat().resolvedOptions().locale`, after one `keel check` with `TZ=UTC` and `LC_ALL=en_US.UTF-8`, a second with both has `counts.cached` 1, and one with `TZ=Asia/Tokyo` or with `LC_ALL=de_DE.UTF-8` has `counts.evaluated` 1."
// Also states, k.check-cache Evaluation probes: "A build-time evaluation (k.compiler Build-time evaluation) records, besides its inputs (k.derived Derivation cache): each lookup of its resolver and of `require` (each candidate file, `node_modules/<name>`, `package.json` and `tsconfig.json` `paths` target tried up to the one that answers, all for a name resolving to nothing) and each loaded file's nearest `package.json` and `tsconfig.json` (and its `extends`); each `node:fs` open for reading, existence test, stat (kind, size, mode), real path and listing, promised too; each field of a stat result the code reads (`mtimeMs`, `ino`), by its value; each `process.env` name; each stable fact of `process`, `os`, `tty` and `navigator` read or called (`cwd()`), with its arguments; and always the working folder, Node's version and the default locale and time zone, which `Date` and `Intl` read."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case; the `*.server.ts` file is `modules/setup/gate.guard.ts` (derived-cache-observed-support.ts),
// importing a package `p` (derived-cache-loader-support.ts `pkg`) whose default export is the string the guard's redirect compares: `routes.json` holds the redirect, so a stale hit shows in it as well as in the counts.
// "Setting its modification time" is `utimesSync` to a second later than the old one (a fixed second, no clock); `f.txt` is written with an old time first.
// "Replacing `f.txt` by a copy of the same bytes and time": `g.txt` copied from it, given its old time, and renamed over it (a new inode).
// A hit is `counts.evaluated` 0 and `counts.cached` 1.
// UNTESTABLE: Node's version as an always-probe ("always the working folder, Node's version ...") cannot be varied here: one Node runs the suite and none of the three clauses names a run under another.
import { copyFileSync, renameSync, statSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { pkg } from "./derived-cache-loader-support.ts";
import { guardFile, putOld } from "./derived-cache-observed-support.ts";
import { OLD, type Tree, brief, cloneTree, dropTree, householdTree, keel, read } from "./derived-support.ts";

const SLOW = testTime(600_000);
const TYPES = "declare const x: string;\nexport default x;\n";
const LATER = OLD + 1000;

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

/** A copy whose guard imports `p`, whose `index.mjs` is `code` (default export a string), and whose redirect is `members.signin` while that string is `expected`. */
function withPackage(code: string, expected: string): Tree {
  const t = copy();
  pkg(t, "p", "index.mjs", code, TYPES);
  guardFile(t, 'import p from "p";\nvoid p;', `p === ${JSON.stringify(expected)} ? "members.signin" : "app.start"`);
  return t;
}

describe("k.check-cache: a stat field the code reads is keyed, by its value", () => {
  const f = (t: Tree): string => JSON.stringify(join(t.dir, "f.txt"));
  /** A copy whose package exports `field` of `statSync(f.txt)`, after one `keel check` that saw `f.txt` at its old time. */
  const warm = (field: "mtimeMs" | "ino"): { t: Tree; first: string } => {
    const t = copy();
    const at = putOld(t, "f.txt", "same bytes");
    const expected = field === "mtimeMs" ? `${OLD * 1000}` : String(statSync(at).ino);
    pkg(
      t,
      "p",
      "index.mjs",
      `import { statSync } from 'node:fs';\nexport default String(statSync(${f(t)}).${field});\n`,
      TYPES,
    );
    guardFile(t, 'import p from "p";\nvoid p;', `p === ${JSON.stringify(expected)} ? "members.signin" : "app.start"`);
    const out = keel(t.dir, ["check"]);
    expect(out.status, brief(out)).toBe(0);
    expect(out.counts.evaluated, brief(out)).toBe(1);
    const first = read(t.dir, ".keel/routes.json");
    expect(first).toContain("members.signin");
    return { t, first };
  };

  test(
    "reading `statSync(<f>).mtimeMs`, setting `f.txt`'s modification time makes the next `keel check` have `counts.evaluated` 1",
    () => {
      const { t, first } = warm("mtimeMs");
      utimesSync(join(t.dir, "f.txt"), LATER, LATER);
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).not.toBe(first);
      expect(read(t.dir, ".keel/routes.json")).toContain("app.start");
    },
    SLOW,
  );

  test(
    "reading `statSync(<f>).mtimeMs`, setting `f.txt`'s modification time to the one it has is a hit",
    () => {
      const { t, first } = warm("mtimeMs");
      utimesSync(join(t.dir, "f.txt"), OLD, OLD);
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
      expect(read(t.dir, ".keel/routes.json")).toBe(first);
    },
    SLOW,
  );

  test(
    "with `.ino` read instead, replacing `f.txt` by a copy of the same bytes and time makes the next `keel check` have `counts.evaluated` 1",
    () => {
      const { t, first } = warm("ino");
      const g = join(t.dir, "g.txt");
      copyFileSync(join(t.dir, "f.txt"), g);
      utimesSync(g, OLD, OLD);
      renameSync(g, join(t.dir, "f.txt"));
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).not.toBe(first);
      expect(read(t.dir, ".keel/routes.json")).toContain("app.start");
    },
    SLOW,
  );

  describe("with only its bytes and `size` read", () => {
    const readOnly = (): { t: Tree; first: string } => {
      const t = copy();
      putOld(t, "f.txt", "same bytes");
      pkg(
        t,
        "p",
        "index.mjs",
        `import { readFileSync, statSync } from 'node:fs';\nexport default readFileSync(${f(t)}, 'utf8') + statSync(${f(t)}).size;\n`,
        TYPES,
      );
      guardFile(t, 'import p from "p";\nvoid p;', 'p === "same bytes10" ? "members.signin" : "app.start"');
      const out = keel(t.dir, ["check"]);
      expect(out.status, brief(out)).toBe(0);
      const first = read(t.dir, ".keel/routes.json");
      expect(first).toContain("members.signin");
      return { t, first };
    };

    test(
      "setting `f.txt`'s modification time leaves `counts.cached` 1",
      () => {
        const { t, first } = readOnly();
        utimesSync(join(t.dir, "f.txt"), LATER, LATER);
        const out = keel(t.dir, ["check"]);
        expect(out.counts.evaluated, brief(out)).toBe(0);
        expect(out.counts.cached, brief(out)).toBe(1);
        expect(read(t.dir, ".keel/routes.json")).toBe(first);
      },
      SLOW,
    );

    test(
      "a file only read for content and rewritten with the same bytes and a new modification time is a hit",
      () => {
        const { t, first } = readOnly();
        const at = putOld(t, "f.txt", "same bytes");
        utimesSync(at, LATER, LATER);
        const out = keel(t.dir, ["check"]);
        expect(out.counts.evaluated, brief(out)).toBe(0);
        expect(out.counts.cached, brief(out)).toBe(1);
        expect(read(t.dir, ".keel/routes.json")).toBe(first);
      },
      SLOW,
    );
  });
});

describe("k.check-cache: a `process.env` name read through the descriptor route is observed", () => {
  const PROCESS = "Object.getOwnPropertyDescriptor(globalThis, 'process').get.call(globalThis)";
  const warm = (): { t: Tree; first: string } => {
    const t = withPackage(`export default String(${PROCESS}.env.REPRO_X ?? '0');\n`, "1");
    const out = keel(t.dir, ["check"], { REPRO_X: "1" });
    expect(out.status, brief(out)).toBe(0);
    const first = read(t.dir, ".keel/routes.json");
    expect(first).toContain("members.signin");
    return { t, first };
  };

  test(
    "a `keel check` with `REPRO_X=2` after one with `REPRO_X=1` has `counts.evaluated` 1",
    () => {
      const { t, first } = warm();
      const out = keel(t.dir, ["check"], { REPRO_X: "2" });
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).not.toBe(first);
    },
    SLOW,
  );

  test(
    "a `keel check` with `REPRO_X=1` again is a hit",
    () => {
      const { t, first } = warm();
      const out = keel(t.dir, ["check"], { REPRO_X: "1" });
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
      expect(read(t.dir, ".keel/routes.json")).toBe(first);
    },
    SLOW,
  );

  test(
    "a `keel check` with `REPRO_X` unset after one with `REPRO_X=1` has `counts.evaluated` 1",
    () => {
      const { t } = warm();
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
    },
    SLOW,
  );
});

describe("k.check-cache: the default locale and time zone are probes of every evaluation", () => {
  const UTC = { TZ: "UTC", LC_ALL: "en_US.UTF-8", LANG: "en_US.UTF-8" };
  const warm = (): { t: Tree; first: string } => {
    const t = withPackage(
      "export default new Date(0).getHours() + ' ' + new Intl.NumberFormat().resolvedOptions().locale;\n",
      "0 en-US",
    );
    const out = keel(t.dir, ["check"], UTC);
    expect(out.status, brief(out)).toBe(0);
    const first = read(t.dir, ".keel/routes.json");
    expect(first).toContain("members.signin");
    return { t, first };
  };

  test(
    "a second `keel check` with `TZ=UTC` and `LC_ALL=en_US.UTF-8` has `counts.cached` 1",
    () => {
      const { t, first } = warm();
      const out = keel(t.dir, ["check"], UTC);
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
      expect(read(t.dir, ".keel/routes.json")).toBe(first);
    },
    SLOW,
  );

  test(
    "one with `TZ=Asia/Tokyo` has `counts.evaluated` 1",
    () => {
      const { t, first } = warm();
      const out = keel(t.dir, ["check"], { ...UTC, TZ: "Asia/Tokyo" });
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).not.toBe(first);
    },
    SLOW,
  );

  test(
    "one with `LC_ALL=de_DE.UTF-8` has `counts.evaluated` 1",
    () => {
      const { t, first } = warm();
      const out = keel(t.dir, ["check"], { ...UTC, LC_ALL: "de_DE.UTF-8", LANG: "de_DE.UTF-8" });
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(out.counts.cached, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).not.toBe(first);
    },
    SLOW,
  );
});
