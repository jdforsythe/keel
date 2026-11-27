// Spec: k.schemes, clause "In a library's own folder whose root `tokens.ts` is `brandTokens` composing a shipped `acme.x` `{ light: '#111111', dark: '#787878' }` on `acme.bg` `'#ffffff'`, a library `Text` with `fg=\"acme.x\" bg=\"acme.bg\"` is one E1804 whose message ends `in dark, needs 4.5:1`."
// Spec: k.schemes, clause "With `brandTokens`, a `SchemeSelect` rendered as `<ui.SchemeSelect ... />` with `import * as ui from '@keel/ui'`, or through an app file re-exporting it, is one E1814, and one rendered in a listed library's file is one E1814 at `node_modules/<name>/<f>`."
// Seed: 1337 (fc.assert below).
// k.schemes Schemes, own folder: "In a library's own folder the schemes are both when a color its shipped object holds is a pair, whatever the root `tokens.ts` writes, else the root `tokens.ts`'s, so every scheme a default is written for is judged."
// ASSUMPTIONS: see library-looks-support.ts. The own folder is the library's files at the root of the files `check()` is given, its root `tokens.ts` composing the shipped object; the artifact is what that file evaluates to, whose own schemes are `['light']`
// (a library's pair never turns an app dark, k.schemes Schemes), so a dark judgement comes from the shipped pair alone. E1814 is judged through the type pass, so the E1814 cases leave `types` on.
import { check } from "@keel/check";
import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import fc from "fast-check";
import { expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { type Files, PACKAGE_JSON, ROOT, SEED, app, atText, packageJson, sourceOf } from "./library-looks-support.ts";
import { manifestFile } from "./module-support.ts";

// ---- #11
const OWN_ROOT = `import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nimport { acmeTokens } from "./src/acmeTokens.ts";\n\nexport const tokens = defineTokens({\n  ...brandTokens,\n  color: { ...brandTokens.color, ...acmeTokens.color },\n});\n`;
const shipped = (x: string): string =>
  `import { defineTokens } from '@keel/ui'\nexport const acmeTokens = defineTokens({ color: { 'acme.x': ${x}, 'acme.bg': '#ffffff' } })\n`;
const textBadge = `import { Text } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return <Text id={\`\${props.id}.text\`} fg="acme.x" bg="acme.bg">x</Text> }\n`;
function own(x: string): Files {
  return [
    { path: "package.json", source: packageJson({ keel: "./src/acmeTokens.ts", default: "./index.js" }) },
    { path: "index.js", source: "export {}\n" },
    manifestFile({ id: "acme", deps: [], exports: ["Badge"] }, "."),
    { path: "src/index.ts", source: "export { default as Badge } from './Badge.tsx'\n" },
    { path: "src/Badge.tsx", source: textBadge },
    { path: "src/acmeTokens.ts", source: shipped(x) },
    { path: "tokens.ts", source: OWN_ROOT },
  ];
}
type Color = string | { light: string; dark: string };
const artifact = (x: Color) =>
  defineTokens({ ...brandTokens, color: { ...brandTokens.color, "acme.x": x, "acme.bg": "#ffffff" } });
const e1804 = (files: Files, x: Color) =>
  check(files, { types: false, artifacts: { tokens: artifact(x) } }).diagnostics.filter((d) => d.code === "E1804");

test(
  "In a library's own folder whose root `tokens.ts` is `brandTokens` composing a shipped `acme.x` `{ light: '#111111', dark: '#787878' }` on `acme.bg` `'#ffffff'`, a library `Text` with `fg=\"acme.x\" bg=\"acme.bg\"` is one E1804 whose message ends `in dark, needs 4.5:1`",
  () => {
    const d = e1804(own("{ light: '#111111', dark: '#787878' }"), { light: "#111111", dark: "#787878" });
    expect(d).toHaveLength(1);
    expect(d[0]?.message.endsWith("in dark, needs 4.5:1")).toBe(true);
    expect(d[0]?.message).toBe('fg "acme.x" on bg "acme.bg" is 4.42:1 in dark, needs 4.5:1');
  },
  CHECK_CASE_BOUND,
);

test(
  "a shipped pair is judged in the scheme where it is low, light or dark, whatever the root `tokens.ts` writes; a shipped string is judged in light only",
  () => {
    fc.assert(
      fc.property(fc.constantFrom("light", "dark"), fc.boolean(), (low, ok) => {
        const fine = ok ? "#111111" : "#787878";
        const pair = low === "dark" ? { light: "#111111", dark: fine } : { light: fine, dark: "#111111" };
        const d = e1804(own(`{ light: '${pair.light}', dark: '${pair.dark}' }`), pair);
        expect(d.length).toBe(ok ? 0 : 1);
        if (!ok) expect(d[0]?.message.endsWith(`in ${low}, needs 4.5:1`)).toBe(true);
      }),
      { seed: SEED, numRuns: 12 },
    );
    const d = e1804(own("'#787878'"), "#787878");
    expect(d.map((x) => x.message.includes("in light"))).toEqual([true]);
  },
  CHECK_CASE_BOUND,
);

// ---- #12
const ONE = defineTokens({ ...brandTokens });
const select = (name: string, id = '"scheme"'): string =>
  `<${name} id=${id} label="Scheme" labels={{ system: 'System', light: 'Light', dark: 'Dark' }} />`;
const MESSAGE = "SchemeSelect needs schemes light and dark; the tokens have light only";
const e1814 = (files: Files) =>
  check(files, { artifacts: { tokens: ONE } }).diagnostics.filter((d) => d.code === "E1814");
const BRAND_TOKENS = `import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`;

test(
  "With `brandTokens`, a `SchemeSelect` rendered as `<ui.SchemeSelect ... />` with `import * as ui from '@keel/ui'` is one E1814",
  () => {
    const source = `import * as ui from '@keel/ui'\nexport default function C() { return ${select("ui.SchemeSelect")} }\n`;
    const d = e1814([
      { path: "C.tsx", source },
      { path: "tokens.ts", source: BRAND_TOKENS },
    ]);
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe(MESSAGE);
    expect(d[0]?.path).toBe("C.tsx");
    expect(d[0]?.fix).toBeUndefined();
  },
  CHECK_CASE_BOUND,
);

test(
  "a `SchemeSelect` rendered through an app file re-exporting it, or imported under another name, is one E1814",
  () => {
    const shapes: { reexport: string; use: string; name: string }[] = [
      {
        reexport: "export { SchemeSelect } from '@keel/ui'\n",
        use: "import { SchemeSelect } from './Choice.tsx'",
        name: "SchemeSelect",
      },
      {
        reexport: "export { SchemeSelect as Picker } from '@keel/ui'\n",
        use: "import { Picker } from './Choice.tsx'",
        name: "Picker",
      },
      {
        reexport: "export * from '@keel/ui'\n",
        use: "import { SchemeSelect } from './Choice.tsx'",
        name: "SchemeSelect",
      },
    ];
    for (const s of shapes) {
      const page = `${s.use}\nexport default function C() { return ${select(s.name)} }\n`;
      const d = e1814([
        { path: "Choice.tsx", source: s.reexport },
        { path: "C.tsx", source: page },
        { path: "tokens.ts", source: BRAND_TOKENS },
      ]);
      expect(
        d.map((x) => x.message),
        s.reexport,
      ).toEqual([MESSAGE]);
    }
  },
  CHECK_CASE_BOUND,
);

test(
  "a `SchemeSelect` rendered in a listed library's file is one E1814 at `node_modules/<name>/<f>`",
  () => {
    const badge = `import { SchemeSelect } from '@keel/ui'\nexport default function Badge(props: { id: string }) { return ${select("SchemeSelect", "{`${props.id}.s`}")} }\n`;
    const files = app(BRAND_TOKENS, [
      { path: `${ROOT}/src/Badge.tsx`, source: badge },
      { path: PACKAGE_JSON, source: packageJson() },
    ]);
    const d = e1814(files);
    expect(d.map((x) => x.path)).toEqual([`${ROOT}/src/Badge.tsx`]);
    expect(d[0]?.message).toBe(MESSAGE);
    expect(atText(sourceOf(files, `${ROOT}/src/Badge.tsx`), "<SchemeSelect", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(
      true,
    );
  },
  CHECK_CASE_BOUND,
);

test(
  "a local component named `SchemeSelect` that is not `@keel/ui`'s is no E1814, since the type pass judges the symbol and not the name",
  () => {
    const source = `function SchemeSelect(props: { id: string }) { return <div id={props.id} /> }\nexport default function C() { return <SchemeSelect id="s" /> }\n`;
    expect(
      e1814([
        { path: "C.tsx", source },
        { path: "tokens.ts", source: BRAND_TOKENS },
      ]),
    ).toEqual([]);
  },
  CHECK_CASE_BOUND,
);
