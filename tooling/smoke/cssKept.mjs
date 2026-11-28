// The k.values Stylesheet invariant in Chromium: the CSS `compileStyles` emits, from `brandTokens` and from tokens
// holding one value of each group's form used by every style prop, parses through `CSSStyleSheet.replaceSync` with
// every emitted rule kept and each rule holding every declaration it was emitted with; and each attack value a review
// found is refused (E1807) before any CSS is emitted; and the grammar's edge cases (`valueEdges`): each refused one is
// refused, each accepted one takes effect by its computed value. Called by values.mjs with its page.
import { brandTokens } from "../../packages/ui/src/brand/brandTokens.ts";
import { TokenSchema } from "../../packages/ui/src/tokens/TokenSchema.ts";
import { compileStyles } from "../../packages/ui/src/css/compileStyles.ts";
import { valueEdges } from "../../packages/ui/src/internal/valueEdges.ts";

/** The CSS property each group's style props write, read back to judge a value's effect. */
const PROPERTY = {
  color: "background-color",
  space: "padding-top",
  size: "width",
  radius: "border-top-left-radius",
  font: "font-family",
  fontSize: "font-size",
  weight: "font-weight",
  shadow: "box-shadow",
  border: "border-top",
  motion: "transition-duration",
};
/** Values written as the property's initial one, whose computed value is that one (k.values Stylesheet). */
const AS_INITIAL = new Set(["0", "normal", "auto", "none"]);

/** One value of each form k.values' table defines, every group used by a style prop. */
const FORMS = {
  color: { fg: "#1A191E", bg: { light: "#FFFFFF", dark: "#111" }, ink: "#0B5CAD" },
  space: { 1: "4px", n: "clamp(4px, 2vw + 4px, 24px)", a: "auto", e: "env(safe-area-inset-top, 4px)" },
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
  { props: { fg: "fg", bg: "bg", p: "1", m: "n", mx: "a", gap: "e", direction: "column" } },
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
  // The grammar's edge cases: each refused case is refused; each accepted one, set through its group's property,
  // reads back non-empty and computes to a value other than the initial one unless written as it.
  const { accepted, refused } = valueEdges();
  const tokensOf = (group, value) => ({ color: { text: "#111111" }, [group]: { a: value } });
  const wrongly = refused.filter(([group, value]) => TokenSchema.parse(tokensOf(group, value)).ok);
  step(
    "each refused edge case of the grammar is refused (form feed, null, quotes, backslash, surrogates among them)",
    wrongly.length === 0 && refused.some(([, v]) => v.includes("\f")),
    `${refused.length} cases, ${wrongly.length} accepted${wrongly.length > 0 ? `: ${JSON.stringify(wrongly[0])}` : ""}`,
  );
  const outOfForm = accepted.filter(([group, value]) => !TokenSchema.parse(tokensOf(group, value)).ok);
  const cases = accepted.filter(([group]) => group !== "breakpoint");
  const effects = await page.evaluate(
    ({ cases, property }) =>
      cases.map(([group, value]) => {
        const prop = property[group];
        const probe = document.createElement("div");
        const plain = document.createElement("div");
        document.body.append(probe, plain);
        probe.style.setProperty(prop, value);
        if (group === "border") plain.style.setProperty("border-top-style", "none");
        const written = probe.style.getPropertyValue(prop);
        const read = prop === "border-top" ? "border-top-style" : prop;
        const got = getComputedStyle(probe).getPropertyValue(read);
        const initial = getComputedStyle(plain).getPropertyValue(read);
        probe.remove();
        plain.remove();
        return { group, value, written, changed: got !== initial };
      }),
    { cases, property: PROPERTY },
  );
  const media = await page.evaluate(
    (values) => values.map((v) => window.matchMedia(`(min-width: ${v})`).media !== "not all"),
    accepted.filter(([g]) => g === "breakpoint").map(([, v]) => v),
  );
  const noEffect = effects.filter(
    (e) => e.written === "" || (!e.changed && !AS_INITIAL.has(e.value) && !e.value.includes("env(")),
  );
  step(
    "each accepted edge case of the grammar takes effect in Chromium (read back from style, computed off the initial value)",
    outOfForm.length === 0 && noEffect.length === 0 && media.every(Boolean),
    `${accepted.length} cases, ${outOfForm.length} out of form, ${noEffect.length} with no effect${noEffect.length > 0 ? `: ${JSON.stringify(noEffect[0])}` : ""}`,
  );
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
