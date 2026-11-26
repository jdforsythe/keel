// The k.values Stylesheet invariant in Chromium: the CSS `compileStyles` emits, from `brandTokens` and from tokens
// holding one value of each group's form used by every style prop, parses through `CSSStyleSheet.replaceSync` with
// every emitted rule kept and each rule holding every declaration it was emitted with; and each attack value a review
// found is refused (E1807) before any CSS is emitted. Called by brand.mjs with its page.
import { brandTokens } from "../../packages/ui/src/brand/brandTokens.ts";
import { compileStyles } from "../../packages/ui/src/css/compileStyles.ts";

/** One value of each form k.values' table defines, every group used by a style prop. */
const FORMS = {
  color: { fg: "#1A191E", bg: { light: "#FFFFFF", dark: "#111" }, ink: "#0B5CAD" },
  space: { 1: "4px", n: "-2rem", a: "auto" },
  size: { w: "50%", fit: "fit-content", min: "min-content" },
  radius: { r: "0.25rem" },
  font: { f: "'Inter var', \"Helvetica Neue\", sans-serif" },
  fontSize: { s: "1.5rem" },
  weight: { w: "650", b: "bold" },
  shadow: { s: "inset 0 1px 2px #000000, 0 0 4px var(--k-color-ink)", n: "none" },
  border: { b: "1px dashed var(--k-color-ink)", z: "0", h: "2px solid #ccc" },
  breakpoint: { md: "48em" },
  motion: { fast: "0.2s" },
  schemes: ["light", "dark"],
};
const FORM_USAGES = [
  { props: { fg: "fg", bg: "bg", p: "1", m: "n", gap: "a", direction: "column" } },
  { props: { w: "w", h: "fit", radius: "r", font: "f", fontSize: "s", weight: "w" } },
  { props: { shadow: "s", border: "b" }, breakpoint: "md" },
  { props: { border: "h", weight: "b", shadow: "n" }, state: "hover" },
];
const BRAND_USAGES = [
  { props: { fg: "text", bg: "card", p: "3", border: "hairline", font: "mono", fontSize: "sm", weight: "medium" } },
  { props: { direction: "row", gap: "2" }, breakpoint: "md" },
  { props: { bg: "accent" }, state: "focusVisible" },
  { look: "primary", props: {} },
];
/** The values the review broke the stylesheet with. */
const ATTACKS = [
  { font: { a: '"Inter var, sans-serif' } },
  { color: { a: '"oops' } },
  { color: { a: "rgb(1,2,3" } },
  { color: { a: "red\\" } },
  { color: { a: { light: "#111", dark: "#eee;}" } } },
  { size: { a: "url(x.png)" } },
  { space: { a: "1px !important" } },
  { border: { a: "1px solid var(--x)" } },
];

/** The emitted rules, read from the compiler's own layout (one rule a line, a block's opener ending its line). */
function emitted(css) {
  const rules = [];
  for (const line of css.split("\n")) {
    if (line.endsWith("{")) rules.push({ block: line.slice(0, -1) });
    else if (line.includes("{") && line.endsWith("}")) {
      const at = line.indexOf("{");
      const decls = line
        .slice(at + 1, -1)
        .split(";")
        .filter((d) => d !== "")
        .map((d) => d.slice(0, d.indexOf(":")));
      rules.push({ selector: line.slice(0, at), decls });
    }
  }
  return rules;
}

/** The steps: each sheet kept whole in Chromium, and each attack refused before emission. */
export async function cssKept(page, step) {
  const brandCss = compileStyles({ tokens: brandTokens, usages: BRAND_USAGES }).css;
  // The control: an unclosed string in one rule, as the review's font value wrote, loses rules, and the step says so.
  const broken = brandCss.replace("--k-font-serif:", '--k-font-serif:"');
  for (const [name, css, keep] of [
    ["brandTokens", brandCss, true],
    ["one value of each form", compileStyles({ tokens: FORMS, usages: FORM_USAGES }).css, true],
    ["a sheet broken by an unclosed quote (the control)", broken, false],
  ]) {
    const want = emitted(css);
    const got = await page.evaluate((text) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      const out = [];
      const walk = (list) => {
        for (const r of list) {
          if ("selectorText" in r) {
            const names = [];
            for (let i = 0; i < r.style.length; i++) names.push(r.style.item(i));
            out.push({ selector: r.selectorText, style: r.style.cssText, names });
          } else out.push({ block: true });
          if ("cssRules" in r && r.cssRules !== undefined && !("selectorText" in r)) walk(r.cssRules);
        }
      };
      walk(sheet.cssRules);
      return out;
    }, css);
    const styleRules = want.filter((r) => r.selector !== undefined);
    const kept = got.filter((r) => r.selector !== undefined);
    const lost = styleRules.filter((r, i) => {
      const k = kept[i];
      if (k === undefined) return true;
      return r.decls.some((d) => !(k.names.includes(d) || k.style.includes(`${d}:`)));
    });
    const whole = got.length === want.length && lost.length === 0;
    step(
      keep ? `Chromium keeps every rule compiled from ${name}` : `Chromium drops rules of ${name}`,
      whole === keep,
      `${got.length}/${want.length} rules, ${lost.length} short of a declaration`,
    );
  }
  const passed = ATTACKS.filter((tokens) => {
    try {
      compileStyles({ tokens, usages: [] });
      return true;
    } catch (e) {
      return e?.code !== "E1807";
    }
  });
  step(
    "each attack value is refused (E1807) before any CSS is emitted",
    passed.length === 0,
    `${passed.length} emitted`,
  );
}
