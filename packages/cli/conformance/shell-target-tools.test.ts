// Spec: k.shell, clause "With `tools` giving two entries, the build prints two E1575, each naming its `tool` and `need`, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`."
// Seed: 1337 (the two entries are generated).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`); the stub's `build` logs each call to `build-calls.txt`.
// ASSUMPTION: "naming its `tool` and `need`" is the message holding both strings (the RFC gives the message `<tool> missing or too old: needs <need>`; the spec gives no text).
import { existsSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, SLOW, buildCalls, cleanup, run, setStub, stubProject, withCode } from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject();
}, SLOW);
afterAll(() => cleanup(dir));

const word = fc.stringMatching(/^[a-z]{4,10}$/);
const entry = fc.record({ tool: word, need: fc.tuple(word, fc.nat(30)).map(([w, n]) => `${w} ${n}.${n}`) });
const two = fc
  .tuple(entry, entry)
  .filter(
    ([a, b]) =>
      !a.tool.includes(b.tool) && !b.tool.includes(a.tool) && !a.need.includes(b.need) && !b.need.includes(a.need),
  );

describe("k.shell: tools over a stub package", () => {
  test(
    "With `tools` giving two entries, the build prints two E1575, each naming its `tool` and `need`, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`.",
    () => {
      fc.assert(
        fc.property(two, ([a, b]) => {
          setStub(dir, { tools: [a, b] });
          const r = run(dir, ["build", "--target", "tauri"]);
          const found = withCode(r, "E1575");
          expect(found).toHaveLength(2);
          for (const e of [a, b]) {
            const mine = found.filter((f) => String(f.message).includes(e.tool));
            expect(mine).toHaveLength(1);
            expect(String(mine[0]?.message)).toContain(e.need);
          }
          expect(r.status).toBe(1);
          expect(existsSync(join(dir, "dist", "web", "tauri"))).toBe(false);
          expect(buildCalls(dir)).toEqual([]);
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW,
  );
});
