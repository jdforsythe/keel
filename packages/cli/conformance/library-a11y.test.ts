// k.library, In an app, the clause on what a reader of an artifact judges, and Guarantees, quoted whole:
// In an app (compiler): "The compiler resolves imports with the `keel` condition on every surface (dev, build, test) and transforms a library's files as the app's, read at `modules/<id>/<f>`: JSX, element ids, and style props into the app's CSS file against the app's `tokens.ts`; the `.keel/` artifacts derive from a library's files at those paths as from the app's, and E1005 compares them over the same files, so a reader of an artifact (E1702, the inspector) judges a library's element as an app's. A linked library's imports resolve from its real folder, as Node's do, so the kernel packages it imports must resolve there to the app's (one workspace install)."
// Guarantees: "**Guarantees.** Installing a library weakens none of the app's checks, since each runs over the library's files as over the app's: personal data and secrets (k.privacy, k.reveal, k.leave; a library's exported schemas are read as a package's, E1111), the content security policy (E1570, E1571, E1803; a library declares no origin, the app's `topology.ts` does, k.origins), accessibility (k.a11y; `keel test` audits the app routes that render library components), host elements and host code (k.host-element, k.host-code), internal entries (E1576, k.parity Rules) and detached scopes (E1207, k.parity By kind)."
// k.a11y Rules: "E1802 missing or blank a11y-required prop · E1804 text below its contrast threshold (static and render) · ..." and k.testing Rules E1703 "axe violation in a harness render".
// Seed: 1337 (no generated input). Binary runs: 2 (one `keel check` and one `keel test` over one project holding each element in a library component and, as the control, in an app module of the same text).
// ASSUMPTIONS (spec silent): the three elements are a `Text` with `fg` 3.45:1 on its `Box`'s `bg` (a failing contrast pair: E1804 in `keel check` and in a render), an `Input` with a blank `label` (an unnamed control: E1802
// in `keel check`, E1703 rule `label` in a render) and a `Host` with no `label` (an unlabelled host element: E1802, E1703 rule `role-img-alt`); a render of an app component rendering the library's gets the app's tokens as
// `artifacts: { tokens }` (a11y-ledger-claims.test.ts); "exactly as in an app module" is: the library's report at the library's path matches the app twin's at its own, and each failing render reports the code
// and the message of the app twin's, the wrapper's id and the test's name aside. A failure prints as a `keel test` record whose message holds the element's id; the wrapper of the library's component renders it as `shop.lib`, the app twin's as `shop.app`, and the messages are compared with those aside.
import { afterAll, beforeAll, expect, test } from "vitest";
import { LIB, NAME, type Rec, type Tree, cleanup, keel, library, materialize, siteTree } from "./library-support.ts";

const KINDS = [
  {
    name: "Contrast",
    what: "a failing contrast pair",
    staticCode: "E1804",
    renderCode: "E1804",
    el: '<Box id={`${props.id}.b`} bg="bg"><Text id={`${props.id}.t`} fg="fg">hello</Text></Box>',
    sub: "t",
  },
  {
    name: "Unnamed",
    what: "an unnamed control",
    staticCode: "E1802",
    renderCode: "E1703",
    el: '<Input id={`${props.id}.in`} label=" " autocomplete="off" />',
    sub: "in",
  },
  {
    name: "Hosted",
    what: "an unlabelled host element",
    staticCode: "E1802",
    renderCode: "E1703",
    el: "<Host id={`${props.id}.h`} role=\"img\" input={In} value={{ n: 1 }} code={() => import('./chart.ts').then((m) => m.chart)} />",
    sub: "h",
  },
] as const;

const IN_SCHEMA = "import { s } from '@keel/schema'\nexport const In = s.object({ n: s.number() })\n";
const CHART = "export const chart = { mount: () => ({}), update: () => {}, dispose: () => {} }\n";
const component = (name: string, el: string): string =>
  `import { Box, Text, Input, Host } from '@keel/ui'\nimport { In } from './In.schema.ts'\n\nvoid [Box, Text, Input, Host, In]\nexport default function ${name}(props: { id: string }) {\n  return ${el}\n}\n`;
// The fixture test's environment line is joined from two parts so vitest does not read it as this file's own.
const ENV = ["// @vitest", "environment happy-dom"].join("-");

