// Spec: k.privacy-reads, Conformance "`carriesReveal` is true for `reveal(p.k)`, `{ a: reveal(p.k) }` and a `const` bound to `` `${reveal(p.k)}` ``, and false for `hash(reveal(p.k))`, `reveal(p.k).length`, `reveal(p.k) === h` and a parameter."
// Spec: k.privacy-reads, Readers "`carriesReveal(node, input): boolean`: whether the expression `node` of `input.ast` carries a value `reveal` returns, by k.reveal Flow, a local's value read where `node` stands. What ends a value there ends it here: any other call, a parameter, an import."
// Seed: 1337.
// Not yet built: `test.skip` until `carriesReveal` is exported by `@keel/check`; remove the `.skip` in the build that adds it.
// Assumption: signature `carriesReveal(node, input): boolean`, `node` a node of `input.ast`; see privacy-reads-probe.ts for how a test reaches both.
import fc from "fast-check";
import { expect, test } from "vitest";
import { reader, run } from "./privacy-reads-probe.ts";
import { SEED } from "./support.ts";

const PATH = "modules/a/x.ts";
const key = fc.stringMatching(/^[a-z]{1,8}$/);

function answers(body: string[]): unknown {
  const source = [
    `import { reveal } from "@keel/schema"`,
    `import { hash } from "./hash.ts"`,
    `export function f(p, h, param) {`,
    ...body.map((l) => `  ${l}`),
    `}`,
    ``,
  ].join("\n");
  const carries = reader("carriesReveal");
  return run([{ path: PATH, source }], PATH, (input, nodes) => nodes.map((n) => carries(n, input)));
}

test.skip("`carriesReveal` is true for `reveal(p.k)`, `{ a: reveal(p.k) }` and a `const` bound to `` `${reveal(p.k)}` ``", () => {
  fc.assert(
    fc.property(key, (k) => {
      const got = answers([
        `probe(reveal(p.${k}))`,
        `probe({ a: reveal(p.${k}) })`,
        "const c = `${reveal(p." + k + ")}`",
        `probe(c)`,
      ]);
      expect(got).toEqual([true, true, true]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test.skip("`carriesReveal` is false for `hash(reveal(p.k))`, `reveal(p.k).length`, `reveal(p.k) === h` and a parameter", () => {
  fc.assert(
    fc.property(key, (k) => {
      const got = answers([
        `probe(hash(reveal(p.${k})))`,
        `probe(reveal(p.${k}).length)`,
        `probe(reveal(p.${k}) === h)`,
        `probe(param)`,
      ]);
      expect(got).toEqual([false, false, false, false]);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test.skip("`carriesReveal` reads a local's value where `node` stands: a later hash assignment ends it, an import ends it", () => {
  const got = answers([`let a = reveal(p.k)`, `probe(a)`, `a = hash(a)`, `probe(a)`, `probe(hash)`]);
  expect(got).toEqual([true, false, false]);
});
