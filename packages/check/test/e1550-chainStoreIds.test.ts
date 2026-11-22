// k.server Rules E1550 through imports and a binding: a frame layout in module `app` whose loader names `householdStores`
// (imported from module `setup`), and a `setup` page bound under it whose loader names `setupStores`, which spreads
// `householdStores()`, are one E1550; a page bound under no layout, or naming the frame's factory, is none. Seed: none.
import { expect, test } from "vitest";
import { check } from "../src/check.ts";

const mod = (id: string, deps: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: ['householdStores'] } })\n`;
const files = (pageStores: string, layout: string) => [
  { path: "modules/app/module.ts", source: mod("app", ["setup"]) },
  { path: "modules/setup/module.ts", source: mod("setup", []) },
  {
    path: "modules/app/app.contract.ts",
    source: `import { contract } from '@keel/router/contract'\nexport const app = contract('app', { 'app.frame': { layout: true } })\n`,
  },
  {
    path: "modules/setup/setup.contract.ts",
    source: `import { contract } from '@keel/router/contract'\nexport const setup = contract('setup', { 'setup.form': { path: '/setup' }, 'setup.side': { layout: true } })\n`,
  },
  {
    path: "modules/setup/householdStores.ts",
    source: `import { s } from '@keel/schema'\nimport { store } from '@keel/store'\nexport const householdStores = () => ({ household: store(s.object({}), {}, { id: 'setup.household' }) })\n`,
  },
  {
    path: "modules/setup/setupStores.ts",
    source: `import { s } from '@keel/schema'\nimport { store } from '@keel/store'\nimport { householdStores } from './householdStores.ts'\nexport function setupStores() {\n  return { ...householdStores(), runs: store(s.object({}), {}, { id: 'setup.runs' }) }\n}\n`,
  },
  {
    path: "modules/app/loadFrame.server.ts",
    source: `import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { householdStores } from '../setup/householdStores.ts'\nimport { app } from './app.contract.ts'\nexport const loadFrame = loader(app, 'app.frame', { output: s.object({}), stores: householdStores }, async () => ok({}))\n`,
  },
  {
    path: "modules/setup/loadSetup.server.ts",
    source: `import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { householdStores } from './householdStores.ts'\nimport { setupStores } from './setupStores.ts'\nimport { setup } from './setup.contract.ts'\nexport const loadSetup = loader(setup, 'setup.form', { output: s.object({}), stores: ${pageStores} }, async () => ok({}))\n`,
  },
  {
    path: "modules/setup/routes.ts",
    source: `import { manifest } from '@keel/router'\nimport { setup } from './setup.contract.ts'\nimport { loadSetup } from './loadSetup.server.ts'\nconst C = () => null\nexport const routes = manifest(setup, { 'setup.form': { component: C, loader: loadSetup${layout} }, 'setup.side': { component: C } })\n`,
  },
];
const found = (pageStores: string, layout: string) =>
  check(files(pageStores, layout), { types: false }).diagnostics.filter((d) => d.code === "E1550");

test("an imported factory spreading the frame's, under the frame by its binding, is one E1550 naming both, the id and the frame", () => {
  const d = found("setupStores", ", layout: 'app.frame'");
  expect(d.map((x) => x.path)).toEqual(["modules/setup/loadSetup.server.ts"]);
  expect(d[0]?.message).toMatch(
    /^stores: setupStores and householdStores \(app\.frame\) both create store setup\.household;/,
  );
});

test("the page naming the frame's factory, or bound under no layout, is none", () => {
  expect(found("householdStores", ", layout: 'app.frame'")).toEqual([]);
  expect(found("setupStores", "")).toEqual([]);
});
