// Spec: k.compat, clause "With a base for which `keel check --base` reports one E1562, re-indenting the contract file and adding a comment to it leaves that one E1562 and adds no E1005."
// Seed 1337. Real binary over a temp project (compat-support.ts): the base is the surface of an earlier build, the current contract adds a required
// body field `note` (module `a` in deployable `x`, module `y` in deployable `y`), the build is run, and only then the contract is re-indented and commented.
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import { baseSurface, cleanup, diags, keel, project, readText, write } from "./compat-support.ts";
import { SLOW, stale } from "./surface-normal-support.ts";

const SEED = 1337;
const CONTRACT = "modules/y/y.contract.ts";
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

test(
  "With a base for which `keel check --base` reports one E1562, re-indenting the contract file and adding a comment to it leaves that one E1562 and adds no E1005.",
  () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.stringMatching(/^[a-z ]{1,12}$/),
        fc.boolean(),
        (indent, words, block) => {
          const b = baseSurface(project({ body: "s.object({ name: s.string() })", split: true }));
          dirs.push(b.dir);
          write(b.dir, project({ body: "s.object({ name: s.string(), note: s.string() })", split: true }));
          expect(keel(b.dir, ["build"]).status).toBe(0);
          const before = keel(b.dir, ["check", "--base", b.base]);
          expect(diags(before, "E1562")).toHaveLength(1);
          expect(stale(before)).toEqual([]);

          const pad = " ".repeat(indent);
          const reindented = readText(b.dir, CONTRACT)
            .split("\n")
            .map((l) => (l.trim() === "" ? l : `${pad}${l}`))
            .join("\n");
          const comment = block ? `/* ${words} */` : `// ${words}`;
          write(b.dir, { [CONTRACT]: `${comment}\n${reindented}\n${comment}\n` });
          const after = keel(b.dir, ["check", "--base", b.base]);
          expect(diags(after, "E1562")).toHaveLength(1);
          expect(stale(after)).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 3 },
    );
  },
  SLOW,
);
