// k.gamut CSS: `keel build` verifies the built CSS holds, for each color, a value check judged (E1819).
import { transform } from "esbuild";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { builtCssProblem } from "../src/internal/builtCssProblem.ts";
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
  '@media print{\n:root{color-scheme:light;print-color-adjust:exact;--k-color-a:rgb(0 133 127)}\n}',
  "}",
  '@layer keel.base{\nbody{color:var(--k-color-a)}\n}',
  ".k-a{color:var(--k-color-a)}",
  "",
].join("\n");

const APP = ".card{color:#fff;background:rgb(1,2,3)}@supports (display:grid){.grid{display:grid}}";

describe("builtCssProblem", () => {
  it("passes the compiled CSS, esbuild's minified form of it, the app's own CSS beside it, and no CSS", async () => {
    expect(builtCssProblem(COMPILED, [COMPILED])).toBeUndefined();
    const min = (await transform(COMPILED + APP, { loader: "css", minify: true })).code;
    expect(min).toContain("--k-motion-fast:.12s");
    expect(builtCssProblem(COMPILED, [min])).toBeUndefined();
    expect(builtCssProblem(COMPILED, [])).toBeUndefined();
    expect(builtCssProblem(COMPILED, [APP])).toBeUndefined();
  });

  it("names the custom property, the value found and the value expected", () => {
    const hex = COMPILED.replace("--k-color-a:rgb(0 133 127);", "--k-color-a:#00857f;");
    expect(builtCssProblem(COMPILED, [hex])).toBe("--k-color-a is #00857f in the built CSS, expected rgb(0 133 127)");
    const shadow = COMPILED.replace("rgb(0 0 0 / 0.2)", "#0003");
    expect(builtCssProblem(COMPILED, [shadow])).toBe(
      "--k-shadow-x is 0 1px 2px #0003 in the built CSS, expected 0 1px 2px rgb(0 0 0 / 0.2)",
    );
    const comma = COMPILED.replace("rgb(0 167 4 / 0.95)", "rgb(0,167,4,.95)");
    expect(builtCssProblem(COMPILED, [comma])).toMatch(/^--k-overlay-s is rgb\(0,167,4,\.95\) in the built CSS/);
  });

  it("fails a declaration under @supports, one where Keel declares none, a missing one, and a P3 block out of place", () => {
    const supports = `${COMPILED}@supports (color:color(display-p3 0 0 0)){:root{--k-color-a:color(display-p3 0 0.52 0.5)}}`;
    expect(builtCssProblem(COMPILED, [supports])).toBe(
      "--k-color-a is color(display-p3 0 0.52... under @supports in the built CSS, expected none",
    );
    expect(builtCssProblem(COMPILED, [`${COMPILED}.x{--k-color-b:#000000}`])).toBe(
      "--k-color-b is #000000 in the built CSS where Keel declares none",
    );
    const dropped = COMPILED.replace(":root{--k-color-a:color(display-p3 0 0.52 0.5);", ":root{");
    expect(builtCssProblem(COMPILED, [dropped])).toBe(
      "--k-color-a is missing from the built CSS, expected color(display-p3 0 0.52 0.5)",
    );
    const moved = COMPILED.replace("@media screen and (color-gamut: p3){", ".y{color:red}\n@media screen and (color-gamut: p3){");
    expect(builtCssProblem(COMPILED, [moved])).toBe(
      "--k-color-a's P3 block does not follow its sRGB block in the built CSS",
    );
  });

  it("keeps a message within 89 units", () => {
    const long = `0 1px 2px ${"rgb(0 0 0 / 0.2), ".repeat(3)}rgb(0 0 0 / 0.2)`;
    const compiled = `:root{--k-shadow-x:${long}}`;
    const m = builtCssProblem(compiled, [`:root{--k-shadow-x:${long.replaceAll("0.2", "0.3")}}`]) ?? "";
    expect(m.length).toBeLessThanOrEqual(89);
    expect(m).toMatch(/^--k-shadow-x is .+\.\.\. in the built CSS, expected .+\.\.\.$/);
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
          const nums = channels.map(([a, b]) => [`${a}.${String(b).padStart(4, "0")}${unit}`, `${Number(`${a}.${String(b).padStart(4, "0")}`)}${unit}`]);
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
