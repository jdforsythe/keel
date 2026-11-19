// Spec: k.compat, Surface "`keel build` writes `.keel/surface.json`, a k.compiler artifact (E1005): for each route of the app its `module`, `path`, `params`, `search`, its GET answer (its loader's `output`; none without a loader) and, per action method, its `input` and answer (its `output` on an API route, else `Href | null`); every route's error answer is a KeelError `{ code, message, data }`; for each `service({ module })` call its calling module, `module`, and each endpoint's method, `path`, `params`, `query`, `body`, `output` and `errors`; for each store a `stores` factory creates, its `id`, state schema and each transaction's payload schema (the build runs each factory once on a sim ctx)."
// Spec: k.compat, Conformance "A POST endpoint with `output: s.string().nullable()` to an API route whose action's `output` is `s.object({ n: s.int() })` is one E1561; with that `output`, none."
// Spec: k.compat, Rules "E1562 a route change that a base endpoint in another deployable refuses, at the route's schema, naming the endpoint; fix when the change is one added required object field: make it optional"
// Seed: 1337. Real binary over a temp project (see compat-support.ts).
// The surface's `answer` of an action is read as JSON text: the spec fixes that it is the output's JSON Schema (API route) or `Href | null` (page) and not the wrapper around it,
// so the checks look for the schema's own marks (`integer` and the field name; `string` and `null`) and not for an exact tree.
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import {
  SEED,
  baseSurface,
  buildAndCheck,
  cleanup,
  diags,
  keel,
  materialize,
  project,
  readText,
  write,
} from "./compat-support.ts";
import type { Tree } from "./compat-support.ts";

const SLOW = 180_000;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const fresh = (files: Tree): string => {
  const dir = materialize(files);
  dirs.push(dir);
  return dir;
};

/** Module `a` calls the API route `y.save` (`POST /y/save`, action `output` given) through a `module` endpoint with `endpointOutput`. */
function apiProject(output: string, value: string, endpointOutput: string, split = true): Tree {
  const base = project({ split });
  return {
    ...base,
    "modules/y/save.server.ts": [
      "import { action } from '@keel/router'",
      "import { ok, s } from '@keel/schema'",
      `export const save = action({ input: s.object({ name: s.string() }), output: ${output} }, async () => ok(${value}))`,
      "",
    ].join("\n"),
    "modules/y/routes.ts": [
      "import { manifest } from '@keel/router'",
      "import { save } from './save.server.ts'",
      "export const routes = manifest({ 'y.save': { api: true, path: '/y/save' } })",
      "routes.actions({ 'y.save': { POST: save } })",
      "",
    ].join("\n"),
    "modules/a/api.ts": [
      "import { s } from '@keel/schema'",
      "import { endpoints, service } from '@keel/services'",
      "export const api = service({ module: 'y', schema: endpoints({",
      `  save: { method: 'POST', path: '/y/save', body: s.object({ name: s.string() }), output: ${endpointOutput} },`,
      "}) })",
      "",
    ].join("\n"),
  };
}
const answerOf = (dir: string): string => {
  const file: unknown = JSON.parse(readText(dir, ".keel/surface.json"));
  const route = (v: unknown, k: string): unknown =>
    typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined;
  const post = route(route(route(route(route(file, "data"), "routes"), "y.save"), "actions"), "POST");
  return JSON.stringify(route(post, "answer"));
};

test(
  "`keel build` of a fixture whose API action declares `output: s.object({ n: s.int() })` records that answer as the output's JSON Schema in `.keel/surface.json`; a page action's answer is `Href | null`.",
  () => {
    fc.assert(
      fc.property(fc.constantFrom("n", "count", "total"), (name) => {
        const out = `s.object({ ${name}: s.int() })`;
        const api = fresh(apiProject(out, `{ ${name}: 1 }`, out));
        expect(keel(api, ["build"]).status).toBe(0);
        const answer = answerOf(api);
        expect(answer).toContain(`"${name}"`);
        expect(answer).toContain("integer");
        expect(answer).not.toContain('"null"');

        const page = fresh(project());
        expect(keel(page, ["build"]).status).toBe(0);
        const pageAnswer = answerOf(page);
        expect(pageAnswer).toContain("string");
        expect(pageAnswer).toContain("null");
        expect(pageAnswer).not.toContain("integer");
        expect(pageAnswer).not.toContain(`"${name}"`);
      }),
      { seed: SEED, numRuns: 3 },
    );
  },
  SLOW,
);

test(
  "A POST endpoint with `output: s.string().nullable()` to an API route whose action's `output` is `s.object({ n: s.int() })` is one E1561; with that `output`, none.",
  () => {
    const out = "s.object({ n: s.int() })";
    const bad = diags(buildAndCheck(fresh(apiProject(out, "{ n: 1 }", "s.string().nullable()"))), "E1561");
    expect(bad).toHaveLength(1);
    expect(bad[0]?.path).toBe("modules/a/api.ts");
    expect(diags(buildAndCheck(fresh(apiProject(out, "{ n: 1 }", out))), "E1561")).toEqual([]);
  },
  SLOW,
);

test(
  "With a base whose answer was `{ n }` and a current `output` without `n`, and the caller in another deployable, is one E1562; in one deployable none.",
  () => {
    const before = "s.object({ n: s.int() })";
    const after = "s.object({ m: s.int() })";
    const { dir, base } = baseSurface(apiProject(before, "{ n: 1 }", before));
    dirs.push(dir);
    write(dir, apiProject(after, "{ m: 1 }", after));
    const found = diags(buildAndCheck(dir, base), "E1562");
    expect(found).toHaveLength(1);
    expect(found[0]?.fix ?? null).toBeNull();

    const same = baseSurface(apiProject(before, "{ n: 1 }", before, false));
    dirs.push(same.dir);
    write(same.dir, apiProject(after, "{ m: 1 }", after, false));
    expect(diags(buildAndCheck(same.dir, same.base), "E1562")).toEqual([]);
  },
  SLOW,
);
