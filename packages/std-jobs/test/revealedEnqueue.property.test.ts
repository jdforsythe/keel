// E2506 over generated `enqueue` calls: one finding per call whose arguments carry a revealed value, at its line,
// whichever argument carries it; none for a value a hash ends. Seed 1337
import { check } from "@keel/check";
import "@keel/std-jobs/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const JOBS = {
  path: "modules/orders/jobs.server.ts",
  source: `import { queue } from "@keel/std-jobs"\nimport { mail } from "./mail.server.ts"\nexport const jobs = queue({ "orders.mail": mail })\n`,
};
/** One call: which argument (input or key) holds the value, and whether a hash ends it. */
const call = fc.record({ inKey: fc.boolean(), revealed: fc.boolean(), hashed: fc.boolean() });

test("E2506 is one finding per enqueue call carrying a revealed value, at its line", () => {
  fc.assert(
    fc.property(fc.array(call, { minLength: 1, maxLength: 6 }), (calls) => {
      const lines = calls.map((c) => {
        const v = c.revealed ? (c.hashed ? "hash(reveal(p.k))" : "reveal(p.k)") : "p.k";
        return c.inKey
          ? `  await jobs.enqueue(ctx, "orders.mail", { t: 1 }, { key: ${v} })`
          : `  await jobs.enqueue(ctx, "orders.mail", { t: ${v} })`;
      });
      const source = `import { reveal } from "@keel/schema"\nimport { hash } from "./hash.ts"\nimport { jobs } from "./jobs.server.ts"\nexport async function pay(ctx, p) {\n${lines.join("\n")}\n}\n`;
      const got = check([JOBS, { path: "modules/orders/pay.server.ts", source }], { types: false })
        .diagnostics.filter((d) => d.code === "E2506")
        .map((d) => d.line);
      const want = calls.flatMap((c, i) => (c.revealed && !c.hashed ? [5 + i] : []));
      expect(got).toEqual(want);
    }),
    { seed: 1337, numRuns: 40 },
  );
});
