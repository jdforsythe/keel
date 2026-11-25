// Spec: k.compat, clause "An open `{ a?: string }` does not accept an open `{}` and accepts a closed `{}`."
// Spec: k.compat, clause "`keel check --base` naming a missing file, or one that is not JSON, is one W1568 and exits 0; with `topology.ts` unreadable, a base entry the current one refuses is E1562."
// Spec: k.compat, clause "`service({ base: origin, schema })` with an endpoint that an API entry of app module `b` serves is one E1567 naming `b`; with `base: 'https://api.example.com'` none."
// Spec: k.compat, clause "A contract file that throws is one E1006 from `keel build`, which exits 1."
// Seed 1337. Real binary over a temp project (see compat-support.ts). Module `y` plays `b`; its contract entry `y.add` has the `body` the caller sends.
// "A accepts B" is observed through E1562: the base entry's body is `B`, the current entry's is `A`, the caller `a` in another deployable;
// no E1562 means the current `body` accepts the base `body` (k.compat Base).
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import {
  SEED,
  baseSurface,
  baseSurfaceOnce,
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
/**
 * What the `--base` case bounds: three property runs of about twelve binary runs each (a build of the deployed base,
 * a build, five or six `keel check`s), about 0.25 s a run here (9 s in all). The bound is 6 s a binary run, 24 times
 * that, so a runner ten times slower (scale 0.1) still has twice the work's time.
 */
const BASE_CASE_BOUND = 3 * 12 * 6_000;
/**
 * What the open-object case bounds: two bases built and each changed entry built and checked, six binary runs,
 * about 3 s a run here beside other work. The bound is 60 s a run, so a runner ten times slower (scale 0.1) still has
 * 6 s a run.
 */
const OPEN_CASE_BOUND = 2 * 3 * 60_000;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const fresh = (files: Record<string, string>): string => {
  const dir = materialize(files);
  dirs.push(dir);
  return dir;
};
/** E1562 diagnostics when the deployed base had body `base` and the current entry has body `current`. */
const e1562 = (base: string, current: string) => {
  const b = baseSurface(project({ body: base, split: true }));
  dirs.push(b.dir);
  write(b.dir, project({ body: current, split: true }));
  return diags(buildAndCheck(b.dir, b.base), "E1562");
};

test(
  "An open `{ a?: string }` does not accept an open `{}` and accepts a closed `{}`.",
  () => {
    const optional = "s.object({ a: s.string().optional() })";
    expect(e1562("s.object({})", optional)).toHaveLength(1);
    expect(e1562("s.object({}, { closed: true })", optional)).toEqual([]);
  },
  OPEN_CASE_BOUND,
);

test(
  "`keel check --base` naming a missing file, or one that is not JSON, is one W1568 and exits 0; with `topology.ts` unreadable, a base entry the current one refuses is E1562.",
  () => {
    fc.assert(
      fc.property(fc.constantFrom("note", "qty", "label"), (f) => {
        const NAME = "s.object({ name: s.string() })";
        const { dir, base } = baseSurfaceOnce(project({ body: NAME, split: false }));
        dirs.push(dir);
        write(dir, project({ body: `s.object({ name: s.string(), ${f}: s.string() })`, split: false }));
        expect(keel(dir, ["build"]).status).toBe(0);

        const missing = keel(dir, ["check", "--base", "no-such-surface.json"]);
        expect(diags(missing, "W1568")).toHaveLength(1);
        expect(diags(missing, "E1562")).toEqual([]);
        // a base file that is not JSON is the same
        write(dir, { "text-base.json": "not json" });
        const text = keel(dir, ["check", "--base", "text-base.json"]);
        expect(diags(text, "W1568")).toHaveLength(1);
        expect(diags(text, "E1562")).toEqual([]);
        expect(text.status).toBe(missing.status);
        // W1568 does not change the exit code: it is the one plain `keel check` gives this project
        expect(missing.status).toBe(keel(dir, ["check"]).status);

        // one deployable: the readable topology compares nothing
        expect(diags(keel(dir, ["check", "--base", base]), "E1562")).toEqual([]);
        // an unreadable topology (a computed module list) counts every caller and entry as split
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
  BASE_CASE_BOUND,
);

const OTHER_SCHEMA =
  "endpoints({ save: { method: 'POST', path: '/y/save', body: s.object({ name: s.string() }), output: s.string().nullable() } })";
const otherFile = (base: string): string =>
  `import { s } from '@keel/schema'\nimport { endpoints, service } from '@keel/services'\n${base}\n`.replace(
    "__SCHEMA__",
    OTHER_SCHEMA,
  );

test(
  "`service({ base: origin, schema })` with an endpoint that an API entry of app module `b` serves is one E1567 naming `b`; with `base: 'https://api.example.com'` none.",
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
  "A contract file that throws is one E1006 from `keel build`, which exits 1.",
  () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{4,10}$/), (word) => {
        const files = project();
        const contractSrc = files["modules/y/y.contract.ts"] ?? "";
        // An invalid pattern makes the file throw on evaluation without a `throw` statement, which `keel check` refuses.
        const dir = fresh({
          ...files,
          "modules/y/y.contract.ts": `new RegExp('(contract-${word}')\n${contractSrc}`,
        });
        const built = keel(dir, ["build"]);
        expect(built.status).toBe(1);
        const found = diags(built, "E1006");
        expect(found).toHaveLength(1);
        expect(found[0]?.path).toBe("modules/y/y.contract.ts");
        expect(String(found[0]?.message)).toContain(`contract-${word}`);
      }),
      { seed: SEED, numRuns: 3 },
    );
  },
  SLOW,
);