const libFiles: Tree = { "src/In.schema.ts": IN_SCHEMA, "src/chart.ts": CHART };
const appFiles: Tree = { "modules/shop/In.schema.ts": IN_SCHEMA, "modules/shop/chart.ts": CHART };
for (const k of KINDS) {
  libFiles[`src/${k.name}.tsx`] = component(k.name, k.el);
  appFiles[`modules/shop/${k.name}.tsx`] = component(k.name, k.el);
  appFiles[`modules/shop/WrapLib${k.name}.tsx`] =
    `import { ${k.name} } from '${NAME}'\nexport default function WrapLib${k.name}() {\n  return <${k.name} id="shop.lib" />\n}\n`;
  appFiles[`modules/shop/WrapApp${k.name}.tsx`] =
    `import ${k.name} from './${k.name}.tsx'\nexport default function WrapApp${k.name}() {\n  return <${k.name} id="shop.app" />\n}\n`;
}
const names = KINDS.map((k) => k.name);
const TEST = `${ENV}
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { it } from "vitest";
import { tokens } from "../tokens.ts";
${names.map((n) => `import WrapLib${n} from "../modules/shop/WrapLib${n}.tsx";\nimport WrapApp${n} from "../modules/shop/WrapApp${n}.tsx";`).join("\n")}

const run = (C: () => Node): void => {
  const t = render(Object.assign(C, { Props: s.object({}) }), { props: {}, artifacts: { tokens }, ctx: createCtx({ mode: "sim", seed: 1337 }) });
  t.dispose();
};
${names.flatMap((n) => [`it("lib-${n}", () => run(WrapLib${n}));`, `it("app-${n}", () => run(WrapApp${n}));`]).join("\n")}
`;
const TOKENS =
  'import { defineTokens } from "@keel/ui";\nexport const tokens = defineTokens({ color: { fg: "#8a8a8a", bg: "#ffffff" }, space: { 1: "4px", 2: "8px", 3: "16px" } });\n';

/** The installed library with the three components and `src/index.ts` exporting them beside `Badge`. */
const libraryWith = (): Tree => {
  const lib = library({ files: libFiles });
  const m = `${LIB}/module.ts`;
  lib[m] = (lib[m] ?? "").replace("['Badge']", `['Badge', ${names.map((n) => `'${n}'`).join(", ")}]`);
  lib[`${LIB}/src/index.ts`] =
    `export { default as Badge } from './Badge.tsx'\n${names.map((n) => `export { default as ${n} } from './${n}.tsx'`).join("\n")}\n`;
  return lib;
};

let dir = "";
let checked: Rec[] = [];
let tested: Rec[] = [];
beforeAll(() => {
  dir = materialize({ ...siteTree([libraryWith()]), "tokens.ts": TOKENS, ...appFiles, "test/a11y.test.ts": TEST });
  checked = keel(dir, ["check"]).records.filter((x) => x.kind === "diag");
  tested = keel(dir, ["test"]).records.filter((x) => x.kind === "diag");
}, 600_000);
afterAll(() => cleanup(dir));

for (const k of KINDS) {
  test(`${k.what} in a library component is reported ${k.staticCode} by \`keel check\` at the library's path with no fix, as the same element in an app module is at its own`, () => {
    const inLib = checked.filter((x) => x.code === k.staticCode && x.path === `${LIB}/src/${k.name}.tsx`);
    const inApp = checked.filter((x) => x.code === k.staticCode && x.path === `modules/shop/${k.name}.tsx`);
    expect(inLib.length).toBeGreaterThanOrEqual(1);
    expect(inLib.length).toBe(inApp.length);
    for (const d of inLib) expect(d.fix).toBeUndefined();
  }, 600_000);

  const text = (prefix: "lib" | "app"): string =>
    tested
      .filter((x) => typeof x.message === "string" && x.message.includes(`shop.${prefix}.${k.sub}`))
      .filter((x) => x.code === k.renderCode || String(x.message).includes(k.renderCode))
      .map((x) =>
        String(x.message).replaceAll(`shop.${prefix}.`, "shop.<wrap>.").replaceAll(`${prefix}-${k.name}`, "<test>"),
      )
      .join("\n");

  test(`${k.what} in a library component fails its render under \`keel test\` with ${k.renderCode} naming its element id, as the same element in an app module does`, () => {
    const inApp = text("app");
    expect(inApp, "the app twin fails with the code").not.toBe("");
    expect(inApp).toContain(`shop.<wrap>.${k.sub}`);
    expect(text("lib")).toBe(inApp);
  }, 600_000);
}
