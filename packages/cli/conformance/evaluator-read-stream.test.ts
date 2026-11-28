// Spec: k.evaluator, clause "In `G` with `index.mjs` holding `import { createReadStream } from 'node:fs'` and `const RS = createReadStream(<f>).constructor`, then `new RS(<g>, { flags: 'w' })`, `keel check` reports one E1050 and `<g>` keeps its bytes; with `export default (await new RS(<g>).toArray()).join('')` instead, after one `keel check`, changing `<g>`'s bytes makes the next `keel check` have `counts.evaluated` 1."
// Also states, k.evaluator Realm: "A view holds no object of Node's `node:fs`, `process` or `os`: what it returns (a stat result, a file handle, a read stream, a directory entry) is of the view's own classes, whose constructors ask as the view's functions do."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case (`G` of k.evaluator Conformance; evaluator-support.ts `gFixture`).
// `<f>` and `<g>` are two text files of the copy (`f.txt`, `g.txt`), their modification time kept old on every write so only the bytes tell. "Recorded or refused" is read as: the read half is no E1050 and is a miss when `<g>` changes and a hit (`counts.cached` 1) when it does not.
import { readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { OLD, type Tree, brief, cloneTree, dropTree, householdTree } from "./derived-support.ts";
import { gFixture, keelBounded, recordsOf } from "./evaluator-support.ts";

const SLOW = testTime(600_000);
const RUN = 60_000;

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

/** Writes `<f>` and `<g>` and returns their absolute paths. */
function files(t: Tree, g: string): { f: string; g: string } {
  const f = join(t.dir, "f.txt");
  const at = join(t.dir, "g.txt");
  writeFileSync(f, "f");
  writeFileSync(at, g);
  for (const p of [f, at]) utimesSync(p, OLD, OLD);
  return { f, g: at };
}

const head = (f: string): string =>
  `import { createReadStream } from 'node:fs'\nconst RS = createReadStream(${JSON.stringify(f)}).constructor\n`;

describe("k.evaluator: an object a view returns carries no host constructor", () => {
  test(
    "in `G` with `index.mjs` holding `import { createReadStream } from 'node:fs'` and `const RS = createReadStream(<f>).constructor`, then `new RS(<g>, { flags: 'w' })`, `keel check` reports one E1050 and `<g>` keeps its bytes",
    () => {
      const t = copy();
      const { f, g } = files(t, "keep");
      gFixture(t, `${head(f)}new RS(${JSON.stringify(g)}, { flags: 'w' })\nexport default 1\n`);
      const out = keelBounded(t.dir, ["check"], RUN);
      expect(recordsOf(out, "E1050"), brief(out)).toHaveLength(1);
      expect(out.status, brief(out)).toBe(1);
      expect(readFileSync(g, "utf8")).toBe("keep");
    },
    SLOW,
  );

  test(
    "with `export default (await new RS(<g>).toArray()).join('')` instead, after one `keel check`, changing `<g>`'s bytes makes the next `keel check` have `counts.evaluated` 1",
    () => {
      const t = copy();
      const { f, g } = files(t, "1");
      gFixture(t, `${head(f)}export default (await new RS(${JSON.stringify(g)}).toArray()).join('')\n`);
      const first = keelBounded(t.dir, ["check"], RUN);
      expect(recordsOf(first, "E1050"), brief(first)).toEqual([]);
      writeFileSync(g, "2");
      utimesSync(g, OLD, OLD);
      const next = keelBounded(t.dir, ["check"], RUN);
      expect(next.counts.evaluated, brief(next)).toBe(1);
      expect(next.counts.cached, brief(next)).toBe(0);
    },
    SLOW,
  );

  test(
    "with the read of `<g>` through that constructor and `<g>` unchanged, the next `keel check` has `counts.cached` 1 (the read was recorded)",
    () => {
      const t = copy();
      const { f, g } = files(t, "1");
      gFixture(t, `${head(f)}export default (await new RS(${JSON.stringify(g)}).toArray()).join('')\n`);
      keelBounded(t.dir, ["check"], RUN);
      const next = keelBounded(t.dir, ["check"], RUN);
      expect(next.counts.cached, brief(next)).toBe(1);
      expect(next.counts.evaluated, brief(next)).toBe(0);
    },
    SLOW,
  );
});
