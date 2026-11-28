// Seed 1337
// k.compiler, Rules "E1002 raw HTML (`innerHTML` family, `DOMParser`, `document.write`, `on*` strings, also spread; data in `script`/`style`; rfc:0053, 0058)"
// RFC 0058 / backlog 0154: E1002 resolves names through the rfc:0053 resolver E1601 uses (aliases, destructuring,
// `globalThis`, constant-string keys), and reports `execCommand('insertHTML', ...)`. Each repro in `modules/app/a.ts`
// after `declare const el: HTMLElement`.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";

const e1002 = (body: string) =>
  check([{ path: "modules/app/a.ts", source: `declare const el: HTMLElement\ndeclare const x: string\n${body}\n` }], {
    types: false,
  }).diagnostics.filter((d) => d.code === "E1002");

const REPROS: readonly [string, string][] = [
  ["el['inner'+'HTML']=x", "export const a = () => { el['inner' + 'HTML'] = x }"],
  ["el[`inner${H}`]=x with const H", "const H = 'HTML'\nexport const a = () => { el[`inner${H}`] = x }"],
  ["const d=document; d.write(x)", "const d = document\nexport const a = () => d.write(x)"],
  ["const { write } = document", "const { write } = document\nexport const a = () => write(x)"],
  ["globalThis.Reflect.set(el,'innerHTML',x)", "export const a = () => globalThis.Reflect.set(el, 'innerHTML', x)"],
  ["const R=Reflect; R.set(el,'innerHTML',x)", "const R = Reflect\nexport const a = () => R.set(el, 'innerHTML', x)"],
  ["document.execCommand('insertHTML',false,x)", "export const a = () => document.execCommand('insertHTML', false, x)"],
  ["const P = DOMParser; new P()", "const P = DOMParser\nexport const a = () => new P()"],
  ["window.document.writeln(x)", "export const a = () => window.document.writeln(x)"],
  ["Object.assign with a folded key", "export const a = () => Object.assign(el, { ['outer' + 'HTML']: x })"],
];

for (const [name, body] of REPROS) {
  test(`E1002: ${name} is reported once`, () => {
    expect(e1002(body)).toHaveLength(1);
  });
}

const CLEAN: readonly [string, string][] = [
  ["a local document", "export const a = (document: { write(s: string): void }) => document.write(x)"],
  [
    "a local Reflect",
    "const Reflect = { set: (o: object, k: string, v: string) => [o, k, v] }\nexport const a = () => Reflect.set(el, 'innerHTML', x)",
  ],
  ["execCommand('bold')", "export const a = () => document.execCommand('bold')"],
  ["a folded safe key", "export const a = () => { el['text' + 'Content'] = x }"],
  ["a dynamic key", "export const a = (k: string) => { Reflect.set(el, k, x) }"],
  ["an unused alias", "const d = document\nexport const a = () => d.title"],
];

for (const [name, body] of CLEAN) {
  test(`E1002: ${name} is not reported`, () => {
    expect(e1002(body)).toEqual([]);
  });
}

/** Alias chains to a sink, each link a `const` alias, a parenthesis, or a `globalThis` hop. */
const chain = fc
  .record({
    sink: fc.constantFrom<"write" | "reflect" | "key">("write", "reflect", "key"),
    depth: fc.integer({ min: 1, max: 4 }),
    viaGlobal: fc.boolean(),
    split: fc.integer({ min: 1, max: 8 }),
    template: fc.boolean(),
  })
  .map(({ sink, depth, viaGlobal, split, template }) => {
    const g = viaGlobal ? "globalThis." : "";
    const decls: string[] = [];
    const root = sink === "write" ? `${g}document` : sink === "reflect" ? `${g}Reflect` : "";
    let last = root;
    if (sink !== "key")
      for (let i = 1; i <= depth; i++) {
        decls.push(`const a${i} = ${i % 2 === 0 ? `(${last})` : last}`);
        last = `a${i}`;
      }
    // The key `innerHTML` split into constant parts: `+` of two literals, or a template over a `const`.
    const head = "innerHTML".slice(0, split);
    const tail = "innerHTML".slice(split);
    decls.push(`const k = '${tail}'`);
    const key = template ? `\`${head}\${k}\`` : `'${head}' + k`;
    const use =
      sink === "write" ? `${last}.write(x)` : sink === "reflect" ? `${last}.set(el, ${key}, x)` : `el[${key}] = x`;
    return { decls, use };
  });

test("E1002: an alias chain or constant-string key to a sink is reported exactly once, at the use", () => {
  fc.assert(
    fc.property(chain, ({ decls, use }) => {
      const body = `${decls.join("\n")}\nexport const a = () => {\n  ${use}\n}`;
      const found = e1002(body);
      expect(found, body).toHaveLength(1);
      expect(found[0]?.line, body).toBe(decls.length + 4);
    }),
    // Seed 1337
    { seed: SEED, numRuns: 80 },
  );
});
