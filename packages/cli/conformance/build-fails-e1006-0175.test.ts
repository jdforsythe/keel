// Spec: k.compiler, Conformance "`keel build` of a project whose `modules/a/routes.ts` throws prints one E1006 naming that file, counts it among its summary's errors and exits 1, with a `client` deployable and with `node` ones only."
// Seed 1337 (the thrown message is generated). Assumes: exit status 1; one `diag` record with code E1006 whose path or message names `modules/a/routes.ts`; the final `summary` record carries a numeric `errors` of at least 1 (the summary's field name is not stated by the spec text).
// Pending: the build exits 0 on E1006 today.
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, SLOW, cleanup, keelRun, materialize, nodeTree, clientTree, type Tree } from "./boundary-support.ts";

const throwing = (tree: Tree, message: string): Tree => ({
  ...tree,
  "modules/a/routes.ts": `throw new Error(${JSON.stringify(message)})\nexport const routes = {}\n`,
});

test.skip(
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
          const errors = typeof summary === "object" && summary !== null ? Reflect.get(summary, "errors") : undefined;
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
