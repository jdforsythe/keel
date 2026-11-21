// Seed 1337. `KEEL_POSTGRES_URL` in `deploy/compose.yaml` (k.deploy Deploy files) beside the storage URL: a deployable
// whose modules (deps included) list `@keel/std-postgres` gets it, required, whatever its storage; no other does.
import { deployFiles } from "@keel/scaffold";
import fc from "fast-check";
import { expect, test } from "vitest";

const LINE = "      KEEL_POSTGRES_URL: ${KEEL_POSTGRES_URL:?}";

test("each node deployable listing @keel/std-postgres gets one required KEEL_POSTGRES_URL line; the rest none", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          pg: fc.boolean(),
          storage: fc.constantFrom("file" as const, "sqlite" as const, "postgres" as const),
        }),
        {
          minLength: 1,
          maxLength: 4,
        },
      ),
      (specs) => {
        const topology = Object.fromEntries(
          specs.map((d, i) => [
            `d${i}`,
            {
              adapter: "node" as const,
              storage: d.storage,
              modules: d.pg ? [`m${i}`, "@keel/std-postgres"] : [`m${i}`],
            },
          ]),
        );
        const text = deployFiles(topology, { ci: false }).get("deploy/compose.yaml") ?? "";
        const blocks = text.split(/\n(?= {2}\S)/);
        for (const [i, d] of specs.entries()) {
          const block = blocks.find((b) => b.startsWith(`  d${i}:`)) ?? "";
          expect(block.split("\n").filter((l) => l === LINE)).toHaveLength(d.pg ? 1 : 0);
          expect(block.includes("KEEL_DATABASE_URL: ${KEEL_DATABASE_URL:?}")).toBe(d.storage === "postgres");
        }
      },
    ),
    { seed: 1337, numRuns: 50 },
  );
});
