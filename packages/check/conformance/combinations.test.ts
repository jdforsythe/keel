// Spec: k.themes, clause "With color tokens `text` `{ light: '#1a191e', dark: '#F3F3F3' }` and `surface` `{ light: '#F9F9F9', dark: '#141317' }` and `themes: { slate: { color: { surface: { light: '#F4F7FB', dark: '#10151C' } } }, hc: { when: 'contrast' }, paper: { when: 'print', color: { text: '#000000' } } }`, `combinations(tokens)` names, in order, `light`, `light+hc`, `light+slate`, `light+slate+hc`, `dark`, `dark+hc`, `dark+slate`, `dark+slate+hc`, `print`, `print+hc`, `print+slate`, `print+slate+hc`, and in `print+slate` `text` is `#000000` and `surface` `#F4F7FB`, in `dark+slate` `#F3F3F3` and `#10151C`; with nine `choice` themes it throws E1807."
// Spec: k.a11y-static, clause "With color tokens `low` `#B91C1C` and `bg` `#ffffff` and `themes: { hc: { when: 'contrast' } }`, `<Text fg=\"low\" bg=\"bg\">x</Text>` is one E1804 with message `fg \"low\" on bg \"bg\" is 6.47:1 in light+hc, needs 7:1`; with `hc` holding `low: '#9B1C1C'` it is none."
// Spec: k.a11y-static, clause "With color tokens `ink` `#ffffff` and `bg` `#1a191e` and `themes: { paper: { when: 'print', color: { bg: '#ffffff' } } }`, `<Text fg=\"ink\" bg=\"bg\">x</Text>` is one E1804 whose message ends `in print, needs 4.5:1`; inside `<Box media=\"screen\">` it is none."
// Spec: k.a11y-static, clause "With color tokens `card` `#FFFFFF`, `surface` `#F9F9F9` and `on` `#FFFFFF` and `overlay: { scrim: { value: 'rgb(26 25 30 / 0.6)', over: ['surface', 'card'] } }`, `<Text fg=\"on\" bg=\"scrim\">x</Text>` in a component's outermost element is no E1804 (4.73:1 and 4.58:1), and with `themes: { hc: { when: 'contrast' } }` one with message `fg \"on\" on bg \"scrim\" over \"surface\" is 4.73:1 in light+hc, needs 7:1`; `<Box bg=\"text\"><Text fg=\"on\" bg=\"scrim\">x</Text></Box>` with a color token `text` is one E1817 with message `bg \"scrim\" sits on \"text\", not in its over`."
// Spec: k.a11y-static, clause "With color tokens `fg` `{ light: '#111111', dark: '#787878' }` and `bg` `'#ffffff'`, `<Box scheme=\"light\"><Text fg=\"fg\" bg=\"bg\">x</Text></Box>` is no E1804 and `<Box scheme=\"dark\">` around it one, ending `in dark, needs 4.5:1`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// ASSUMPTIONS: tokens are written through `looseTokens` (support.ts), plain data given to `defineTokens`, so `themes` and `overlay` type-check before `Tokens` names them, and reach `check()` as `artifacts: { tokens }`. `combinations(tokens)` returns `{ name, tokens }[]`, read here with `Reflect.get`. A `<Text>` in a component's outermost element is judged against the `bg` it writes. Ratios are recomputed from the formulas (support.ts `ratioOf`, `blend`); the composite's channels round to integers as browsers do, so a ratio is compared to the clause's number at one decimal and the message to the recomputed one.
// The refusal one past each limit (9 `choice` themes, a second `contrast`, a second `print`) is k.values Themes' (E1807 from `defineTokens`) and `combinations(tokens)` throws E1807 for it likewise (the clause's last words); a set within the limits gives at most 54. "Judged in that scheme's combinations and the printing ones" for an element under `Box scheme`: the case asserts the message names a combination of that scheme or `print`.
// Needs a real browser: nothing here.
import { check } from "@keel/check";
import { combinations } from "@keel/ui/css";
import { TokenSchema } from "@keel/ui/tokens";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { atText } from "./library-looks-support.ts";
import { SEED, blend, looseTokens, one, ratioOf } from "./support.ts";

