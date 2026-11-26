// Spec: k.values, clause "`TokenSchema` refuses with rule `format` at that path each of `font: { a: '\"Inter var, sans-serif' }`, `color: { a: '\"oops' }`, `color: { a: 'rgb(1,2,3' }`, `color: { a: 'red\\' }`, `color: { a: 'red' }`, `color: { a: '#12345' }`, `space: { a: '1px !important' }`, `size: { a: 'url(x.png)' }`, `border: { a: '1px solid var(--x)' }` and `motion: { a: '120' }`."
// Spec: k.values, clause "`TokenSchema` accepts `brandTokens`, `space: { a: '-2rem' }`, `size: { a: 'fit-content' }`, `font: { a: \"'Inter var', sans-serif\" }`, `weight: { a: '650' }`, `shadow: { a: 'inset 0 1px 2px #000000' }`, `breakpoint: { a: '48em' }` and `motion: { a: '0.2s' }`."
// Spec: k.values, clause "`border: { a: '1px solid var(--k-color-text)' }` is accepted with a color token `text` and refused with rule `format` at `border.a` without one."
// Spec: k.values, clause "In Chromium, the CSS file compiled from `brandTokens` and from tokens holding one value of each form in the table, every group used by a style prop, parses as a `CSSStyleSheet` (`replaceSync`) with `cssRules.length` equal to the number of rules the compiler emitted, and each rule holds every declaration it was emitted with."
// Spec: k.values, clause "A refused value fails `TokenSchema` with rule `format` at `<group>.<name>` (with `light` or `dark` after it for a pair): `tokens.ts` is E1807 and a library's shipped object is E1812 `<id>Tokens fails TokenSchema at <path>` (k.looks)."
// Spec: k.values, clause "**Stylesheet.** Every value a form admits makes a declaration the browser keeps, so the compiled CSS file loses no rule to a token."
// Seed: 1337 (fc.assert below). The shipped-object half (k.values #4, E1812) is packages/check/conformance/token-values-e1812.test.ts.
// The Chromium clause: this repo's conformance harness has no real CSS parser (no case imports Chromium, Playwright or a parser library; the smokes under tooling/smoke run Chromium). The cases here are the strictest check the harness holds:
// a CSS tokenizer written below reads what `compileStyles` emits as a browser's tokenizer does (strings end before a newline, a bracket closes, a block closes, a declaration is `name:value`), and asserts every token value is kept
// whole in a declaration of a well-formed rule. The real `CSSStyleSheet.replaceSync` assertion (`cssRules.length` equal to the rules emitted, each declaration kept) is owed to RFC 0244's runner (docs/rfc/0243-library-looks.md, Conformance diff).
// The "rule" a refusal reports is `format` at the path `[group, name]` (`[group, name, "light" | "dark"]` for a pair), read from `error.data.issues` as k.schema gives it.
import { TokenSchema, defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import { compileStyles } from "@keel/ui/css";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { codeOf, compileWith } from "./base-support.ts";

const SEED = 1337;

const issuesOf = (tokens: unknown): { path: (string | number)[]; rule: string }[] | null => {
  const r = TokenSchema.parse(tokens);
  return r.ok ? null : r.error.data.issues;
};
const refusedAt = (tokens: unknown, path: (string | number)[]): boolean =>
  (issuesOf(tokens) ?? []).some((i) => i.rule === "format" && i.path.join(".") === path.join("."));

// ---- a strict reading of the emitted CSS
interface Block {
  prelude: string;
  decls: string[];
  children: Block[];
}
interface Scan {
  rules: Block[];
  errors: string[];
}
function scanCss(css: string): Scan {
  const errors: string[] = [];
  let i = 0;
  /** Reads up to a `{`, `;` or `}` at bracket depth 0 outside strings and comments; returns the text and the stop (`""` at the end). */
  const chunk = (): { text: string; stop: string } => {
    let text = "";
    let depth = 0;
    while (i < css.length) {
      const c = css.charAt(i);
      if (c === "/" && css.charAt(i + 1) === "*") {
        const end = css.indexOf("*/", i + 2);
        if (end < 0) {
          errors.push("unclosed comment");
          i = css.length;
          break;
        }
        i = end + 2;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        for (;;) {
          const d = css.charAt(j);
          if (j >= css.length || d === "\n") {
            errors.push(`unclosed string ${css.slice(i, i + 12)}`);
            break;
          }
          if (d === "\\") {
            j += 2;
            continue;
          }
          if (d === c) break;
          j += 1;
        }
        text += css.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      if (c === "\\") {
        text += css.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === "(" || c === "[") depth += 1;
      if (c === ")" || c === "]") {
        depth -= 1;
        if (depth < 0) errors.push(`stray ${c}`);
      }
      if (depth <= 0 && (c === "{" || c === ";" || c === "}")) {
        i += 1;
        return { text, stop: c };
      }
      text += c;
      i += 1;
    }
    if (depth > 0) errors.push("unclosed bracket");
    return { text, stop: "" };
  };
  const body = (inBlock: boolean): { decls: string[]; children: Block[] } => {
    const decls: string[] = [];
    const children: Block[] = [];
    for (;;) {
      const { text, stop } = chunk();
      const t = text.trim();
      if (stop === "{") {
        const inner = body(true);
        children.push({ prelude: t, decls: inner.decls, children: inner.children });
        if (t === "") errors.push("a block with no prelude");
      } else {
        if (t !== "") decls.push(t);
        if (stop === "}") {
          if (!inBlock) errors.push("stray }");
          return { decls, children };
        }
        if (stop === "") {
          if (inBlock) errors.push("unclosed block");
          return { decls, children };
        }
      }
    }
  };
  const top = body(false);
  // A top-level statement (`@import x;`) is a rule of the sheet as a block is.
  const statements = top.decls.map((d): Block => ({ prelude: d, decls: [], children: [] }));
  return { rules: [...top.children, ...statements], errors };
}
const allBlocks = (b: Block[]): Block[] => b.flatMap((x) => [x, ...allBlocks(x.children)]);
const DECL = /^(--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z0-9-]*):\s*\S[\s\S]*$/;
const strip = (s: string): string => s.replace(/\s+/g, "");

/** Every rule is well formed, every declaration is `name:value`, and each custom property written from a token holds none of `url(`, `!`, a backslash or a quote beyond a font's. */
function wellFormed(css: string): Scan {
  const s = scanCss(css);
  expect(s.errors).toEqual([]);
  for (const b of allBlocks(s.rules)) {
    for (const d of b.decls) {
      expect(d, `declaration in ${b.prelude}`).toMatch(DECL);
      if (d.startsWith("--k-")) {
        expect(d).not.toMatch(/url\(|!|\\|;/);
      }
    }
  }
  return s;
}

// ---- value generators, one per group, from the form table
const int = (min: number, max: number) => fc.integer({ min, max });
const num = fc.oneof(
  int(-50, 50).map(String),
  fc.tuple(int(0, 20), int(0, 99)).map(([a, b]) => `${a}.${b}`),
);
const LENGTH_UNITS = ["px", "rem", "em", "%", "vw", "vh", "ch"] as const;
const length = fc.oneof(
  fc.constant("0"),
  fc.tuple(num, fc.constantFrom(...LENGTH_UNITS)).map(([n, u]) => `${n}${u}`),
);
const hex = (n: number) =>
  fc.array(fc.constantFrom(..."0123456789abcdefABCDEF"), { minLength: n, maxLength: n }).map((a) => a.join(""));
const colorValue = fc.oneof(hex(3), hex(6)).map((h) => `#${h}`);
const family = fc.oneof(
  fc.stringMatching(/^[A-Za-z][A-Za-z0-9-]{0,6}( [A-Za-z0-9-]{1,5}){0,2}$/),
  fc.stringMatching(/^[A-Za-z0-9 -]{1,8}$/).map((s) => `"${s}"`),
  fc.stringMatching(/^[A-Za-z0-9 -]{1,8}$/).map((s) => `'${s}'`),
);
const font = fc.array(family, { minLength: 1, maxLength: 3 }).map((a) => a.join(", "));
const oneShadow = fc
  .tuple(fc.boolean(), fc.array(length, { minLength: 2, maxLength: 4 }), fc.option(colorValue, { nil: undefined }))
  .map(([inset, ls, c]) => [...(inset ? ["inset"] : []), ...ls, ...(c === undefined ? [] : [c])].join(" "));
const shadow = fc.oneof(
  fc.constant("none"),
  fc.array(oneShadow, { minLength: 1, maxLength: 4 }).map((a) => a.join(", ")),
);
const border = fc.oneof(
  fc.constant("0"),
  fc.constant("none"),
  fc.tuple(length, fc.constantFrom("solid", "dashed", "dotted", "double"), colorValue).map((p) => p.join(" ")),
);
const GEN: Record<string, fc.Arbitrary<string>> = {
  space: fc.oneof(length, fc.constant("auto")),
  size: fc.oneof(length, fc.constantFrom("auto", "min-content", "max-content", "fit-content")),
  radius: length,
  font,
  fontSize: length,
  weight: fc.oneof(int(1, 1000).map(String), fc.constantFrom("normal", "bold")),
  shadow,
  border,
  breakpoint: fc.tuple(num, fc.constantFrom("px", "em", "rem")).map(([n, u]) => `${n}${u}`),
  motion: fc.tuple(num, fc.constantFrom("ms", "s")).map(([n, u]) => `${n}${u}`),
};
const GROUPS = Object.keys(GEN);
/** The style prop that reads each group. */
const PROP: Record<string, string> = {
  color: "bg",
  space: "p",
  size: "w",
  radius: "radius",
  font: "font",
  fontSize: "fontSize",
  weight: "weight",
  shadow: "shadow",
  border: "border",
};
const HAZARDS = [
  "url(x.png)",
  " !important",
  "\\",
  '"',
  "'",
  "(",
  ")",
  "[",
  ";",
  "}",
  "{",
  "\n",
  "/*",
  "var(--x)",
  "<",
  "@",
] as const;

describe("k.values: forms refuse what they do not produce", () => {
  const REFUSED: { label: string; group: string; value: string }[] = [
    { label: "font: unclosed double quote", group: "font", value: '"Inter var, sans-serif' },
    { label: "color: leading quote", group: "color", value: '"oops' },
    { label: "color: unclosed rgb(", group: "color", value: "rgb(1,2,3" },
    { label: "color: trailing backslash", group: "color", value: "red\\" },
    { label: "color: a name", group: "color", value: "red" },
    { label: "color: five hex digits", group: "color", value: "#12345" },
    { label: "space: !important", group: "space", value: "1px !important" },
    { label: "size: url()", group: "size", value: "url(x.png)" },
    { label: "border: a var of a foreign property", group: "border", value: "1px solid var(--x)" },
    { label: "motion: no unit", group: "motion", value: "120" },
  ];
  for (const c of REFUSED) {
    test(`\`TokenSchema\` refuses with rule \`format\` at that path ${c.label} (\`${c.group}: { a: ${JSON.stringify(c.value)} }\`)`, () => {
      expect(refusedAt({ [c.group]: { a: c.value } }, [c.group, "a"])).toBe(true);
    });
  }

  test("a color pair with one refused value is refused at `color.a.light` or `color.a.dark`, the one that is wrong", () => {
    for (const bad of ['"oops', "rgb(1,2,3", "red\\", "red", "#12345"]) {
      expect(refusedAt({ color: { a: { light: bad, dark: "#111111" } } }, ["color", "a", "light"])).toBe(true);
      expect(refusedAt({ color: { a: { light: "#111111", dark: bad } } }, ["color", "a", "dark"])).toBe(true);
      expect(issuesOf({ color: { a: { light: "#111111", dark: "#eeeeee" } } })).toBeNull();
    }
  });

  test("any value of a group's form followed by a hazard (`url(`, `!important`, a backslash, a quote, an open bracket, `;`, a brace, a newline, a comment opener, a foreign `var(`) is refused at that path, whatever the group", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GROUPS, "color"),
        fc.nat(),
        fc.constantFrom(...HAZARDS),
        fc.boolean(),
        (group, pick, hazard, atFront) => {
          const gen = group === "color" ? colorValue : (GEN[group] ?? colorValue);
          const [valid = ""] = fc.sample(gen, { seed: SEED + pick, numRuns: 1 });
          const bad = atFront ? `${hazard}${valid}` : `${valid}${hazard}`;
          expect(refusedAt({ [group]: { a: bad } }, [group, "a"]), `${group}: ${JSON.stringify(bad)}`).toBe(true);
        },
      ),
      { seed: SEED, numRuns: 400 },
    );
  });

  test("a `var(...)` of any property but a held color token's custom property is refused in every group that takes a `<ref>`, and one of a held color token is accepted", () => {
    for (const bad of [
      "var(--x)",
      "var(--k-color-text, red)",
      "var(--k-space-1)",
      "var(--k-color-missing)",
      "var(--k-color-text)x",
    ]) {
      expect(refusedAt({ color: { text: "#111111" }, border: { a: `1px solid ${bad}` } }, ["border", "a"]), bad).toBe(
        true,
      );
      expect(refusedAt({ color: { text: "#111111" }, shadow: { a: `0 1px 2px ${bad}` } }, ["shadow", "a"]), bad).toBe(
        true,
      );
    }
    expect(issuesOf({ color: { text: "#111111" }, shadow: { a: "0 1px 2px var(--k-color-text)" } })).toBeNull();
  });
});

