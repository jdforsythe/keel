// Seed 1337
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import "../src/index.ts";
import { pascalCase } from "../src/internal/pascalCase.ts";

const SEED = 1337;
/** The E2101 findings of `source`; a rule that throws would show as E1756, which is never expected. */
const e2101 = (source: string) => {
  const all = check([{ path: "a.ts", source }], { types: false }).diagnostics;
  expect(all.filter((d) => d.code === "E1756")).toEqual([]);
  return all.filter((d) => d.code === "E2101");
};
const flagged = (source: string) => e2101(source).length;
const lines = (source: string) => e2101(source).map((d) => d.line);

test("a brand of more than 24 characters is shown cut to 21 characters and an ellipsis, in the finding and in its suggestion", () => {
  const brand = "a_very_long_brand_name_xyz_more";
  const d = e2101(`s.id('${brand}')`);
  expect(d.map((x) => x.message)).toEqual([
    "id brand 'a_very_long_brand_nam...' is not PascalCase; use 'AVeryLongBrandNameXyz...'",
  ]);
});

test("a brand of exactly 24 characters is shown whole and one of 25 is cut", () => {
  const b24 = "abcdefghijklmnopqrstuvwx";
  expect(b24.length).toBe(24);
  expect(e2101(`s.id('${b24}')`).map((x) => x.message)).toEqual([
    `id brand '${b24}' is not PascalCase; use 'Abcdefghijklmnopqrstuvwx'`,
  ]);
  const b25 = `${b24}y`;
  expect(e2101(`s.id('${b25}')`).map((x) => x.message)).toEqual([
    `id brand 'abcdefghijklmnopqrstu...' is not PascalCase; use 'Abcdefghijklmnopqrstu...'`,
  ]);
});

test("a brand with no PascalCase form is reported without a suggestion and without a fix", () => {
  const d = e2101("s.id('_-_')");
  expect(d.map((x) => x.message)).toEqual(["id brand '_-_' is not PascalCase"]);
  expect(d[0]?.fix).toBeUndefined();
});

test("the fix rewrites exactly the literal, keeping the quote and the code around it", () => {
  for (const q of ["'", '"', "`"]) {
    const d = e2101(`const x = 1\nconst y = s.id(${q}order_line${q}) // keep\n`);
    expect(d[0]?.fix).toContain(`-const y = s.id(${q}order_line${q}) // keep`);
    expect(d[0]?.fix).toContain(`+const y = s.id(${q}OrderLine${q}) // keep`);
  }
});

test("a fix is offered for each of several brands in a file and each finding sits on its own line", () => {
  const source =
    "const a = s.id('first_one')\nconst b = ctx.random.id('second-one')\nconst c = s.id('ThirdOne')\nconst d = s.id('fourth')\n";
  const d = e2101(source);
  expect(d.map((x) => x.line)).toEqual([1, 2, 4]);
  expect(d.every((x) => typeof x.fix === "string")).toBe(true);
});

test("only the first argument of s.id and <expr>.random.id is a brand", () => {
  expect(flagged("s.id('Order', 'bad_second')")).toBe(0);
  expect(flagged("s.id('bad_one', 'Second')")).toBe(1);
  expect(flagged("s.id()")).toBe(0);
  expect(flagged("s.id(...names)")).toBe(0);
  expect(flagged("s.id(...['bad_one'])")).toBe(0);
});

test("a template literal brand is flagged only when it has no substitutions", () => {
  expect(flagged("s.id(`bad_one`)")).toBe(1);
  expect(flagged("s.id(`bad_${x}`)")).toBe(0);
  expect(flagged("s.id(`Good`)")).toBe(0);
  expect(flagged("ctx.random.id(`bad_one`)")).toBe(1);
  expect(flagged("ctx.random.id(`${x}`)")).toBe(0);
});

test("a non-string literal argument is not a brand", () => {
  expect(flagged("s.id(42)")).toBe(0);
  expect(flagged("s.id(null)")).toBe(0);
  expect(flagged("s.id(true)")).toBe(0);
  expect(flagged("s.id(/bad_one/)")).toBe(0);
});

