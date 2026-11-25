// S0015: a fast-check run with no seed. `assert`, `check`, `sample` and `statistics` draw a fresh random seed each run
// unless they are given one, so the property's input differs run to run: a gate that flakes and a failure nobody can
// replay. A call is seeded when its options argument is an object literal with a `seed` key or a spread of a seeded
// one, or a name bound to one: a `const` of the file (every `const` of that name in the file, when it has several),
// or one a relative import brings from another file's top-level `export const`; or when the file's top level calls `configureGlobal` with a seeded options argument. `sample(arb, n)` and `statistics(arb, f, n)` with a number are unseeded. Calls are found through the file's
// `fast-check` imports: a default or namespace import (`fc.assert`) or a by-name one (`assert`, aliases too).
import fs from "node:fs";
import path from "node:path";
import { Visitor, parseSync } from "oxc-parser";

/** The run functions and the index of their options argument. */
const RUNS = new Map([
  ["assert", 1],
  ["check", 1],
  ["sample", 1],
  ["statistics", 2],
]);

const nameOf = (n) => (n?.type === "Identifier" ? n.name : undefined);
const keyOf = (p) =>
  p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? String(p.key.value) : undefined;

/** A file's top-level `export const` initializers by name. */
function exportedConsts(program) {
  const out = new Map();
  for (const s0 of program.body) {
    const s = s0.type === "ExportNamedDeclaration" ? s0.declaration : undefined;
    if (s?.type !== "VariableDeclaration" || s.kind !== "const") continue;
    for (const d of s.declarations) if (d.id.type === "Identifier" && d.init) out.set(d.id.name, d.init);
  }
  return out;
}

/** Whether an options argument names a seed, resolving names through `lookup` (name to its initializer). */
function seededBy(arg, lookup, depth = 0) {
  if (depth > 4 || arg === undefined) return false;
  if (arg.type === "Identifier") return seededBy(lookup(arg.name), lookup, depth + 1);
  if (arg.type === "Ambiguous") return arg.inits.every((i) => seededBy(i, lookup, depth + 1));
  if (arg.type !== "ObjectExpression") return false;
  return arg.properties.some((p) =>
    p.type === "SpreadElement" ? seededBy(p.argument, lookup, depth + 1) : p.type === "Property" && keyOf(p) === "seed",
  );
}

/** A relative import's source text, or undefined when it cannot be read. */
function readRelative(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  for (const f of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`]) {
    try {
      if (fs.statSync(f).isFile()) return { file: f, source: fs.readFileSync(f, "utf8") };
    } catch {}
  }
  return undefined;
}

/**
 * Each unseeded fast-check run in `source` (a test file at `filename`, which picks the parser's language), as
 * `{ line, col, message }` with 1-based line and column of the call.
 */
export function unseededProperties(source, filename, read = readRelative) {
  const parsed = parseSync(filename, source);
  const program = parsed.program;
  const objects = new Set();
  const byName = new Map();
  const consts = new Map();
  new Visitor({
    VariableDeclaration: (d) => {
      if (d.kind !== "const") return;
      for (const v of d.declarations)
        if (v.id.type === "Identifier") consts.set(v.id.name, [...(consts.get(v.id.name) ?? []), v.init]);
    },
  }).visit(program);
  const imported = new Map();
  for (const s of program.body) {
    if (s.type === "ImportDeclaration" && s.source.value.startsWith("."))
      for (const sp of s.specifiers)
        if (sp.type === "ImportSpecifier")
          imported.set(sp.local.name, { from: s.source.value, name: nameOf(sp.imported) });
  }
  const lookup = (name) => {
    const own = consts.get(name);
    if (own !== undefined) return own.length === 1 ? own[0] : { type: "Ambiguous", inits: own };
    const at = imported.get(name);
    const other = at === undefined ? undefined : read(filename, at.from);
    if (other === undefined) return undefined;
    return exportedConsts(parseSync(other.file, other.source).program).get(at.name);
  };
  const seeded = (arg) => seededBy(arg, lookup);
  for (const s of program.body) {
    if (s.type !== "ImportDeclaration" || s.source.value !== "fast-check") continue;
    for (const sp of s.specifiers) {
      if (sp.type === "ImportDefaultSpecifier" || sp.type === "ImportNamespaceSpecifier") objects.add(sp.local.name);
      else if (sp.type === "ImportSpecifier")
        byName.set(sp.local.name, nameOf(sp.imported) ?? String(sp.imported.value));
    }
  }
  if (objects.size === 0 && byName.size === 0) return [];
  /** The fast-check function a callee names, or undefined. */
  const fcName = (callee) => {
    const own = nameOf(callee);
    if (own !== undefined) return byName.get(own);
    if (callee?.type !== "MemberExpression" || callee.computed) return undefined;
    return objects.has(nameOf(callee.object) ?? "") ? nameOf(callee.property) : undefined;
  };
  let global = false;
  for (const s of program.body) {
    const e = s.type === "ExpressionStatement" ? s.expression : undefined;
    if (e?.type === "CallExpression" && fcName(e.callee) === "configureGlobal" && seeded(e.arguments[0])) global = true;
  }
  if (global) return [];
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") starts.push(i + 1);
  const out = [];
  new Visitor({
    CallExpression: (n) => {
      const fn = fcName(n.callee);
      const at = fn === undefined ? undefined : RUNS.get(fn);
      if (at === undefined || seeded(n.arguments[at])) return;
      const line = starts.findLastIndex((st) => st <= n.start);
      out.push({
        line: line + 1,
        col: n.start - (starts[line] ?? 0) + 1,
        message: `fast-check ${fn} with no seed draws new input each run; pass { seed } so a failure replays`,
      });
    },
  }).visit(program);
  return out;
}
