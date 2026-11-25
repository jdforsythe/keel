// Seed 1337. k.server-deps Registration through a library, the trace: a random path from a registering export to a call
// through the binding forms the trace continues through (re-exports by name, `export *`, `export * as`, a namespace or
// named import, a `const` alias, a static member, a plain-keyed destructuring), files up to the bound of 8 with the
// calling file and the library's two counted, judges the name at the call; the same path with one in-file step put in a
// form outside the trace is exactly one E1607, on that step's line.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";

type Files = { path: string; source: string }[];
const ROOT = "node_modules/@acme/store";
const manifest = (id: string, deps: string[], exports: string[] = [], root = `modules/${id}`) => ({
  path: `${root}/module.ts`,
  source: `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: ${JSON.stringify(exports)} } })\n`,
});
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const STORE =
  "import { register } from '@keel/ctx'\nconst impl = () => ({})\nexport function store(name: string) {\n  return register(name, { real: impl, shell: impl, sim: impl })\n}\n";
const library: Files = [
  manifest("a", ["@acme/store"]),
  {
    path: `${ROOT}/package.json`,
    source: JSON.stringify({
      name: "@acme/store",
      version: "1.0.0",
      type: "module",
      keel: "library",
      exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
    }),
  },
  { path: `${ROOT}/index.js`, source: "export {}\n" },
  manifest("store", [], ["store"], ROOT),
  { path: `${ROOT}/src/index.ts`, source: "export * from './store.ts'\n" },
  { path: `${ROOT}/src/store.ts`, source: STORE },
  { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
];

type FileStep = "named" | "star" | "starAs";
type LocalStep = "alias" | "member" | "destructure";
type Path = { files: FileStep[]; namespace: boolean; locals: LocalStep[]; out: number | undefined };

/** The project files and the calling file's lines for `p`; `out` puts the local step at that index (or the call) outside the trace. */
function build(p: Path, arg: string): { files: Files; line: number | undefined } {
  let spec = "@acme/store";
  let path = ["store"];
  const files: Files = [];
  p.files.forEach((kind, i) => {
    const at = `modules/a/r${i}.ts`;
    if (kind === "named") {
      files.push({ path: at, source: `export { ${path[0]} as s${i} } from '${spec}'\n` });
      path = [`s${i}`, ...path.slice(1)];
    } else if (kind === "star") files.push({ path: at, source: `export * from '${spec}'\n` });
    else {
      files.push({ path: at, source: `export * as n${i} from '${spec}'\n` });
      path = [`n${i}`, ...path];
    }
    spec = `./r${i}.ts`;
  });
  const lines: string[] = [];
  let rest = p.namespace ? path : path.slice(1);
  lines.push(p.namespace ? `import * as h0 from '${spec}'` : `import { ${path[0]} as h0 } from '${spec}'`);
  let h = "h0";
  let outLine: number | undefined;
  p.locals.forEach((kind, i) => {
    const next = `h${i + 1}`;
    const out = p.out === i;
    if (out) outLine = lines.length + 1;
    if (kind === "member" && rest.length > 0) {
      lines.push(out ? `const ${next} = ${h}[\`${rest[0]}\`]` : `const ${next} = ${h}.${rest[0]}`);
      rest = rest.slice(1);
    } else if (kind === "destructure" && rest.length > 0) {
      lines.push(out ? `const { ${rest[0]}: ${next} = undefined } = ${h}` : `const { ${rest[0]}: ${next} } = ${h}`);
      rest = rest.slice(1);
    } else lines.push(out ? `let ${next} = ${h}` : `const ${next} = ${h}`);
    h = next;
  });
  const callee = [h, ...rest].join(".");
  if (p.out === p.locals.length) outLine = lines.length + 1;
  lines.push(`export const d = ${callee}${p.out === p.locals.length ? "?." : ""}(${arg})`);
  files.push({ path: "modules/a/d.server.ts", source: `${lines.join("\n")}\n` });
  return { files, line: outLine };
}

const e1607 = (files: Files) =>
  check([...library, ...files], { types: false }).diagnostics.filter((d) => d.code === "E1607");

const pathOf = fc
  .record({
    files: fc.array(fc.constantFrom<FileStep>("named", "star", "starAs"), { maxLength: 5 }),
    namespace: fc.boolean(),
    locals: fc.array(fc.constantFrom<LocalStep>("alias", "member", "destructure"), { maxLength: 4 }),
  })
  .chain((p) => fc.record({ path: fc.constant(p), out: fc.integer({ min: 0, max: p.locals.length }) }));

test("a path through the traced forms judges the name at the call: `'a.main'` clean, `'main'` one E1607 on the call's line", () => {
  fc.assert(
    fc.property(pathOf, ({ path }) => {
      const p = { ...path, out: undefined };
      expect(e1607(build(p, "'a.main'").files), JSON.stringify(p)).toEqual([]);
      const bad = build(p, "'main'");
      const found = e1607(bad.files);
      expect(found, JSON.stringify(p)).toHaveLength(1);
      const source = bad.files.find((f) => f.path === "modules/a/d.server.ts")?.source ?? "";
      expect(found[0]?.line).toBe(source.split("\n").length - 1);
    }),
    { seed: 1337, numRuns: 120 },
  );
});

test("the same path with one in-file step outside the trace is exactly one E1607, on that step's line", () => {
  fc.assert(
    fc.property(pathOf, ({ path, out }) => {
      const p = { ...path, out };
      const built = build(p, "'a.main'");
      const found = e1607(built.files);
      expect(found, JSON.stringify(p)).toHaveLength(1);
      expect(found[0]?.path).toBe("modules/a/d.server.ts");
      expect(found[0]?.line, JSON.stringify(p)).toBe(built.line);
    }),
    { seed: 1337, numRuns: 120 },
  );
});

test("one re-export file past the bound is one E1607 at the use, naming the chain too long", () => {
  const six: FileStep[] = ["named", "named", "named", "named", "named", "named"];
  const p: Path = { files: six, namespace: false, locals: [], out: undefined };
  const found = e1607(build(p, "'a.main'").files);
  expect(found.map((d) => d.message)).toEqual([
    "h0 comes through more than 8 files: the name it registers cannot be read here",
  ]);
});