test("only s.id and <expr>.random.id calls are brands", () => {
  const bad = "'bad_one'";
  expect(flagged(`id(${bad})`)).toBe(0);
  expect(flagged(`t.id(${bad})`)).toBe(0);
  expect(flagged(`s.name(${bad})`)).toBe(0);
  expect(flagged(`s[id](${bad})`)).toBe(0);
  expect(flagged(`s['id'](${bad})`)).toBe(0);
  expect(flagged(`ctx.random[id](${bad})`)).toBe(0);
  expect(flagged(`ctx.random['id'](${bad})`)).toBe(0);
  expect(flagged(`ctx[random].id(${bad})`)).toBe(0);
  expect(flagged(`ctx['random'].id(${bad})`)).toBe(0);
  expect(flagged(`ctx.rand.id(${bad})`)).toBe(0);
  expect(flagged(`random.id(${bad})`)).toBe(0);
  expect(flagged(`ctx.random.name(${bad})`)).toBe(0);
  expect(flagged(`ctx.random.id.call(${bad})`)).toBe(0);
  expect(flagged(`(0, s.id)(${bad})`)).toBe(0);
  expect(flagged(`s.id?.(${bad})`)).toBe(1);
  expect(flagged(`a.b.random.id(${bad})`)).toBe(1);
  expect(flagged(`this.random.id(${bad})`)).toBe(1);
  expect(flagged(`f().random.id(${bad})`)).toBe(1);
  expect(flagged(`f().id(${bad})`)).toBe(0);
  expect(flagged(`this.id(${bad})`)).toBe(0);
  expect(flagged(`new Thing().id(${bad})`)).toBe(0);
  expect(flagged(`new Thing(${bad})`)).toBe(0);
  expect(flagged(`foo(${bad})`)).toBe(0);
});

test("a brand inside a call, an argument or a function is found wherever it sits", () => {
  const source = "export const x = wrap(\n  s.id('a_b'),\n  list(() => ctx.random.id('c_d')),\n)\n";
  expect(lines(source)).toEqual([2, 3]);
});

test("every brand of a generated file is reported once, in source order", () => {
  fc.assert(
    fc.property(
      fc.array(fc.stringMatching(/^[a-z]{2,5}_[a-z]{2,5}$/), { minLength: 1, maxLength: 6 }),
      fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
      (brands, viaCtx) => {
        const source = brands.map((b, i) => (viaCtx[i] === true ? `ctx.random.id('${b}')` : `s.id('${b}')`)).join("\n");
        const found = e2101(source);
        expect(found.map((d) => d.line)).toEqual(brands.map((_, i) => i + 1));
        expect(found.map((d) => d.message.split("'")[1])).toEqual(brands);
      },
    ),
    { seed: SEED, numRuns: 60 },
  );
});

test("pascalCase splits at separators and at a lowercase or digit followed by an uppercase letter", () => {
  expect(pascalCase("userId")).toBe("UserId");
  expect(pascalCase("user_id")).toBe("UserId");
  expect(pascalCase("a1B")).toBe("A1B");
  expect(pascalCase("a1b")).toBe("A1b");
  expect(pascalCase("XMLHttp")).toBe("XMLHttp");
  expect(pascalCase("order line.item")).toBe("OrderLineItem");
  expect(pascalCase("__a--b__")).toBe("AB");
  expect(pascalCase("a___b")).toBe("AB");
  expect(pascalCase("")).toBe("");
  expect(pascalCase("_")).toBe("");
  expect(pascalCase("1st")).toBe("1st");
});

test("pascalCase output has only letters and digits and is stable when applied again", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 20 }), (b) => {
      const p = pascalCase(b);
      expect(p).toMatch(/^[A-Za-z0-9]*$/);
      expect(pascalCase(p)).toBe(p);
    }),
    { seed: SEED, numRuns: 200 },
  );
});
