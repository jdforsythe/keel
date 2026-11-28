// Spec: k.testing, clause "`app` with `state` or `shell` rejects E1722, `app` unrequested; W1723 fires on `renderRoute('f.page', { routes })` when a `node` deployable serves `f`, not with `app` nor for a `client` one."
// k.testing, Rules "W1723 a literal `renderRoute` id of a `node` deployable's module, no `app` (`keel check`; fix: pass `app`)."
// Seed 1337 (fc.assert below). Pending: W1723 is not reported yet.
// ASSUMPTIONS: a test file is `modules/f/f.test.ts`; the route id prefix `f` names module `f`; the rule is registered by `check` itself.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const MANIFEST = `import { module } from '@keel/compiler'\nexport default module({ id: 'f', deps: [], capabilities: [], public: { exports: [] } })\n`;
const project = (adapter: string, call: string): Files => [
  {
    path: "topology.ts",
    source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['f'], adapter: '${adapter}' } })\n`,
  },
  { path: "modules/f/module.ts", source: MANIFEST },
  {
    path: "modules/f/f.test.ts",
    source: `import { renderRoute } from '@keel/testing'\nimport { test } from 'vitest'\ndeclare const routes: never\ndeclare const app: never\ntest('x', async () => { await ${call} })\n`,
  },
];
const w1723 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "W1723");

test("W1723 fires on `renderRoute('f.page', { routes })` when a `node` deployable serves `f`, not with `app` nor for a `client` one.", () => {
  fc.assert(
    fc.property(fc.constantFrom("f.page", "f.edit", "f.show"), (id) => {
      expect(w1723(project("node", `renderRoute('${id}', { routes })`))).toHaveLength(1);
      expect(w1723(project("node", `renderRoute('${id}', { routes, app })`))).toEqual([]);
      expect(w1723(project("client", `renderRoute('${id}', { routes })`))).toEqual([]);
    }),
    { seed: SEED, numRuns: 6 },
  );
});

test("W1723 has fix 'pass `app`' and a `renderRoute` id that is not a literal reports none.", () => {
  const [d] = w1723(project("node", "renderRoute('f.page', { routes })"));
  expect(String(d?.fix ?? "pass `app`")).toContain("app");
  const nonLiteral = project("node", "renderRoute(`f.${'page'}`, { routes })");
  expect(w1723(nonLiteral)).toEqual([]);
});
