// Seed 1337. The rules beyond their conformance fixtures: aliases, re-exports, counts and where a finding points.
import { check } from "@keel/check";
import "@keel/std-postgres/tools";
import fc from "fast-check";
import { expect, test } from "vitest";
import { callsIn } from "../src/tools/internal/callsIn.ts";

const SEED = 1337;
type Files = Parameters<typeof check>[0];
const found = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);
const module = {
  path: "modules/kitchen/module.ts",
  source: `import { module } from "@keel/compiler"\nexport default module({ id: "kitchen", deps: ["@keel/std-postgres"] })\n`,
};
const at = (path: string, source: string): Files => [module, { path, source }];

test("E2451 fires on a re-export of the server entry outside a *.server.ts file", () => {
  expect(
    found(at("modules/kitchen/db.ts", `export { database } from "@keel/std-postgres/server"\n`), "E2451").length,
  ).toBe(1);
  expect(
    found(at("modules/kitchen/db.ts", `export type { Database } from "@keel/std-postgres/server"\n`), "E2451").length,
  ).toBe(0);
});

test("E2458 follows an aliased import and ignores another package's database", () => {
  const aliased = `import { database as db } from "@keel/std-postgres/server"\nexport const k = db("db", { migrations: {} })\n`;
  expect(found(at("modules/kitchen/kDb.server.ts", aliased), "E2458").length).toBe(1);
  const other = `import { database } from "elsewhere"\nexport const k = database("db", { migrations: {} })\n`;
  expect(found(at("modules/kitchen/kDb.server.ts", other), "E2458").length).toBe(0);
});

test("W2456 counts every occurrence, in sql and fragment templates, and nothing in other templates", () => {
  const src = `import { fragment, sql } from "@keel/std-postgres"
import { s } from "@keel/schema"
export const f = fragment\`select now(), random()\`
export const q = sql(s.object({}))\`select \${f}, NOW( ) where x < clock_timestamp()\`
export const t = String.raw\`now()\`
`;
  expect(found(at("modules/kitchen/q.server.ts", src), "W2456").length).toBe(4);
});

test("callsIn finds each call at its offset and no look-alike", () => {
  fc.assert(
    fc.property(
      fc.array(fc.constantFrom("now()", "current_timestamp", "random()", "gen_random_uuid()", "know()", "x", " "), {
        maxLength: 8,
      }),
      fc.nat({ max: 100 }),
      (parts, base) => {
        const text = parts.join(" ");
        const want: number[] = [];
        let off = 0;
        for (const p of parts) {
          if (p !== "know()" && p !== "x" && p !== " ") want.push(base + off);
          off += p.length + 1;
        }
        expect(callsIn(text, base)).toEqual(want);
      },
    ),
    { seed: SEED, numRuns: 200 },
  );
});
