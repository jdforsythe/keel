// k.gamut CSS: `keel build` verifies the built CSS holds, for each color, a value check judged (E1819).
import { transform } from "esbuild";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { builtCssProblem } from "../src/internal/builtCssProblem.ts";
import { cssRules } from "../src/internal/cssRules.ts";
import { guardP3 } from "../src/internal/guardP3.ts";
import { lacksColorFunction } from "../src/internal/lacksColorFunction.ts";
import { sameCssValue } from "../src/internal/sameCssValue.ts";

/** CSS as `compileStyles` writes it for a color outside sRGB, an overlay, a shadow and a print theme. */
const COMPILED = [
  "@layer keel.tokens,keel.theme,keel.contrast,keel.print;",
  "@layer keel.tokens{",
  ":root{color-scheme:light;--k-color-a:rgb(0 133 127);--k-color-b:#000000;--k-overlay-s:rgb(0 167 4 / 0.95);--k-shadow-x:0 1px 2px rgb(0 0 0 / 0.2);--k-motion-fast:0.12s}",
  "@media screen and (color-gamut: p3){",
  ":root{--k-color-a:color(display-p3 0 0.52 0.5);--k-overlay-s:color(display-p3 0 0.66 0 / 0.95)}",
  "}",
  "@media screen and (prefers-color-scheme: dark){",
  ':root:not([data-k-scheme="light"]){--k-color-b:#FFFFFF}',
  "}",
  "@media screen and (prefers-color-scheme: dark) and (color-gamut: p3){",
  ':root:not([data-k-scheme="light"]){--k-color-a:color(display-p3 0.9 0.2 0.1)}',
  "}",
  "}",
  "@layer keel.contrast{",
  "@media (prefers-contrast: more){\n:root{--k-color-b:#111111}\n}",
  "}",
  "@layer keel.print{",
  "@media print{\n:root{color-scheme:light;print-color-adjust:exact;--k-color-a:rgb(0 133 127)}\n}",
  "}",
  "@layer keel.base{\nbody{color:var(--k-color-a)}\n}",
  ".k-a{color:var(--k-color-a)}",
  "",
].join("\n");

/** One built stylesheet. */
const css = (text: string): { path: string; text: string }[] => [{ path: "assets/entry.css", text }];
const APP = ".card{color:#fff;background:rgb(1,2,3)}@supports (display:grid){.grid{display:grid}}";