const read = (v: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>((o, k) => (typeof o === "object" && o !== null ? Reflect.get(o, k) : undefined), v);
const E = (source: string, tokens: unknown) =>
  check(one(`import { Box, Text } from '@keel/ui'\nexport default function C() { return ${source} }\n`), {
    artifacts: { tokens },
    types: false,
  }).diagnostics;
const e1804 = (source: string, tokens: unknown) => E(source, tokens).filter((d) => d.code === "E1804");
const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);
const codeOf = (f: () => unknown): unknown => {
  try {
    f();
    return null;
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : null;
  }
};
const letters = (n: number): string[] => Array.from({ length: n }, (_, i) => `t${String.fromCharCode(97 + i)}`);

describe("k.a11y-static: combinations(tokens)", () => {
  const tokensOf = () =>
    looseTokens({
      color: { text: { light: "#1a191e", dark: "#F3F3F3" }, surface: { light: "#F9F9F9", dark: "#141317" } },
      themes: {
        slate: { color: { surface: { light: "#F4F7FB", dark: "#10151C" } } },
        hc: { when: "contrast" },
        paper: { when: "print", color: { text: "#000000" } },
      },
    });
  const by = (name: string, group: string, token: string): unknown =>
    read(
      combinations(tokensOf()).find((c) => c.name === name),
      "tokens",
      group,
      token,
    );

  test("With color tokens `text` and `surface` as pairs and `themes: { slate, hc, paper }`, `combinations(tokensOf())` names, in order, `light`, `light+hc`, `light+slate`, `light+slate+hc`, `dark`, `dark+hc`, `dark+slate`, `dark+slate+hc`, `print`, `print+hc`, `print+slate`, `print+slate+hc`", () => {
    expect(combinations(tokensOf()).map((c) => c.name)).toEqual([
      "light",
      "light+hc",
      "light+slate",
      "light+slate+hc",
      "dark",
      "dark+hc",
      "dark+slate",
      "dark+slate+hc",
      "print",
      "print+hc",
      "print+slate",
      "print+slate+hc",
    ]);
  });

  test("in `print+slate` `text` is `#000000` and `surface` `#F4F7FB`, in `dark+slate` `#F3F3F3` and `#10151C`", () => {
    expect(by("print+slate", "color", "text")).toBe("#000000");
    expect(by("print+slate", "color", "surface")).toBe("#F4F7FB");
    expect(by("dark+slate", "color", "text")).toBe("#F3F3F3");
    expect(by("dark+slate", "color", "surface")).toBe("#10151C");
  });

  test("each combination's tokens are flat: no `themes` and no pair", () => {
    for (const c of combinations(tokensOf())) {
      expect(read(c, "tokens", "themes"), c.name).toBeUndefined();
      for (const v of Object.values(read(c, "tokens", "color") ?? {})) expect(typeof v, c.name).toBe("string");
    }
  });

  test("whatever the schemes and the `choice`, `contrast` and `print` themes within the limits, the combinations are per scheme, then `print`, each with no `choice` theme and then each in order, the `contrast` theme off and then on, at most 54", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(["light"], ["dark"], ["light", "dark"]),
        fc.integer({ min: 0, max: 8 }),
        fc.boolean(),
        fc.boolean(),
        (schemes, nChoice, hasHc, hasPrint) => {
          const themes: Record<string, unknown> = {};
          for (const n of letters(nChoice)) themes[n] = { color: { x: "#222222" } };
          if (hasHc) themes.hc = { when: "contrast" };
          if (hasPrint) themes.paper = { when: "print", color: { x: "#000000" } };
          const t = looseTokens({ color: { x: { light: "#111111", dark: "#eeeeee" } }, schemes, themes });
          const bases = [...schemes, ...(hasPrint ? ["print"] : [])];
          const want = bases.flatMap((b) =>
            [b, ...letters(nChoice).map((c) => `${b}+${c}`)].flatMap((n) => (hasHc ? [n, `${n}+hc`] : [n])),
          );
          const got = combinations(t).map((c) => c.name);
          expect(got).toEqual(want);
          expect(new Set(got).size).toBe(got.length);
          expect(got.length).toBeLessThanOrEqual(54);
        },
      ),
      { seed: SEED, numRuns: 80 },
    );
  });

  test("a `schemes` other than `['light']`, `['dark']` and `['light', 'dark']` (k.schemes Schemes) is E1807, so `['dark', 'light']` has no combinations", () => {
    for (const schemes of [["dark", "light"], [], ["light", "light"], ["sepia"]]) {
      expect(
        codeOf(() => looseTokens({ color: { x: "#111111" }, schemes })),
        JSON.stringify(schemes),
      ).toBe("E1807");
    }
  });

  test("the most any tokens give is 54: both schemes, 8 `choice` themes, `contrast` and `print`", () => {
    const themes: Record<string, unknown> = { hc: { when: "contrast" }, paper: { when: "print" } };
    for (const n of letters(8)) themes[n] = {};
    const t = looseTokens({ color: { x: { light: "#111111", dark: "#eeeeee" } }, schemes: ["light", "dark"], themes });
    expect(combinations(t)).toHaveLength(54);
  });

  test("a combination's values are the top level's, the scheme's of each pair, then each theme on in the order `choice`, `contrast`, `print`, a later value winning", () => {
    fc.assert(
      fc.property(
        hex,
        hex,
        hex,
        hex,
        hex,
        hex,
        hex,
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (a, b, c, d, e, f, g, chosen, contrastSets, printSets) => {
          const choice = chosen ? { color: { x: { light: c, dark: d } } } : {};
          const t = looseTokens({
            color: { x: { light: a, dark: b } },
            themes: {
              pick: choice,
              hc: { when: "contrast", ...(contrastSets ? { color: { x: { light: e, dark: f } } } : {}) },
              paper: { when: "print", ...(printSets ? { color: { x: g } } : {}) },
            },
          });
          for (const combo of combinations(t)) {
            const parts = combo.name.split("+");
            const scheme = parts[0] === "print" ? "light" : parts[0] === "dark" ? "dark" : "light";
            const pick = (p: { light: string; dark: string }): string => p[scheme === "dark" ? "dark" : "light"];
            let want = pick({ light: a, dark: b });
            if (parts.includes("pick") && chosen) want = pick({ light: c, dark: d });
            if (parts.includes("hc") && contrastSets) want = pick({ light: e, dark: f });
            if (parts[0] === "print" && printSets) want = g;
            expect(read(combo, "tokens", "color", "x"), combo.name).toBe(want);
          }
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("the limits are 8 `choice` themes, one `contrast` and one `print`, and one past each fails `TokenSchema`", () => {
    const within = (n: number, hc: number, pr: number): Record<string, unknown> => {
      const themes: Record<string, unknown> = {};
      for (const k of letters(n)) themes[k] = {};
      for (const k of letters(hc)) themes[`h${k}`] = { when: "contrast" };
      for (const k of letters(pr)) themes[`p${k}`] = { when: "print" };
      return { color: { x: "#111111" }, themes };
    };
    expect(TokenSchema.parse(within(8, 1, 1)).ok).toBe(true);
    expect(TokenSchema.parse(within(9, 0, 0)).ok).toBe(false);
    expect(TokenSchema.parse(within(0, 2, 0)).ok).toBe(false);
    expect(TokenSchema.parse(within(0, 0, 2)).ok).toBe(false);
  });

  test("with nine `choice` themes it throws E1807, as `defineTokens` does for tokens `TokenSchema` refuses, and so for a second `contrast` or `print` theme", () => {
    const plain = (themes: Record<string, unknown>): Parameters<typeof combinations>[0] =>
      JSON.parse(JSON.stringify({ color: { x: "#111111" }, themes }));
    const nine = Object.fromEntries(letters(9).map((n) => [n, {}]));
    expect(codeOf(() => combinations(plain(nine)))).toBe("E1807");
    expect(codeOf(() => looseTokens({ color: { x: "#111111" }, themes: nine }))).toBe("E1807");
    expect(codeOf(() => combinations(plain({ a: { when: "contrast" }, b: { when: "contrast" } })))).toBe("E1807");
    expect(codeOf(() => combinations(plain({ a: { when: "print" }, b: { when: "print" } })))).toBe("E1807");
    expect(codeOf(() => combinations(plain(Object.fromEntries(letters(8).map((n) => [n, {}])))))).toBeNull();
  });
});

describe("k.a11y-static: the contrast theme needs 7:1", () => {
  const text = '<Text fg="low" bg="bg">x</Text>';
  const colors = (hc?: string) =>
    looseTokens({
      color: { low: "#B91C1C", bg: "#ffffff" },
      themes: { hc: { when: "contrast", ...(hc === undefined ? {} : { color: { low: hc } }) } },
    });

  test(
    'With color tokens `low` `#B91C1C` and `bg` `#ffffff` and `themes: { hc: { when: \'contrast\' } }`, `<Text fg="low" bg="bg">x</Text>` is one E1804 with message `fg "low" on bg "bg" is 6.47:1 in light+hc, needs 7:1`; with `hc` holding `low: \'#9B1C1C\'` it is none',
    () => {
      expect(ratioOf("#B91C1C", "#ffffff")).toBe("6.47");
      const d = e1804(text, colors());
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('fg "low" on bg "bg" is 6.47:1 in light+hc, needs 7:1');
      expect(Number.parseFloat(ratioOf("#9B1C1C", "#ffffff"))).toBeGreaterThanOrEqual(7);
      expect(e1804(text, colors("#9B1C1C"))).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "text needs 4.5:1 at a large size under the contrast theme, 3:1 in the other combinations",
    () => {
      const big = '<Text fg="low" bg="bg" fontSize="big">x</Text>';
      const t = (fg: string) =>
        looseTokens({
          color: { low: fg, bg: "#ffffff" },
          fontSize: { big: "24px" },
          themes: { hc: { when: "contrast" } },
        });
      expect(e1804(big, t("#B91C1C"))).toEqual([]);
      expect(ratioOf("#949494", "#ffffff")).toBe("3.03");
      expect(e1804(big, t("#949494")).map((d) => d.message)).toEqual([
        'fg "low" on bg "bg" is 3.03:1 in light+hc, needs 4.5:1',
      ]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the foreground, the pair fails in `light+hc` exactly when it is below 7:1, and in `light` exactly when below 4.5:1, the first failing combination reported",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 255 }), (g) => {
          const fg = `#${g.toString(16).padStart(2, "0").repeat(3)}`;
          const r = Number.parseFloat(ratioOf(fg, "#ffffff"));
          fc.pre(Math.abs(r - 4.5) > 0.02 && Math.abs(r - 7) > 0.02);
          const d = e1804(
            text,
            looseTokens({ color: { low: fg, bg: "#ffffff" }, themes: { hc: { when: "contrast" } } }),
          );
          expect(d.length).toBe(r < 7 ? 1 : 0);
          if (r < 7) expect(d[0]?.message).toContain(r < 4.5 ? " in light, needs 4.5:1" : " in light+hc, needs 7:1");
        }),
        { seed: SEED, numRuns: 40 },
      );
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.a11y-static: print is judged only with a print theme", () => {
  const tOf = () =>
    looseTokens({
      color: { ink: "#ffffff", bg: "#1a191e" },
      themes: { paper: { when: "print", color: { bg: "#ffffff" } } },
    });
  const text = '<Text fg="ink" bg="bg">x</Text>';

  test(
    'With color tokens `ink` `#ffffff` and `bg` `#1a191e` and `themes: { paper: { when: \'print\', color: { bg: \'#ffffff\' } } }`, `<Text fg="ink" bg="bg">x</Text>` is one E1804 whose message ends `in print, needs 4.5:1`; inside `<Box media="screen">` it is none',
    () => {
      const d = e1804(text, tOf());
      expect(d).toHaveLength(1);
      expect(d[0]?.message.endsWith("in print, needs 4.5:1")).toBe(true);
      expect(e1804(`<Box media="screen">${text}</Box>`, tOf())).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    'an element at or under `media="print"` is judged in the printing combinations only, and with no `print` theme nothing is judged printing',
    () => {
      const p = looseTokens({
        color: { ink: "#ffffff", bg: "#f5f5f5" },
        themes: { paper: { when: "print", color: { bg: "#000000" } } },
      });
      expect(e1804(text, p).map((d) => d.message.includes("in light,"))).toEqual([true]);
      expect(e1804(`<Box media="print">${text}</Box>`, p)).toEqual([]);
      expect(e1804('<Text media="print" fg="ink" bg="bg">x</Text>', p)).toEqual([]);
      expect(
        e1804(`<Box media="print">${text}</Box>`, tOf()).map((d) => d.message.endsWith("in print, needs 4.5:1")),
      ).toEqual([true]);
      const noPrint = looseTokens({ color: { ink: "#ffffff", bg: "#1a191e" } });
      expect(e1804(text, noPrint)).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.a11y-static: overlays", () => {
  const SCRIM = [26, 25, 30] as const;
  const over = (alpha: number, list: string[], extra: Record<string, unknown> = {}) =>
    looseTokens({
      color: { card: "#FFFFFF", surface: "#F9F9F9", on: "#FFFFFF", text: "#1a191e", ...extra },
      overlay: { scrim: { value: `rgb(26 25 30 / ${alpha})`, over: list } },
    });
  const composite = (alpha: number, backdrop: string): string => blend([SCRIM[0], SCRIM[1], SCRIM[2]], alpha, backdrop);
  const OVER_TEXT = '<Text fg="on" bg="scrim">x</Text>';

  test(
    "With color tokens `card` `#FFFFFF`, `surface` `#F9F9F9` and `on` `#FFFFFF` and `overlay: { scrim: { value: 'rgb(26 25 30 / 0.6)', over: ['surface', 'card'] } }`, `<Text fg=\"on\" bg=\"scrim\">x</Text>` in a component's outermost element is no E1804 (4.73:1 and 4.58:1)",
    () => {
      expect(Number.parseFloat(ratioOf("#FFFFFF", composite(0.6, "#F9F9F9")))).toBeCloseTo(4.73, 1);
      expect(Number.parseFloat(ratioOf("#FFFFFF", composite(0.6, "#FFFFFF")))).toBeCloseTo(4.58, 1);
      expect(e1804(OVER_TEXT, over(0.6, ["surface", "card"]))).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    'and with `themes: { hc: { when: \'contrast\' } }` one with message `fg "on" on bg "scrim" over "surface" is 4.73:1 in light+hc, needs 7:1`',
    () => {
      const t = looseTokens({
        color: { card: "#FFFFFF", surface: "#F9F9F9", on: "#FFFFFF" },
        overlay: { scrim: { value: "rgb(26 25 30 / 0.6)", over: ["surface", "card"] } },
        themes: { hc: { when: "contrast" } },
      });
      const d = e1804(OVER_TEXT, t);
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(
        `fg "on" on bg "scrim" over "surface" is ${ratioOf("#FFFFFF", composite(0.6, "#F9F9F9"))}:1 in light+hc, needs 7:1`,
      );
      expect(d[0]?.message).toBe('fg "on" on bg "scrim" over "surface" is 4.73:1 in light+hc, needs 7:1');
    },
    CHECK_CASE_BOUND,
  );

  test(
    '`<Box bg="text"><Text fg="on" bg="scrim">x</Text></Box>` with a color token `text` is one E1817 with message `bg "scrim" sits on "text", not in its over`',
    () => {
      const d = E(`<Box bg="text">${OVER_TEXT}</Box>`, over(0.6, ["surface", "card"])).filter(
        (x) => x.code === "E1817",
      );
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('bg "scrim" sits on "text", not in its over');
      expect(d[0]?.fix).toBeUndefined();
      const src = `import { Box, Text } from '@keel/ui'\nexport default function C() { return <Box bg="text">${OVER_TEXT}</Box> }\n`;
      expect(atText(src, '"scrim"', d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
      expect(d[0]?.col).toBe((src.split("\n")[1]?.indexOf('bg="scrim"') ?? -2) + 4);
    },
    CHECK_CASE_BOUND,
  );

  test(
    'a backdrop that is itself an overlay is E1817 `bg "scrim" sits on overlay "veil"`, and a backdrop in `over` is none',
    () => {
      const t = looseTokens({
        color: { card: "#FFFFFF", surface: "#F9F9F9", on: "#FFFFFF" },
        overlay: {
          scrim: { value: "rgb(26 25 30 / 0.6)", over: ["card"] },
          veil: { value: "rgb(26 25 30 / 0.2)", over: ["card"] },
        },
      });
      const msgs = (s: string) =>
        E(s, t)
          .filter((x) => x.code === "E1817")
          .map((x) => x.message);
      expect(msgs(`<Box bg="veil">${OVER_TEXT}</Box>`)).toEqual(['bg "scrim" sits on overlay "veil"']);
      expect(msgs(`<Box bg="card">${OVER_TEXT}</Box>`)).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a `bg` overlay sits on the parent's `bg` when found: only that backdrop is judged, and over each `over` when none is found, the first failing reported",
    () => {
      let alpha = 0.3;
      while (
        alpha < 0.95 &&
        !(
          Number.parseFloat(ratioOf("#FFFFFF", composite(alpha, "#FFFFFF"))) < 4.5 - 0.02 &&
          Number.parseFloat(ratioOf("#FFFFFF", composite(alpha, "#F9F9F9"))) > 4.5 + 0.02
        )
      )
        alpha = Math.round((alpha + 0.01) * 100) / 100;
      const t = over(alpha, ["surface", "card"]);
      const failing = ratioOf("#FFFFFF", composite(alpha, "#FFFFFF"));
      expect(e1804(`<Box bg="surface">${OVER_TEXT}</Box>`, t)).toEqual([]);
      expect(e1804(`<Box bg="card">${OVER_TEXT}</Box>`, t).map((d) => d.message)).toEqual([
        `fg "on" on bg "scrim" over "card" is ${failing}:1 in light, needs 4.5:1`,
      ]);
      expect(e1804(OVER_TEXT, t).map((d) => d.message)).toEqual([
        `fg "on" on bg "scrim" over "card" is ${failing}:1 in light, needs 4.5:1`,
      ]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "an `fg` overlay is composited over the element's `bg`, whatever the alpha, and judged at the ratio of the composite",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 5, max: 100 }), (pct) => {
          const a = pct / 100;
          const want = Number.parseFloat(ratioOf(composite(a, "#FFFFFF"), "#FFFFFF"));
          fc.pre(Math.abs(want - 4.5) > 0.03);
          const d = e1804('<Text fg="scrim" bg="card">x</Text>', over(a, ["card"]));
          expect(d.length).toBe(want < 4.5 ? 1 : 0);
          if (d[0] !== undefined) {
            expect(d[0].message.startsWith('fg "scrim" on bg "card" is ')).toBe(true);
            expect(
              Math.abs(Number.parseFloat(/is (\d+\.\d\d):1/.exec(d[0].message)?.[1] ?? "NaN") - want),
            ).toBeLessThanOrEqual(0.011);
          }
        }),
        { seed: SEED, numRuns: 40 },
      );
    },
    CHECK_CASE_BOUND,
  );
});

describe("k.a11y-static: Box scheme", () => {
  const tOf = () => looseTokens({ color: { fg: { light: "#111111", dark: "#787878" }, bg: "#ffffff" } });
  const text = '<Text fg="fg" bg="bg">x</Text>';

  test(
    'With color tokens `fg` `{ light: \'#111111\', dark: \'#787878\' }` and `bg` `\'#ffffff\'`, `<Box scheme="light"><Text fg="fg" bg="bg">x</Text></Box>` is no E1804 and `<Box scheme="dark">` around it one, ending `in dark, needs 4.5:1`',
    () => {
      expect(e1804(`<Box scheme="light">${text}</Box>`, tOf())).toEqual([]);
      const d = e1804(`<Box scheme="dark">${text}</Box>`, tOf());
      expect(d).toHaveLength(1);
      expect(d[0]?.message.endsWith("in dark, needs 4.5:1")).toBe(true);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "an element under `scheme` is judged in that scheme's combinations and the printing ones, whatever the scheme and the theme",
    () => {
      const themed = looseTokens({
        color: { fg: { light: "#787878", dark: "#787878" }, bg: { light: "#ffffff", dark: "#ffffff" } },
        themes: { paper: { when: "print", color: { fg: "#787878" } } },
      });
      fc.assert(
        fc.property(fc.constantFrom("light", "dark"), (scheme) => {
          const d = e1804(`<Box scheme="${scheme}">${text}</Box>`, themed);
          expect(d).toHaveLength(1);
          expect(d[0]?.message).toMatch(new RegExp(` in (${scheme}|print)(\\+[a-z]+)*, needs`));
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    CHECK_CASE_BOUND,
  );
});
