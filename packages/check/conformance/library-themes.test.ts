// Spec: k.values, clause "In the k.looks fixture with `acmeTokens` also holding `themes: { contrast: { color: { 'acme.accent': '#08427D' } } }` and the app's `tokens.ts` adding `themes: { hc: { when: 'contrast', color: {} } }`, `keel check` reports one E1810 with message `@acme/ui needs themes.hc color \"acme.accent\"; spread acmeTokens.themes.contrast.color`; after its fix, none, and the CSS's `keel.contrast` layer declares `--k-color-acme-accent:#08427D`; a shipped `themes: { slate: {} }` is one E1812 with message `acmeTokens holds themes \"slate\"; only contrast and print`."
// Spec: k.looks, clause "In an app, an E1804 at an element of a library file, or at a library look, is reported in `tokens.ts`: at the opening quote of the app's key for its `fg` when the app writes one, else for its `bg`, else at the spread `...<id>Tokens.color`, else line 1, column 1, the app's key being the one in the latest layer on in that combination (k.a11y-static Combinations) that writes it, in the order `print`, `contrast`, `choice`, top level; once per pair and combination, so with no `themes` once per pair and scheme; message `<fg> on <bg> is <ratio>:1 in <combination>, needs <need>:1; override in tokens.ts`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// ASSUMPTIONS: see library-looks-support.ts (the k.looks fixture, tokens given to `check()` as `artifacts: { tokens }` beside the `tokens.ts` text; a fix applies with `git apply` as applyFix does). The shipped object is the fixture's with a `themes` key appended in the source text. The CSS half of the clause (`keel build`'s `keel.contrast` layer) is read over `compileStyles` of the fixed project's tokens, as library-looks-e1810.test.ts reads it. "After its fix, none" is read as no E1810 for the fixed file's tokens.
// The k.looks clause above is the Library contrast paragraph, quoted whole: it has no Conformance bullet of its own (the existing `in dark` case, library-looks-e1810.test.ts and schemes-own-folder.test.ts, holds `<combination>` = `dark`), so it is quoted whole and asserted for combinations with a theme on: the message `acme.ink on acme.accent is <ratio>:1 in <combination>, needs <need>:1; override in tokens.ts`, once per pair and combination, at the key of the latest layer on that writes the failing `fg`, else `bg`.
// In `light+slate` the failing `fg` `acme.ink` is written by no layer of the app and `bg` `acme.accent` by `slate`'s: the finding is at `slate`'s `acme.accent` key; in the combinations with `hc` on, at `hc`'s (the latest layer on, order `print`, `contrast`, `choice`, top level).
import { compileStyles } from "@keel/ui/css";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import {
  SHIPPED,
  acme,
  app,
  applyFix,
  atText,
  codesOf,
  composed,
  diagnosticsOf,
  formatted,
  sourceOf,
} from "./library-looks-support.ts";
import { SEED, looseTokens, ratioOf } from "./support.ts";

const shipped = (themes: string): string =>
  `import { defineTokens } from '@keel/ui'\nexport const acmeTokens = defineTokens({ color: { 'acme.accent': '#0B5CAD', 'acme.ink': '#FFFFFF' }, look: { 'acme.badge': { bg: 'acme.accent', fg: 'acme.ink' } }, themes: { ${themes} } })\n`;
const HEAD = `import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "@acme/ui/tokens";\n`;
const appSource = (themes: string, colorTail = ""): string =>
  `${HEAD}\nexport const tokens = defineTokens({\n  ...brandTokens,\n  color: { ...brandTokens.color, ...acmeTokens.color${colorTail} },\n  look: { ...brandTokens.look, ...acmeTokens.look },\n  themes: { ${themes} },\n});\n`;
const tokensWith = (themes: unknown, color: Record<string, string> = {}) => looseTokens({ ...composed(color), themes });
const CONTRAST = "contrast: { color: { 'acme.accent': '#08427D' } }";
const HC = 'hc: { when: "contrast", color: {} }';

