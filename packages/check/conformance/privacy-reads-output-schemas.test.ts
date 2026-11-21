// Spec: k.privacy-reads, Conformance "`outputSchemas` lists the `output` of an API entry in `contract(...)` and of a page `loader`'s declaration, inline and through a `const`, and nothing for a `loader` given `decl()`."
// Spec: k.privacy-reads, Readers "`outputSchemas(input)`: the `output` expressions of `input.ast`, each with its position: of every entry of a `contract` call (`@keel/router/contract`), entries read as k.contract Static reading reads them, and of the declaration of every `loader` call (`@keel/router`), an object literal or a `const` of the file bound to one. An `output` given another way is not listed."
// Seed: 1337.
// Not yet built: `test.skip` until `outputSchemas` is exported by `@keel/check`; remove the `.skip` in the build that adds it.
// Assumption: signature `outputSchemas(input)` returns an array; each item is `{ expr, line, col }`, `expr` the `output` expression node
// of `input.ast`, `line` and `col` its 1-based position (as a Finding). The spec says only "each with its position".
// Assumption: a page `loader` is `loader(contract, id, decl, fn)` (k.router); `decl` is the third argument.
import fc from "fast-check";
import { expect, test } from "vitest";
import { reader, run, textOf } from "./privacy-reads-probe.ts";
import { SEED } from "./support.ts";

const PATH = "modules/a/x.ts";

/** `{ text, line }` of each listed output, sorted by line. */
function listed(source: string): { text: string; line: number }[] {
  const outputs = reader("outputSchemas");
  const got = run([{ path: PATH, source }], PATH, (input) => {
    const items: unknown = outputs(input);
    if (!Array.isArray(items)) return [];
    return items.map((i) => ({
      text: textOf(Reflect.get(i, "expr"), input.file.source),
      line: Reflect.get(i, "line"),
    }));
  });
  if (!Array.isArray(got)) return [];
  return got
    .map((g) => ({ text: String(Reflect.get(g, "text")), line: Number(Reflect.get(g, "line")) }))
    .sort((a, b) => a.line - b.line);
}
const HEAD = `import { contract } from "@keel/router/contract"\nimport { loader } from "@keel/router"\nimport { s } from "@keel/schema"\n`;
const name = fc.stringMatching(/^[a-z]{1,8}$/);

test.skip("`outputSchemas` lists the `output` of an API entry in `contract(...)`, inline and through a `const`", () => {
  fc.assert(
    fc.property(name, (n) => {
      const inline = `${HEAD}export const a = contract("a", { "a.${n}": { method: "GET", path: "/${n}", output: s.json() } })\n`;
      expect(listed(inline).map((o) => [o.text, o.line])).toEqual([["s.json()", 4]]);
      const viaConst = `${HEAD}const Out = s.json()\nexport const a = contract("a", { "a.${n}": { method: "GET", path: "/${n}", output: Out } })\n`;
      expect(listed(viaConst).map((o) => [o.text, o.line])).toEqual([["Out", 5]]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test.skip("`outputSchemas` lists every entry of a `contract` call, one `output` each", () => {
  const src = `${HEAD}export const a = contract("a", {\n  "a.one": { method: "GET", path: "/1", output: s.json() },\n  "a.two": { method: "GET", path: "/2", output: s.string() },\n  "a.page": { path: "/p" },\n})\n`;
  expect(listed(src).map((o) => [o.text, o.line])).toEqual([
    ["s.json()", 5],
    ["s.string()", 6],
  ]);
});

test.skip("`outputSchemas` lists the `output` of a page `loader`'s declaration, inline and through a `const`", () => {
  fc.assert(
    fc.property(name, (n) => {
      const inline = `${HEAD}export const l = loader(c, "a.${n}", { output: s.json() }, async () => 1)\n`;
      expect(listed(inline).map((o) => o.text)).toEqual(["s.json()"]);
      const viaConst = `${HEAD}const D = { output: s.json() }\nexport const l = loader(c, "a.${n}", D, async () => 1)\n`;
      expect(listed(viaConst).map((o) => [o.text, o.line])).toEqual([["s.json()", 4]]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test.skip("`outputSchemas` lists nothing for a `loader` given `decl()`", () => {
  const src = `${HEAD}declare function decl(x: unknown): unknown\nexport const l = loader(c, "a.x", decl({ output: s.json() }), async () => 1)\n`;
  expect(listed(src)).toEqual([]);
});

test.skip("`outputSchemas` does not list an `output` given another way: a spread, or a call that is not `contract` or `loader`", () => {
  const src = `${HEAD}const O = { output: s.json() }\nexport const x = { ...O }\nexport const y = foo({ output: s.json() })\nexport const a = contract("a", { "a.z": { method: "GET", path: "/z", ...O } })\n`;
  expect(listed(src)).toEqual([]);
});
