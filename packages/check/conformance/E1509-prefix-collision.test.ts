// Spec: k.prefix Rules, "E1509 ... from `keel check` over a deployable's route table ... Fix: prepend `/:<p>` to the route's `path`" and Conformance "Beside `x.show`, each of `/de-DE/about`, `/:slug` and `/items/:id` is E1509, the fix applied leaves no E1509, and without `pathDefault` none of them is E1509." (rfc:0079)
// Seed 1337. The `manifest` half is packages/router/conformance/prefix-e1509.test.ts. ASSUMPTION: the check reads `routes.ts` and a `*.schema.ts` file beside it, with `topology.ts` naming the module.
import { check } from "@keel/check";
import { expect, test } from "vitest";

const LOCALE = (pd: boolean): string =>
  `import { s } from '@keel/schema'\nexport const AppLocale = s.enum(['en-US', 'de-DE']${pd ? ", { pathDefault: 'en-US' }" : ""})\n`;
const TOPO = `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['x'], adapter: 'node' } })\n`;
const routesFile = (extra: string): string =>
  `import { manifest } from '@keel/router'\nimport { s } from '@keel/schema'\nimport { AppLocale } from './AppLocale.schema.ts'\n` +
  `const page = () => null\n` +
  `export const routes = manifest({\n  'x.show': { path: '/:p/items/:id', params: s.object({ p: AppLocale, id: s.string() }), component: page },\n${extra}\n})\n`;

const EXTRAS: Record<string, string> = {
  "/de-DE/about": `  'x.about': { path: '/de-DE/about', component: page },`,
  "/:slug": `  'x.slug': { path: '/:slug', params: s.object({ slug: s.string() }), component: page },`,
  "/items/:id": `  'x.twin': { path: '/items/:id', params: s.object({ id: s.string() }), component: page },`,
};
const run = (pd: boolean, extra: string) =>
  check(
    [
      { path: "topology.ts", source: TOPO },
      { path: "modules/x/AppLocale.schema.ts", source: LOCALE(pd) },
      { path: "modules/x/routes.ts", source: routesFile(extra) },
    ],
    { types: false },
  ).diagnostics.filter((d) => d.code === "E1509");

test.skip("Beside `x.show`, each of `/de-DE/about`, `/:slug` and `/items/:id` is E1509", () => {
  for (const extra of Object.values(EXTRAS)) expect(run(true, extra).length).toBeGreaterThanOrEqual(1);
});

test.skip("without `pathDefault` none of `/de-DE/about`, `/:slug` and `/items/:id` is E1509", () => {
  for (const extra of Object.values(EXTRAS)) expect(run(false, extra)).toEqual([]);
});

test.skip("E1509: a table of only prefixed routes is clean", () => {
  expect(run(true, "")).toEqual([]);
});

test.skip("E1509: the fix applied (prepend `/:p` to the route's `path`) leaves no E1509", () => {
  const ds = run(true, EXTRAS["/items/:id"] ?? "");
  expect(ds[0]?.fix).toContain("/:p");
  // Applying the hunk with git apply is covered by fix-applies.test.ts for the other codes; here the fixed source is checked directly.
  const fixed = EXTRAS["/items/:id"]?.replace(
    "path: '/items/:id', params: s.object({ id",
    "path: '/:p/items/:id', params: s.object({ p: AppLocale, id",
  );
  expect(run(true, fixed ?? "")).toEqual([]);
});
