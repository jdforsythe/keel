// Spec: std.tokens, API "The token leaves once, as `reveal(token)` in the `*.server.ts` file that sends it (in `tx`, storage, a log or a throw: E1112)."
// Spec: std.tokens, Conformance "In a `*.server.ts` file, with `m` a `mint` result, `tx(t, { token: reveal(m.value.token) })` and `console.log(reveal(m.value.token))` are each one E1112; `tx(t, { id: m.value.id, digest: m.value.digest })`, `reveal(m.value.token)` in a `service` call's `body`, and `check(input.token, find)` are none."
// Seed: 1337.
// Assumption: as in privacy-e1112.test.ts, a finding is asserted by code, path and the line of its statement; the spec gives no column.
// Assumption: a `service` call is a method of `service({ contract })`, `mail.send({ body })`; E1112 has no `service` sink, so its shape does not matter to the rule.
// Assumption: E1105 does not fire in a `*.server.ts` file, and the fixtures hold no other file.
import { check } from "@keel/check";
import "@keel/std-tokens/server";
import "@keel/std-tokens/tools";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

type Files = Parameters<typeof check>[0];
const PATH = "modules/app/x.server.ts";
const MANIFEST = {
  path: "modules/app/module.ts",
  source: `import { module } from "@keel/compiler"\nexport default module({ id: "app", deps: ["@keel/std-tokens"], capabilities: ["clock", "random"], public: { exports: [] } })\n`,
};
const HEAD = [
  `import { reveal } from "@keel/schema"`,
  `import { tx } from "@keel/store"`,
  `import { service } from "@keel/services"`,
  `import { tokens } from "@keel/std-tokens/server"`,
].join("\n");

/** The fixture with `body` lines inside an action, and the 1-based line of body line `i`. */
function fixture(body: string[]): { files: Files; line: (i: number) => number } {
  const lines = [
    HEAD,
    "export async function act(ctx, t, input, find) {",
    "  const m = tokens(ctx).mint({ ttl: 3600000 })",
  ];
  const first = lines.join("\n").split("\n").length + 1;
  const source = `${[...lines, ...body.map((l) => `  ${l}`), "}"].join("\n")}\n`;
  return { files: [MANIFEST, { path: PATH, source }], line: (i) => first + i };
}
const diag = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);

test("`tx(t, { token: reveal(m.value.token) })` and `console.log(reveal(m.value.token))` are each one E1112.", () => {
  const cases = ["tx(t, { token: reveal(m.value.token) })", "console.log(reveal(m.value.token))"];
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3 }), fc.constantFrom(...cases), (pad, stmt) => {
      const body = [...Array.from({ length: pad }, () => "const unused = 1"), stmt];
      const f = fixture(body);
      const ds = diag(f.files, "E1112");
      expect(ds).toHaveLength(1);
      expect(ds[0]?.path).toBe(PATH);
      expect(ds[0]?.line).toBe(f.line(pad));
      expect(ds[0]?.fix).toBeUndefined();
      expect(diag(f.files, "E1105")).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("`tx(t, { id: m.value.id, digest: m.value.digest })`, `reveal(m.value.token)` in a `service` call's `body`, and `check(input.token, find)` are none.", () => {
  const clean = [
    "tx(t, { id: m.value.id, digest: m.value.digest })",
    `await mail.send({ body: { token: reveal(m.value.token) } })`,
    "const found = tokens(ctx).check(input.token, find)",
  ];
  for (const stmt of clean) {
    const f = fixture([stmt]);
    expect(diag(f.files, "E1112"), stmt).toHaveLength(0);
    expect(diag(f.files, "E1105"), stmt).toHaveLength(0);
  }
  const all = fixture(clean);
  expect(diag(all.files, "E1112")).toHaveLength(0);
  expect(diag(all.files, "E1105")).toHaveLength(0);
});

test("The token leaves once: the `*.server.ts` file that sends it calls `reveal(token)`; that value in `tx`, storage, a log or a throw is E1112.", () => {
  const sinks = [
    "ctx.storage.set('k', reveal(m.value.token))",
    "throw new Error('bad ' + reveal(m.value.token))",
    "const t2 = reveal(m.value.token); tx(t, { v: t2 })",
  ];
  for (const stmt of sinks) {
    const f = fixture([stmt]);
    expect(diag(f.files, "E1112"), stmt).toHaveLength(1);
    expect(diag(f.files, "E1105"), stmt).toHaveLength(0);
  }
});
