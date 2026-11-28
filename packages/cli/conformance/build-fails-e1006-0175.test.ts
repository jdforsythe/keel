// Spec: k.compiler, clause "`keel build` of a project whose `modules/a/routes.ts` throws prints one E1006 naming that file, counts it among its summary's errors and exits 1, with a `client` deployable and with `node` ones only."
// Seed 1337 (the exported value is generated: a routes export that is no route table is E1006). Assumes: exit status 1; one `diag` record with code E1006 whose path or message names `modules/a/routes.ts`; the final `summary` record carries a numeric `counts.errors` of at least 1 (docs/OUTPUT.md).
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, SLOW, cleanup, keelRun, materialize, nodeTree, clientTree, type Tree } from "./boundary-support.ts";

const throwing = (tree: Tree, message: string): Tree => ({
  ...tree,
  "modules/a/routes.ts": `export const routes = ${JSON.stringify(message)}\n`,
});

test(
  "`keel build` of a project whose `modules/a/routes.ts` throws prints one E1006 naming that file, counts it among its summary's errors and exits 1, with a `client` deployable and with `node` ones only.",
  () => {
    fc.assert(
      fc.property(fc.constantFrom("client", "node"), fc.stringMatching(/^[a-z]{4,12}$/), (kind, word) => {
        const dir = materialize(throwing(kind === "client" ? clientTree() : nodeTree("node"), `boom-${word}`));
        try {
          const r = keelRun(dir, ["build"]);
          expect(r.status, r.out).toBe(1);
          const records = r.out
            .split("\n")
            .filter((l) => l.startsWith("{"))
            .map((l): unknown => JSON.parse(l));
          const e1006 = records.filter(
            (x) => typeof x === "object" && x !== null && Reflect.get(x, "code") === "E1006",
          );
          expect(e1006).toHaveLength(1);
          expect(JSON.stringify(e1006[0])).toContain("modules/a/routes.ts");
          const summary = records.find(
            (x) => typeof x === "object" && x !== null && Reflect.get(x, "kind") === "summary",
          );
          const counts = typeof summary === "object" && summary !== null ? Reflect.get(summary, "counts") : undefined;
          const errors = typeof counts === "object" && counts !== null ? Reflect.get(counts, "errors") : undefined;
          expect(typeof errors === "number" ? errors : 0).toBeGreaterThanOrEqual(1);
        } finally {
          cleanup(dir);
        }
      }),
      { seed: SEED, numRuns: 4 },
    );
  },
  SLOW,
);