describe("k.values: library themes", () => {
  const files = (themesIn: string, themes: string) =>
    app(appSource(themes), [{ path: SHIPPED, source: shipped(themesIn) }]);

  test(
    "In the k.looks fixture with `acmeTokens` also holding `themes: { contrast: { color: { 'acme.accent': '#08427D' } } }` and the app's `tokens.ts` adding `themes: { hc: { when: 'contrast', color: {} } }`, `keel check` reports one E1810 with message `@acme/ui needs themes.hc color \"acme.accent\"; spread acmeTokens.themes.contrast.color`",
    () => {
      const f = files(CONTRAST, HC);
      const d = codesOf(f, "E1810", tokensWith({ hc: { when: "contrast", color: {} } }));
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(
        '@acme/ui needs themes.hc color "acme.accent"; spread acmeTokens.themes.contrast.color',
      );
      expect(d[0]?.path).toBe("tokens.ts");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "after its fix, none, and the CSS's `keel.contrast` layer declares `--k-color-acme-accent:#08427D`",
    () => {
      const f = files(CONTRAST, HC);
      const before = codesOf(f, "E1810", tokensWith({ hc: { when: "contrast", color: {} } }));
      const fix = before[0]?.fix;
      expect(fix).toBeDefined();
      const fixed = applyFix(f, fix ?? "");
      const text = formatted(sourceOf(fixed, "tokens.ts"));
      expect(text).toContain("...acmeTokens.themes.contrast.color");
      const t = tokensWith({ hc: { when: "contrast", color: { "acme.accent": "#08427D" } } });
      expect(codesOf(fixed, "E1810", t)).toEqual([]);
      const css = compileStyles({ tokens: t, usages: [] }).css.replace(/\s+/g, "");
      const at = css.indexOf("@layerkeel.contrast{");
      expect(at).toBeGreaterThanOrEqual(0);
      expect(css.slice(at)).toContain("--k-color-acme-accent:#08427D");
      expect(css.slice(0, at)).not.toContain("#08427D");
    },
    CHECK_CASE_BOUND,
  );

  test(
    'a shipped `themes: { slate: {} }` is one E1812 with message `acmeTokens holds themes "slate"; only contrast and print`',
    () => {
      const d = codesOf(files("slate: {}", HC), "E1812", composed());
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('acmeTokens holds themes "slate"; only contrast and print');
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );

  test(
    'whatever the key, a shipped theme is E1812 `acmeTokens holds themes "<key>"; only contrast and print` unless it is `contrast` or `print`',
    () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constantFrom("contrast", "print", "choice", "hc"), fc.stringMatching(/^[a-z]{2,8}$/)),
          (key) => {
            const d = codesOf(app(undefined, [{ path: SHIPPED, source: shipped(`${key}: {}`) }]), "E1812");
            const ok = key === "contrast" || key === "print";
            expect(d.map((x) => x.message)).toEqual(
              ok ? [] : [`acmeTokens holds themes "${key}"; only contrast and print`],
            );
          },
        ),
        { seed: SEED, numRuns: 25 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test(
    'the app\'s `print` theme holds every name the shipped `print` holds, else E1810 `@acme/ui needs themes.<theme> color "acme.accent"; spread acmeTokens.themes.print.color`',
    () => {
      const f = app(appSource('paper: { when: "print", color: {} }'), [
        { path: SHIPPED, source: shipped("print: { color: { 'acme.accent': '#000000' } }") },
      ]);
      expect(codesOf(f, "E1810", tokensWith({ paper: { when: "print", color: {} } })).map((d) => d.message)).toEqual([
        '@acme/ui needs themes.paper color "acme.accent"; spread acmeTokens.themes.print.color',
      ]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "an app with no `contrast` theme is asked for none of the shipped `contrast` values, and a `choice` theme takes the library's top-level values and may re-value an `acme.` name",
    () => {
      const f = files(CONTRAST, 'slate: { color: { "acme.accent": "#3D8BD9" } }');
      const t = tokensWith({ slate: { color: { "acme.accent": "#3D8BD9" } } });
      expect(codesOf(f, "E1810", t)).toEqual([]);
      expect(codesOf(f, "E1813", t)).toEqual([]);
      const typo = tokensWith({ slate: { color: { "acme.acent": "#3D8BD9" } } });
      expect(codesOf(files(CONTRAST, 'slate: { color: { "acme.acent": "#3D8BD9" } }'), "E1813", typo)).toHaveLength(1);
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.looks: Library contrast per combination", () => {
  const SLATE = 'slate: { color: { "acme.accent": "#3D8BD9" } }';
  const source = appSource(SLATE);
  const f = app(source);
  const tOf = () => tokensWith({ slate: { color: { "acme.accent": "#3D8BD9" } } });

  test(
    "an E1804 at a library look under a `choice` theme is reported in `tokens.ts`, message `acme.ink on acme.accent is <ratio>:1 in light+slate, needs 4.5:1; override in tokens.ts`, once, at the theme's key",
    () => {
      expect(ratioOf("#FFFFFF", "#3D8BD9")).toBe("3.56");
      const d = diagnosticsOf(f, tOf()).filter((x) => x.code === "E1804");
      expect(d.map((x) => x.message)).toEqual([
        "acme.ink on acme.accent is 3.56:1 in light+slate, needs 4.5:1; override in tokens.ts",
      ]);
      expect(d[0]?.path).toBe("tokens.ts");
      expect(
        atText(sourceOf(f, "tokens.ts"), '"acme.accent"', d[0]?.line ?? 0, d[0]?.col ?? 0, source.indexOf("slate:")),
      ).toBe(true);
      expect(d.filter((x) => x.path.startsWith("node_modules/"))).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "under the `contrast` theme the library's pair needs 7:1: a shipped pair that clears 4.5:1 in `light` fails in `light+hc` with `needs 7:1`",
    () => {
      const mid = "#2F6FB5";
      expect(Number.parseFloat(ratioOf("#FFFFFF", mid))).toBeGreaterThanOrEqual(4.5);
      expect(Number.parseFloat(ratioOf("#FFFFFF", mid))).toBeLessThan(7);
      const own = looseTokens({ ...composed({ "acme.accent": mid }), themes: { hc: { when: "contrast", color: {} } } });
      const text = appSource(
        'hc: { when: "contrast", color: { ...acmeTokens.themes.contrast.color } }',
        `, "acme.accent": "${mid}"`,
      );
      const d = diagnosticsOf(
        app(text, [{ path: SHIPPED, source: shipped("contrast: { color: { 'acme.ink': '#FFFFFF' } }") }]),
        own,
      ).filter((x) => x.code === "E1804");
      expect(d.map((x) => x.message)).toEqual([
        `acme.ink on acme.accent is ${ratioOf("#FFFFFF", mid)}:1 in light+hc, needs 7:1; override in tokens.ts`,
      ]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "the key reported is the one in the latest layer on in that combination that writes it, in the order `print`, `contrast`, `choice`, top level, once per pair and combination",
    () => {
      const hcColor = '...acmeTokens.themes.contrast.color, "acme.accent": "#3D8BD9"';
      const themes = `slate: { color: { "acme.accent": "#3D8BD9" } },\n    hc: { when: "contrast", color: { ${hcColor} } }`;
      const text = appSource(themes);
      const files = app(text, [{ path: SHIPPED, source: shipped("contrast: { color: { 'acme.ink': '#FFFFFF' } }") }]);
      const tokens = looseTokens({
        ...composed(),
        themes: {
          slate: { color: { "acme.accent": "#3D8BD9" } },
          hc: { when: "contrast", color: { "acme.ink": "#FFFFFF", "acme.accent": "#3D8BD9" } },
        },
      });
      const d = diagnosticsOf(files, tokens).filter((x) => x.code === "E1804");
      const combo = (x: { message: string }): string => /in ([a-z+]+),/.exec(x.message)?.[1] ?? "";
      expect(d.map(combo).sort()).toEqual(["light+hc", "light+slate", "light+slate+hc"]);
      const src = sourceOf(files, "tokens.ts");
      const slateAt = src.indexOf('"acme.accent"', src.indexOf("slate:"));
      const hcAt = src.indexOf('"acme.accent"', src.indexOf("hc:"));
      const keyOf = (name: string) => {
        const x = d.find((y) => combo(y) === name);
        return { line: x?.line ?? 0, col: x?.col ?? 0 };
      };
      const at = (from: number) =>
        atText(src, '"acme.accent"', keyOf("light+slate").line, keyOf("light+slate").col, from);
      expect(at(slateAt)).toBe(true);
      for (const name of ["light+hc", "light+slate+hc"]) {
        expect(atText(src, '"acme.accent"', keyOf(name).line, keyOf(name).col, hcAt), name).toBe(true);
      }
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the accent a `choice` theme gives, the finding exists exactly when the pair is below 4.5:1 in `light+slate`, and carries that combination's name",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 255 }), (g) => {
          const accent = `#${g.toString(16).padStart(2, "0").repeat(3)}`;
          const r = Number.parseFloat(ratioOf("#FFFFFF", accent));
          fc.pre(Math.abs(r - 4.5) > 0.02 && Math.abs(r - 3) > 0.02);
          const tokens = looseTokens({ ...composed(), themes: { slate: { color: { "acme.accent": accent } } } });
          const d = diagnosticsOf(app(appSource(`slate: { color: { "acme.accent": "${accent}" } }`)), tokens).filter(
            (x) => x.code === "E1804",
          );
          expect(d.length).toBe(r < 4.5 ? 1 : 0);
          if (r < 4.5) expect(d[0]?.message).toContain(" in light+slate, needs 4.5:1; override in tokens.ts");
        }),
        { seed: SEED, numRuns: 25 },
      );
    },
    CHECK_CASE_BOUND,
  );
});
