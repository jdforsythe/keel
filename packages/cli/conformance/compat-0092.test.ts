// Spec: k.compat, clause "An open `{ a?: string }` does not accept an open `{}` and accepts a closed `{}`."
// Spec: k.compat, clause "A GET endpoint to a route with no loader is one E1561."
// Spec: k.compat, clause "`keel check --base` naming a missing file is one W1568 and exits 0; with `topology.ts` unreadable, a base endpoint the current route refuses is E1562."
// Spec: k.compat, clause "`service({ base: origin, schema })` with an endpoint that a route of app module `b` serves is one E1567 naming `b`; with `base: 'https://api.example.com'` none."
// Spec: k.compat, clause "An endpoints file that throws is one E1006 from `keel build`, which exits 1."
// Seed 1337. Real binary over a temp project (see compat-support.ts).
// Rules E1561, E1562, E1567, W1568, E1006 (k.compiler). Each clause is one test named with its text.
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
  write,
} from "./compat-support.ts";

/** Property runs spawn several `keel build` and `keel check` processes each. */
const SLOW = 120_000;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const fresh = (files: Record<string, string>): string => {
  const dir = materialize(files);
  dirs.push(dir);
  return dir;
};

test(
  "An open `{ a?: string }` does not accept an open `{}` and accepts a closed `{}`.",
  () => {
    const input = "s.object({ a: s.string().optional() })";
    const open = diags(buildAndCheck(fresh(project({ input, body: "s.object({})" }))), "E1561");
    expect(open).toHaveLength(1);
    expect(open[0]?.path).toBe("modules/a/api.ts");
    const closed = diags(buildAndCheck(fresh(project({ input, body: "s.object({}, { closed: true })" }))), "E1561");
    expect(closed).toEqual([]);
  },
  SLOW,
);

test(
  "A GET endpoint to a route with no loader is one E1561.",
  () => {
    const withLoader = project();
    const noLoader = {
      ...withLoader,
      "modules/y/routes.ts":
        "import { action, manifest } from '@keel/router'\nimport { ok, s } from '@keel/schema'\n" +
        "const Page = () => null\n" +
        "const save = action({ input: s.object({ name: s.string() }) }, async () => ok(null))\n" +
        "export const routes = manifest({ 'y.save': { path: '/y/save', component: Page } })\n" +
        "routes.actions({ 'y.save': { POST: save } })\n",
    };
    expect(diags(buildAndCheck(fresh(withLoader)), "E1561")).toEqual([]);
    const found = diags(buildAndCheck(fresh(noLoader)), "E1561");
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("modules/a/api.ts");
  },
  SLOW,
);

test(
  "`keel check --base` naming a missing file is one W1568 and exits 0; with `topology.ts` unreadable, a base endpoint the current route refuses is E1562.",
  () => {
    fc.assert(
      fc.property(fc.constantFrom("note", "qty", "label"), (f) => {
        const NAME = "s.object({ name: s.string() })";
        const { dir, base } = baseSurface(project({ input: NAME, split: false }));
        dirs.push(dir);
        write(dir, project({ input: `s.object({ name: s.string(), ${f}: s.string() })`, body: NAME, split: false }));
        expect(keel(dir, ["build"]).status).toBe(0);

        const missing = keel(dir, ["check", "--base", "no-such-surface.json"]);
        expect(diags(missing, "W1568")).toHaveLength(1);
        expect(diags(missing, "E1562")).toEqual([]);
        // W1568 does not change the exit code: it is the one plain `keel check` gives this project
        expect(missing.status).toBe(keel(dir, ["check"]).status);

        // one deployable: the readable topology compares nothing
        expect(diags(keel(dir, ["check", "--base", base]), "E1562")).toEqual([]);
        // an unreadable topology (a computed module list) counts every caller and route as split
        write(dir, {
          "topology.ts":
            "import { topology } from '@keel/server'\nconst modules = ['a', 'y']\nexport default topology({ x: { modules, adapter: 'node' } })\n",
        });
        const found = diags(keel(dir, ["check", "--base", base]), "E1562");
        expect(found).toHaveLength(1);
        expect(String(found[0]?.message)).toContain(f);
      }),
      { seed: SEED, numRuns: 3 },
    );
  },
  SLOW,
);

const OTHER_SCHEMA =
  "endpoints({ save: { method: 'POST', path: '/y/save', body: s.object({ name: s.string() }), output: s.string().nullable() } })";
const otherFile = (base: string): string =>
  `import { s } from '@keel/schema'\nimport { endpoints, service } from '@keel/services'\n${base}\n`.replace(
    "__SCHEMA__",
    OTHER_SCHEMA,
  );

test(
  "`service({ base: origin, schema })` with an endpoint that a route of app module `b` serves is one E1567 naming `b`; with `base: 'https://api.example.com'` none.",
  () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,8}$/), (label) => {
        // module `y` of the shared project plays `b`
        const computed = fresh({
          ...project(),
          "modules/a/other.ts": otherFile(
            "export const other = (origin: string) => service({ base: origin, schema: __SCHEMA__ })",
          ),
        });
        const found = diags(buildAndCheck(computed), "E1567");
        expect(found).toHaveLength(1);
        expect(found[0]?.path).toBe("modules/a/other.ts");
        expect(String(found[0]?.message)).toContain("y");
        expect(found[0]?.fix).toBeUndefined();

        const literal = fresh({
          ...project(),
          "modules/a/other.ts": otherFile(
            `export const other = service({ base: 'https://${label}.example.com', schema: __SCHEMA__ })`,
          ),
        });
        expect(diags(buildAndCheck(literal), "E1567")).toEqual([]);
      }),
      { seed: SEED, numRuns: 2 },
    );
  },
  SLOW,
);

test(
  "An endpoints file that throws is one E1006 from `keel build`, which exits 1.",
  () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{4,10}$/), (word) => {
        const files = project();
        const api = files["modules/a/api.ts"] ?? "";
        const dir = fresh({
          ...files,
          "modules/a/api.ts": `const boom = (m: string): never => {\n  throw new Error(m)\n}\nboom('endpoints-${word}')\n${api}`,
        });
        const built = keel(dir, ["build"]);
        expect(built.status).toBe(1);
        const found = diags(built, "E1006");
        expect(found).toHaveLength(1);
        expect(found[0]?.path).toBe("modules/a/api.ts");
        expect(String(found[0]?.message)).toContain(`endpoints-${word}`);
      }),
      { seed: SEED, numRuns: 3 },
    );
  },
  SLOW,
);