describe("k.values: forms accept what they produce", () => {
  test("`TokenSchema` accepts `brandTokens`, `space: { a: '-2rem' }`, `size: { a: 'fit-content' }`, `font: { a: \"'Inter var', sans-serif\" }`, `weight: { a: '650' }`, `shadow: { a: 'inset 0 1px 2px #000000' }`, `breakpoint: { a: '48em' }` and `motion: { a: '0.2s' }`", () => {
    expect(TokenSchema.parse(brandTokens).ok).toBe(true);
    for (const t of [
      { space: { a: "-2rem" } },
      { size: { a: "fit-content" } },
      { font: { a: "'Inter var', sans-serif" } },
      { weight: { a: "650" } },
      { shadow: { a: "inset 0 1px 2px #000000" } },
      { breakpoint: { a: "48em" } },
      { motion: { a: "0.2s" } },
    ]) {
      expect(issuesOf(t), JSON.stringify(t)).toBeNull();
    }
  });

  test("a value generated from its group's form is accepted, in every group", () => {
    for (const group of GROUPS) {
      fc.assert(
        fc.property(GEN[group] ?? colorValue, (v) => {
          expect(issuesOf({ [group]: { a: v } }), `${group}: ${v}`).toBeNull();
        }),
        { seed: SEED, numRuns: 60 },
      );
    }
    fc.assert(
      fc.property(colorValue, colorValue, (a, b) => {
        expect(issuesOf({ color: { a, b: { light: a, dark: b } } })).toBeNull();
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("`border: { a: '1px solid var(--k-color-text)' }` is accepted with a color token `text` and refused with rule `format` at `border.a` without one", () => {
    const border = { a: "1px solid var(--k-color-text)" };
    expect(issuesOf({ color: { text: "#111111" }, border })).toBeNull();
    expect(issuesOf({ color: { text: { light: "#111111", dark: "#eeeeee" } }, border })).toBeNull();
    expect(refusedAt({ border }, ["border", "a"])).toBe(true);
    expect(refusedAt({ color: { other: "#111111" }, border }, ["border", "a"])).toBe(true);
  });
});

describe("k.values: a refused value in `tokens.ts` is E1807", () => {
  const ATTACKS: { label: string; tokens: Record<string, unknown> }[] = [
    { label: "a font value with an unclosed quote", tokens: { font: { a: '"Inter var, sans-serif' } } },
    { label: 'a color `"oops`', tokens: { color: { a: '"oops' } } },
    { label: "a color `rgb(1,2,3`", tokens: { color: { a: "rgb(1,2,3" } } },
    { label: "a color with a trailing backslash", tokens: { color: { a: "red\\" } } },
    {
      label: "a pair whose dark value breaks out of the declaration",
      tokens: { color: { a: { light: "#111", dark: "#eee;}" } } },
    },
    { label: "a url() size", tokens: { size: { a: "url(x.png)" } } },
    { label: "an !important space", tokens: { space: { a: "1px !important" } } },
  ];
  for (const a of ATTACKS) {
    test(`${a.label} makes \`defineTokens\` and \`compileStyles\` throw E1807, and no stylesheet is written`, () => {
      const loose = JSON.parse(JSON.stringify(a.tokens));
      expect(codeOf(() => defineTokens(loose))).toBe("E1807");
      expect(codeOf(() => compileStyles({ tokens: loose, usages: [] }))).toBe("E1807");
    });
  }

  test("a token set `TokenSchema` accepts is one `defineTokens` accepts, and one it refuses is E1807, whatever the group and the mutation", () => {
    fc.assert(
      fc.property(fc.constantFrom(...GROUPS), fc.nat(), fc.constantFrom(...HAZARDS), (group, pick, hazard) => {
        const [valid = ""] = fc.sample(GEN[group] ?? colorValue, { seed: SEED + pick, numRuns: 1 });
        const at = pick % (valid.length + 1);
        const value = `${valid.slice(0, at)}${hazard}${valid.slice(at)}`;
        const tokens = JSON.parse(JSON.stringify({ [group]: { a: value } }));
        const ok = TokenSchema.parse(tokens).ok;
        expect(codeOf(() => defineTokens(tokens))).toBe(ok ? null : "E1807");
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
});

describe("k.values: Stylesheet, the compiled CSS keeps every rule", () => {
  test("the CSS compiled from `brandTokens` is well formed, each rule a balanced block of `name:value` declarations (a browser's parser keeps it whole)", () => {
    const { css } = compileStyles({ tokens: brandTokens, usages: [] });
    const s = wellFormed(css);
    expect(s.rules.length).toBeGreaterThan(0);
  });

  const colorOf = { text: "#111111", a: "#0B5CAD" };
  test("the CSS compiled from tokens holding one value of each form, every group used by a style prop, is well formed and holds each value whole in a declaration", () => {
    const values: Record<string, string> = {
      space: "-2rem",
      size: "fit-content",
      radius: "0.5rem",
      font: "'Inter var', \"Helvetica Neue\", sans-serif",
      fontSize: "1.5rem",
      weight: "650",
      shadow: "inset 0 1px 2px #000000, 0 2px 4px 1px var(--k-color-text)",
      border: "1px solid var(--k-color-text)",
    };
    const extra: Record<string, unknown> = {
      color: { ...colorOf, bg: { light: "#ffffff", dark: "#111111" } },
      breakpoint: { bp: "48em" },
      motion: { slow: "0.2s" },
    };
    for (const [g, v] of Object.entries(values)) extra[g] = { a: v };
    const usages = [
      { props: { bg: "a" } },
      ...Object.keys(values).map((g) => ({ props: { [PROP[g] ?? "p"]: "a" } })),
      { props: { p: "a" }, breakpoint: "bp" },
    ];
    const out = compileWith(extra, usages);
    wellFormed(out.css);
    const flat = strip(out.css);
    for (const v of Object.values(values)) expect(flat, v).toContain(strip(v));
    expect(flat).toContain("48em");
    expect(flat).toContain("#0B5CAD");
    for (const cls of out.classes.flat()) expect(out.css).toContain(cls);
  });

  test("whatever values the forms admit, the CSS compiled with them used by their style props is well formed and holds each value whole", () => {
    const tuple = fc.record(Object.fromEntries(GROUPS.map((g) => [g, GEN[g] ?? colorValue])));
    fc.assert(
      fc.property(tuple, colorValue, colorValue, (vals, light, dark) => {
        const extra: Record<string, unknown> = { color: { text: "#111111", a: { light, dark } } };
        for (const g of GROUPS) extra[g] = { a: vals[g] };
        const usages = [
          { props: { bg: "a" } },
          ...Object.keys(PROP)
            .filter((g) => g !== "color")
            .map((g) => ({ props: { [PROP[g] ?? "p"]: "a" } })),
          { props: { p: "a" }, breakpoint: "a" },
        ];
        // `border` and `shadow` hold no ref here: their generated forms use hex colors, so the `text` color is needed only to keep the group sets alike.
        const out = compileWith(extra, usages);
        wellFormed(out.css);
        const flat = strip(out.css);
        for (const g of GROUPS) {
          if (g === "motion") continue;
          expect(flat, `${g}: ${vals[g]}`).toContain(strip(vals[g] ?? ""));
        }
        expect(flat).toContain(light);
        expect(flat).toContain(dark);
      }),
      { seed: SEED, numRuns: 80 },
    );
  });

  test("the strict reader refuses the broken sheets it is meant to catch (it finds an unclosed string, bracket and block)", () => {
    expect(scanCss('.a{font-family:"Inter var,sans-serif}').errors.length).toBeGreaterThan(0);
    expect(scanCss(".a{color:rgb(1,2,3}").errors.length).toBeGreaterThan(0);
    expect(scanCss(".a{color:red;").errors.length).toBeGreaterThan(0);
    expect(scanCss(".a{color:red}}").errors.length).toBeGreaterThan(0);
    expect(scanCss('.a{color:red}\n.b{--x:"ok"}@media (min-width:1px){.c{p:1}}').errors).toEqual([]);
  });
});
