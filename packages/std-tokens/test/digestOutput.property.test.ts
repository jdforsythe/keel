// E2203 over generated outputs: `Digested` at any depth of a loader or API `output`, inline or through a schema file,
// is one finding at the `output` line; the same schema without it, or only in a store schema, is none. Seed 1337.
import { check } from "@keel/check";
import "@keel/std-tokens/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const HEAD = `import { contract } from "@keel/router/contract"\nimport { loader } from "@keel/router"\nimport { s } from "@keel/schema"\nimport { Digested } from "@keel/std-tokens"\nimport { Row } from "./row.schema.ts"\n`;
const key = fc.stringMatching(/^[a-z]{1,6}$/);

test("E2203 is one finding per output holding Digested, at the output line", () => {
  fc.assert(
    fc.property(
      fc.array(key, { minLength: 0, maxLength: 4 }),
      fc.boolean(),
      fc.boolean(),
      fc.constantFrom("inline", "file", "none"),
      (keys, api, optional, where) => {
        const leaf = where === "inline" ? "Digested" : where === "file" ? "Row" : "s.string()";
        const schema = keys.reduceRight<string>(
          (x, k) => `s.object({ ${k}: ${x} })`,
          optional ? `${leaf}.optional()` : leaf,
        );
        const decl = api
          ? `export const a = contract("a", { "a.get": { method: "GET", path: "/g", output: ${schema} } })\n`
          : `export const l = loader(c, "a.page", { output: ${schema} }, async () => null)\n`;
        const files = [
          {
            path: "modules/a/row.schema.ts",
            source: `import { s } from "@keel/schema"\nimport { Digested } from "@keel/std-tokens"\nexport const Row = s.object({ digest: Digested })\n`,
          },
          { path: "modules/a/a.server.ts", source: `${HEAD}${decl}` },
        ];
        const got = check(files, { types: false })
          .diagnostics.filter((d) => d.code === "E2203")
          .map((d) => `${d.path}:${d.line}`);
        expect(got).toEqual(where === "none" ? [] : ["modules/a/a.server.ts:6"]);
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
});