describe("builtCssProblem", () => {
  it("passes the compiled CSS, esbuild's minified form of it with the app's own CSS, and a split across files", async () => {
    expect(builtCssProblem(COMPILED, css(COMPILED))).toBeUndefined();
    const min = (await transform(COMPILED + APP, { loader: "css", minify: true })).code;
    expect(min).toContain("--k-motion-fast:.12s");
    expect(builtCssProblem(COMPILED, css(min))).toBeUndefined();
    expect(
      builtCssProblem(COMPILED, [
        { path: "a.css", text: APP },
        { path: "b.css", text: COMPILED },
        { path: "c.js", text: "x.style.color='var(--k-color-a)';/*<!--k-->*/" },
      ]),
    ).toBeUndefined();
  });

  it("finds every compiled color declaration: none is nothing to find only when the compiled CSS declares no color", () => {
    expect(builtCssProblem(COMPILED, [])).toBe("--k-color-a is missing from the built CSS, expected rgb(0 133 127)");
    expect(builtCssProblem(COMPILED, css(APP))).toBe(
      "--k-color-a is missing from the built CSS, expected rgb(0 133 127)",
    );
    expect(builtCssProblem(":root{--k-space-2:8px}", [])).toBeUndefined();
    expect(builtCssProblem("", css(APP))).toBeUndefined();
    const renamed = COMPILED.replaceAll("--k-", "--q-");
    expect(builtCssProblem(COMPILED, css(renamed))).toMatch(/^--k-color-a is missing from the built CSS/);
  });

  it("refuses any other --k-* declaration in a .css file and a color declaration in any other file", () => {
    expect(builtCssProblem(COMPILED, css(`${COMPILED}.x{--k-space-zz:4px}`))).toBe(
      "--k-space-zz is 4px in the built CSS where Keel declares none",
    );
    const js = { path: "assets/entry.js", text: `const s=${JSON.stringify(COMPILED)};` };
    expect(builtCssProblem(COMPILED, [...css(COMPILED), js])).toBe(
      "--k-color-a is rgb(0 133 127) in assets/entry.js; Keel's CSS ships in .css files",
    );
    const html = { path: "index.html", text: "<style>:root{--k-shadow-x:0 1px #000}</style>" };
    expect(builtCssProblem(COMPILED, [...css(COMPILED), html])).toBe(
      "--k-shadow-x is 0 1px #000 in index.html; Keel's CSS ships in .css files",
    );
    const spacing = { path: "assets/entry.js", text: "s.textContent=':root{--k-space-2:8px}'" };
    expect(builtCssProblem(COMPILED, [...css(COMPILED), spacing])).toBeUndefined();
  });

  it("names the at-rule a declaration sits under that Keel did not write, of any name", () => {
    for (const name of ["scope (.never)", "container (min-width:1px)", "starting-style", "keel-unknown x"]) {
      const at = name.split(" ")[0] ?? "";
      expect(builtCssProblem(COMPILED, css(`@${name}{${COMPILED}}`))).toBe(
        `--k-color-a is rgb(0 133 127) under @${at} in the built CSS, expected none`,
      );
    }
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z-]{0,12}$/).filter((n) => n !== "media" && n !== "layer"),
        fc.nat({ max: 3 }),
        (name, depth) => {
          const text = `${"@layer keel.tokens{".repeat(depth)}@${name} (x){${COMPILED}}${"}".repeat(depth)}`;
          expect(builtCssProblem(COMPILED, css(text))).toMatch(
            new RegExp(` under @${name} in the built CSS, expected none$`),
          );
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("expects the P3 blocks a guarded build writes under @supports, and only there", async () => {
    const guarded = guardP3(COMPILED);
    expect(guarded).toContain("@supports (color: color(display-p3 0 0 0)){\n@media screen and (color-gamut: p3){");
    expect(builtCssProblem(guarded, css(guarded))).toBeUndefined();
    const min = (await transform(guarded, { loader: "css", minify: true, target: "chrome100" })).code;
    expect(builtCssProblem(guarded, css(min))).toBeUndefined();
    expect(builtCssProblem(guarded, css(COMPILED))).toMatch(
      /^--k-color-a is color\(display-p3 0 0\.52 0\.5\) in the built CSS where Keel declares none$/,
    );
  });

  it("names the custom property, the value found and the value expected", () => {
    const hex = COMPILED.replace("--k-color-a:rgb(0 133 127);", "--k-color-a:#00857f;");
    expect(builtCssProblem(COMPILED, css(hex))).toBe(
      "--k-color-a is #00857f in the built CSS, expected rgb(0 133 127)",
    );
    const shadow = COMPILED.replace("rgb(0 0 0 / 0.2)", "#0003");
    expect(builtCssProblem(COMPILED, css(shadow))).toBe(
      "--k-shadow-x is 0 1px 2px #0003 in the built CSS, expected 0 1px 2px rgb(0 0 0 / 0.2)",
    );
    const comma = COMPILED.replace("rgb(0 167 4 / 0.95)", "rgb(0,167,4,.95)");
    expect(builtCssProblem(COMPILED, css(comma))).toMatch(/^--k-overlay-s is rgb\(0,167,4,\.95\) in the built CSS/);
  });

  it("fails a declaration under @supports, one where Keel declares none, a missing one, and a P3 block out of place", () => {
    const supports = `${COMPILED}@supports (color:color(display-p3 0 0 0)){:root{--k-color-a:color(display-p3 0 0.52 0.5)}}`;
    expect(builtCssProblem(COMPILED, css(supports))).toBe(
      "--k-color-a is color(display-p3 0 0.52... under @supports in the built CSS, expected none",
    );
    expect(builtCssProblem(COMPILED, css(`${COMPILED}.x{--k-color-b:#000000}`))).toBe(
      "--k-color-b is #000000 in the built CSS where Keel declares none",
    );
    const dropped = COMPILED.replace(":root{--k-color-a:color(display-p3 0 0.52 0.5);", ":root{");
    expect(builtCssProblem(COMPILED, css(dropped))).toBe(
      "--k-color-a is missing from the built CSS, expected color(display-p3 0 0.52 0.5)",
    );
    const moved = COMPILED.replace(
      "@media screen and (color-gamut: p3){",
      ".y{color:red}\n@media screen and (color-gamut: p3){",
    );
    expect(builtCssProblem(COMPILED, css(moved))).toBe(
      "--k-color-a's P3 block does not follow its sRGB block in the built CSS",
    );
  });

  it("keeps a message within 89 units", () => {
    const long = `0 1px 2px ${"rgb(0 0 0 / 0.2), ".repeat(3)}rgb(0 0 0 / 0.2)`;
    const compiled = `:root{--k-shadow-x:${long}}`;
    const m = builtCssProblem(compiled, css(`:root{--k-shadow-x:${long.replaceAll("0.2", "0.3")}}`)) ?? "";
    expect(m.length).toBeLessThanOrEqual(89);
    expect(m).toMatch(/^--k-shadow-x is .+\.\.\. in the built CSS, expected .+\.\.\.$/);
  });
});

describe("cssRules", () => {
  it("reads every at-rule's block and records each one around a rule, outermost first", () => {
    const rules = cssRules(
      "@layer a{@media print{@supports (x:y){@scope (.s){.r{--k-a:1;@container c (width>1px){--k-b:2}}}}}}@font-face{font-family:f}",
    );
    expect(rules).toEqual([
      {
        selector: ".r",
        layers: ["a"],
        media: ["print"],
        wrappers: ["@supports (x:y)", "@scope (.s)"],
        decls: [{ prop: "--k-a", value: "1" }],
      },
      {
        selector: ".r",
        layers: ["a"],
        media: ["print"],
        wrappers: ["@supports (x:y)", "@scope (.s)", "@container c (width>1px)"],
        decls: [{ prop: "--k-b", value: "2" }],
      },
      { selector: "", layers: [], media: [], wrappers: ["@font-face"], decls: [{ prop: "font-family", value: "f" }] },
    ]);
  });
});

describe("lacksColorFunction", () => {
  it("names a target with a browser older than color(), and no other", () => {
    expect(lacksColorFunction(["chrome111", "edge111", "firefox114", "safari16.4", "ios16.4"])).toBe(false);
    expect(lacksColorFunction(["chrome110", "safari16"])).toBe(true);
    expect(lacksColorFunction("firefox112")).toBe(true);
    expect(lacksColorFunction("safari14")).toBe(true);
    expect(lacksColorFunction(["es2020", "esnext"])).toBe(false);
    expect(lacksColorFunction(false)).toBe(false);
    expect(lacksColorFunction(undefined)).toBe(false);
  });
});

describe("sameCssValue", () => {
  it("compares numbers as numbers and spaces beside punctuation as nothing, and nothing else", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 9999 })), {
          minLength: 1,
          maxLength: 4,
        }),
        fc.constantFrom("%", "", "deg"),
        (channels, unit) => {
          const nums = channels.map(([a, b]) => [
            `${a}.${String(b).padStart(4, "0")}${unit}`,
            `${Number(`${a}.${String(b).padStart(4, "0")}`)}${unit}`,
          ]);
          const written = `color(display-p3 ${nums.map((n) => n[0]).join(" ")} / 0.5)`;
          const minified = `color(display-p3 ${nums.map((n) => (n[1] ?? "").replace(/^0\./, ".")).join(" ")}/.5)`;
          expect(sameCssValue(written, minified)).toBe(true);
          expect(sameCssValue(written, written.toUpperCase())).toBe(false);
          expect(sameCssValue(written, written.replace(" / ", ", "))).toBe(false);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
    expect(sameCssValue("#FFFFFF", "#fff")).toBe(false);
    expect(sameCssValue("#FFFFFF", "#ffffff")).toBe(false);
    expect(sameCssValue("0px", "0")).toBe(false);
    expect(sameCssValue('"Inter", serif', '"Inter",serif')).toBe(true);
  });
});
