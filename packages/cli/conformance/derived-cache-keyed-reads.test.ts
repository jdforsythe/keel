// Spec: k.derived, clause "In the copy of clause 9 whose linked `@keel/std-text` reads `line`'s default `min` from its file `min.txt` with `readFileSync` at import time, after one `keel check`, changing `min.txt` from `1` to `2` makes the next `keel check` have `counts.evaluated` 1 and leave `.keel/surface.json` byte-identical to what `keel build` writes; with that default read from `process.env.LINE_MIN` instead, a `keel check` with `LINE_MIN=2` after one with `LINE_MIN=1` has `counts.evaluated` 1, and a third with `LINE_MIN=2` has `counts.cached` 1."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case; its modification time is left old on every write of `min.txt` so only the bytes tell.
// RE-BASED: a read by path in a file of `@keel/std-text` is reached by the browser bundle and fails `keel build` with E1007 (k.boundary Assertion; E1759 for `node:fs` in a browser file). The read by path sits where k.derived allows it, a server-only file (`modules/setup/gate.guard.ts`) of a module only a `node` deployable lists, imported by that module's `routes.ts`; `min.txt` lies in the project and decides the redirect of the guard of `setup.form`, which `routes.json` holds (k.router Artifacts), so the "byte-identical to what `keel build` writes" half is `.keel/routes.json`. The `process.env.LINE_MIN` cases keep reading in the linked `@keel/std-text` (a `process.env` read is no `node:fs` import).
// The `node:fs/promises` case and the "unread" cases state k.derived Derivation cache (inputs are each file the code reads through `node:fs` or `node:fs/promises`; probes each `process.env` name it reads) and are not part of the clause's one sentence.
// ASSUMED: the `node:fs/promises` reader is a top-level `await readFile(...)` at import time; a build that cannot bundle it fails that case for want of that, not of the cache.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import {
  lineSurface,
  readsMinEnv,
  readsMinFile,
  surfaceIsBuilt,
  viewIsBuilt,
  writeMin,
} from "./derived-cache-support.ts";
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
const lineMin = (n: number): Record<string, string> => ({ LINE_MIN: String(n) });

describe.each([["readFileSync" as const], ["readFile" as const]])(
  "k.derived: a file the evaluation reads through %s is an input",
  (reader) => {
    /** A copy whose `setup.form` guard's redirect reads `min.txt` (`1`), after one `keel check`; also the `routes.json` that run left. */
    const warm = (): { t: Tree; at: string; first: string } => {
      const t = copy();
      const at = readsMinFile(t, reader, "1");
      const run = keel(t.dir, ["check"]);
      expect(run.status, brief(run)).toBe(0);
      return { t, at, first: read(t.dir, ".keel/routes.json") };
    };

    test(
      `changing \`min.txt\` from \`1\` to \`2\` makes the next \`keel check\` have \`counts.evaluated\` 1 (${reader})`,
      () => {
        const { t, at } = warm();
        writeMin(at, "2");
        const out = keel(t.dir, ["check"]);
        expect(out.counts.evaluated, brief(out)).toBe(1);
        expect(out.counts.cached, brief(out)).toBe(0);
      },
      SLOW,
    );

    test(
      `changing \`min.txt\` from \`1\` to \`2\` leaves \`.keel/routes.json\` holding the new value, byte-identical to what \`keel build\` writes (${reader})`,
      () => {
        const { t, at, first } = warm();
        writeMin(at, "2");
        const out = keel(t.dir, ["check"]);
        expect(read(t.dir, ".keel/routes.json"), brief(out)).not.toBe(first);
        expect(viewIsBuilt(t, ".keel/routes.json")).toBe(true);
      },
      SLOW,
    );

    test(
      `changing a file the evaluation does not read, in the project or in the linked package, is a hit: \`counts.evaluated\` 0 and \`counts.cached\` 1 (${reader})`,
      () => {
        const { t } = warm();
        writeFileSync(join(t.dir, "unread.txt"), "one\n");
        writeFileSync(join(t.base, "std-text", "unread.txt"), "one\n");
        expect(keel(t.dir, ["check"]).counts.evaluated).toBe(0);
        writeFileSync(join(t.dir, "unread.txt"), "two\n");
        writeFileSync(join(t.base, "std-text", "unread.txt"), "two\n");
        const out = keel(t.dir, ["check"]);
        expect(out.counts.evaluated, brief(out)).toBe(0);
        expect(out.counts.cached, brief(out)).toBe(1);
      },
      SLOW,
    );
  },
);

describe("k.derived: a `process.env` name the evaluation reads is a probe", () => {
  /** A copy whose `line` reads `process.env.LINE_MIN`, after one `keel check` with `LINE_MIN=1`. */
  const warm = (): Tree => {
    const t = copy();
    readsMinEnv(t);
    const first = keel(t.dir, ["check"], lineMin(1));
    expect(first.status, brief(first)).toBe(0);
    expect(read(t.dir, ".keel/surface.json")).toContain(lineSurface(1));
    return t;
  };

  test(
    "with that default read from `process.env.LINE_MIN` instead, a `keel check` with `LINE_MIN=2` after one with `LINE_MIN=1` has `counts.evaluated` 1",
    () => {
      const t = warm();
      const out = keel(t.dir, ["check"], lineMin(2));
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(read(t.dir, ".keel/surface.json")).toContain(lineSurface(2));
      expect(surfaceIsBuilt(t, lineMin(2))).toBe(true);
    },
    SLOW,
  );

  test(
    "with that default read from `process.env.LINE_MIN` instead, a third `keel check` with `LINE_MIN=2` has `counts.cached` 1",
    () => {
      const t = warm();
      keel(t.dir, ["check"], lineMin(2));
      const out = keel(t.dir, ["check"], lineMin(2));
      expect(out.counts.cached, brief(out)).toBe(1);
      expect(out.counts.evaluated, brief(out)).toBe(0);
    },
    SLOW,
  );

  test(
    "a `keel check` with an env name the evaluation does not read changed is a hit: `counts.evaluated` 0 and `counts.cached` 1",
    () => {
      const t = warm();
      const out = keel(t.dir, ["check"], { ...lineMin(1), LINE_MAX_UNREAD: "9" });
      expect(out.counts.evaluated, brief(out)).toBe(0);
      expect(out.counts.cached, brief(out)).toBe(1);
      const again = keel(t.dir, ["check"], { ...lineMin(1), LINE_MAX_UNREAD: "10" });
      expect(again.counts.evaluated, brief(again)).toBe(0);
    },
    SLOW,
  );

  test(
    "the env name absent after a run that had it is a miss: `counts.evaluated` 1 and the default 1 in `.keel/surface.json`",
    () => {
      const t = warm();
      keel(t.dir, ["check"], lineMin(2));
      const out = keel(t.dir, ["check"]);
      expect(out.counts.evaluated, brief(out)).toBe(1);
      expect(read(t.dir, ".keel/surface.json")).toContain(lineSurface(1));
    },
    SLOW,
  );
});
