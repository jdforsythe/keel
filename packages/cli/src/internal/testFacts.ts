import ts from "typescript";
import type { FileFacts } from "./FileFacts.ts";
import type { NumRef } from "./NumRef.ts";
import type { PropRun } from "./PropRun.ts";
import type { Use } from "./Use.ts";

const TESTS = new Set(["it", "test", "xit", "xtest"]);
const SUITES = new Set(["describe", "suite", "xdescribe"]);
const MODIFIERS = new Set([
  "only",
  "skip",
  "todo",
  "fails",
  "concurrent",
  "sequential",
  "shuffle",
  "each",
  "for",
  "skipIf",
  "runIf",
]);
/** Bodies that never run, or pass only when they fail: no evidence. */
const NOT_RUN = new Set(["skip", "todo", "fails"]);
const FAST_CHECK = "fast-check";
/** fast-check's default `numRuns`; `properties` and `simulate` default to 100 runs and seed 1337 as well. */
const DEFAULT_RUNS = 100;
/** Type-level assertions (vitest), which the package's `check` type-checks: a body calling one is `proven`. */
const TYPE_ASSERTS = new Set(["expectTypeOf", "assertType"]);
const PROPERTIES_SEED = 1337;

/** `it.skip.each(t)("x", fn)` -> root `it`, modifiers, and every argument along the chain; else undefined. */
function chainOf(call: ts.CallExpression): { root: string; mods: string[]; args: ts.Expression[] } | undefined {
  const mods: string[] = [];
  const args: ts.Expression[] = [...call.arguments];
  let e: ts.Expression = call.expression;
  for (;;) {
    if (ts.isCallExpression(e)) {
      args.push(...e.arguments);
      e = e.expression;
    } else if (ts.isPropertyAccessExpression(e)) {
      mods.push(e.name.text);
      e = e.expression;
    } else break;
  }
  if (!ts.isIdentifier(e) || !(TESTS.has(e.text) || SUITES.has(e.text))) return undefined;
  return mods.every((m) => MODIFIERS.has(m)) ? { root: e.text, mods, args } : undefined;
}

/** A call or member access that is itself the callee or object of a larger chain (`it.each(t)` in `it.each(t)(...)`). */
const inChain = (n: ts.Node): boolean =>
  (ts.isCallExpression(n.parent) && n.parent.expression === n) ||
  (ts.isPropertyAccessExpression(n.parent) && n.parent.expression === n);

const isCallee = (n: ts.Node): boolean =>
  (ts.isCallExpression(n.parent) || ts.isNewExpression(n.parent)) && n.parent.expression === n;

/** An identifier that names a declaration or a property key, not a reference. */
function isDeclName(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isBindingElement(p)) return p.name === id || p.propertyName === id;
  if (ts.isLabeledStatement(p)) return p.label === id;
  return (
    (ts.isVariableDeclaration(p) ||
      ts.isParameter(p) ||
      ts.isFunctionDeclaration(p) ||
      ts.isFunctionExpression(p) ||
      ts.isClassDeclaration(p) ||
      ts.isPropertyAssignment(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isJsxAttribute(p)) &&
    p.name === id
  );
}

/** A literal number (`1_000`, `-1`, `(n)`, `n as const`), a constant reference, the smaller arm of `c ? a : b`. */
function num(e: ts.Expression): NumRef {
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) return num(e.expression);
  if (ts.isNumericLiteral(e)) return Number(e.text.replaceAll("_", ""));
  if (ts.isIdentifier(e)) return { ref: e.text };
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken) {
    const v = num(e.operand);
    return typeof v === "number" ? -v : undefined;
  }
  if (ts.isConditionalExpression(e)) {
    const a = num(e.whenTrue);
    const b = num(e.whenFalse);
    return typeof a === "number" && typeof b === "number" ? Math.min(a, b) : undefined;
  }
  return undefined;
}

/**
 * Static facts of one test or helper file (see `FileFacts`). Comments and strings are never references; type
 * positions are skipped; `describe.skip`/`xdescribe` skip everything inside; `it.skip`, `it.todo`, `it.fails` and
 * calls without a function body give no test.
 */
export function testFacts(path: string, source: string): FileFacts {
  const kind = /\.[jt]sx$/.test(path)
    ? ts.ScriptKind.TSX
    : /\.[cm]?js$/.test(path)
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  const imports = new Map<string, { from: string; name: string }>();
  const consts = new Map<string, NumRef>();
  const objects = new Map<string, ts.ObjectLiteralExpression>();
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.importClause?.isTypeOnly !== true) {
      const from = st.moduleSpecifier.text;
      const clause = st.importClause;
      if (clause?.name !== undefined) imports.set(clause.name.text, { from, name: "default" });
      const nb = clause?.namedBindings;
      if (nb !== undefined && ts.isNamespaceImport(nb)) imports.set(nb.name.text, { from, name: "*" });
      if (nb !== undefined && ts.isNamedImports(nb))
        for (const el of nb.elements)
          if (!el.isTypeOnly) imports.set(el.name.text, { from, name: (el.propertyName ?? el.name).text });
    }
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || d.initializer === undefined) continue;
        if (ts.isObjectLiteralExpression(d.initializer)) objects.set(d.name.text, d.initializer);
        else {
          const v = num(d.initializer);
          if (v !== undefined) consts.set(d.name.text, v);
        }
      }
  }
  const local = (v: NumRef): NumRef =>
    typeof v === "object" && v.key === undefined && consts.has(v.ref) ? consts.get(v.ref) : v;

  /** An options object's numeric keys; undefined when the argument is present but not readable. */
  const options = (e: ts.Expression | undefined, seen: ReadonlySet<string>): Map<string, NumRef> | undefined => {
    if (e === undefined) return new Map();
    if (ts.isIdentifier(e)) {
      const o = objects.get(e.text);
      return o === undefined || seen.has(e.text) ? undefined : options(o, new Set([...seen, e.text]));
    }
    if (!ts.isObjectLiteralExpression(e)) return undefined;
    const out = new Map<string, NumRef>();
    for (const p of e.properties) {
      if (ts.isSpreadAssignment(p)) {
        const inner = options(p.expression, seen);
        if (inner === undefined) return undefined;
        for (const [k, v] of inner) out.set(k, v);
      } else if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)))
        out.set(p.name.text, local(num(p.initializer)));
      else if (ts.isShorthandPropertyAssignment(p)) out.set(p.name.text, local({ ref: p.name.text }));
    }
    return out;
  };

  const fromFastCheck = (e: ts.Expression, names: readonly string[]): boolean => {
    const imp = ts.isIdentifier(e) ? imports.get(e.text) : undefined;
    return imp?.from === FAST_CHECK && names.includes(imp.name);
  };

  let global: PropRun = { runs: DEFAULT_RUNS, seed: undefined };
  const visitGlobal = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === "configureGlobal" &&
      fromFastCheck(n.expression.expression, ["default", "*"])
    ) {
      const o = options(n.arguments[0], new Set());
      global =
        o === undefined
          ? { runs: undefined, seed: undefined }
          : { runs: o.has("numRuns") ? o.get("numRuns") : DEFAULT_RUNS, seed: o.get("seed") };
    }
    ts.forEachChild(n, visitGlobal);
  };
  visitGlobal(sf);

  /** The imported name an identifier callee stands for, else its own text; "" for any other callee. */
  const nameOf = (ce: ts.Expression): string => (ts.isIdentifier(ce) ? (imports.get(ce.text)?.name ?? ce.text) : "");

  /**
   * `explore(...)`: closed-form when the options argument is absent or an object naming none of `from`, `payloads` and
   * `depth`; options the ledger cannot read count as given. `depth` as written, when given.
   */
  const exploreRun = (c: ts.CallExpression): { closed: boolean; depth: NumRef } | undefined => {
    if (nameOf(c.expression) !== "explore") return undefined;
    const o = options(c.arguments[1], new Set());
    if (o === undefined) return { closed: false, depth: undefined };
    return { closed: !["from", "payloads", "depth"].some((k) => o.has(k)), depth: o.get("depth") };
  };

  /** `fc.assert`/`fc.check` (or the named imports), `properties(...)` and `simulate(...)`: one property run each. */
  const propRun = (c: ts.CallExpression): PropRun | undefined => {
    const ce = c.expression;
    const fc =
      (ts.isPropertyAccessExpression(ce) &&
        ["assert", "check"].includes(ce.name.text) &&
        fromFastCheck(ce.expression, ["default", "*"])) ||
      fromFastCheck(ce, ["assert", "check"]);
    const keel = !fc && ["properties", "simulate"].includes(nameOf(ce));
    if (!fc && !keel) return undefined;
    const runsKey = fc ? "numRuns" : "runs";
    const runs = fc ? global.runs : DEFAULT_RUNS;
    const seed = fc ? global.seed : PROPERTIES_SEED;
    const arg = c.arguments[1];
    const imported = arg !== undefined && ts.isIdentifier(arg) && !objects.has(arg.text) && imports.has(arg.text);
    if (imported) {
      const fallback = (v: NumRef): number | undefined => (typeof v === "number" ? v : undefined);
      return {
        runs: { ref: arg.text, key: runsKey, fallback: fallback(local(runs)) },
        seed: { ref: arg.text, key: "seed", fallback: fallback(local(seed)) },
      };
    }
    const o = options(arg, new Set());
    if (o === undefined) return { runs: undefined, seed: undefined };
    return { runs: o.has(runsKey) ? o.get(runsKey) : runs, seed: o.has("seed") ? o.get("seed") : seed };
  };

  const useOf = (nodes: readonly ts.Node[]): Use => {
    const names = new Set<string>();
    const calls = new Set<string>();
    const props: PropRun[] = [];
    const explores: { closed: boolean; depth: NumRef }[] = [];
    let typed = false;
    const visit = (n: ts.Node): void => {
      if (ts.isTypeNode(n) || ts.isImportDeclaration(n)) return;
      if (ts.isCallExpression(n)) {
        const p = propRun(n);
        if (p !== undefined) props.push(p);
        const x = exploreRun(n);
        if (x !== undefined) explores.push(x);
        if (TYPE_ASSERTS.has(nameOf(n.expression))) typed = true;
      }
      if (ts.isIdentifier(n)) {
        const p = n.parent;
        if (ts.isPropertyAccessExpression(p) && p.name === n) {
          const base = p.expression;
          if ((ts.isIdentifier(base) && imports.get(base.text)?.name === "*") || isCallee(p)) names.add(n.text);
        } else if (
          (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) &&
          p.tagName === n
        )
          names.add(n.text);
        else if (!isDeclName(n)) {
          const imp = imports.get(n.text);
          if (imp?.name === "default") {
            names.add(n.text);
            names.add((imp.from.split("/").pop() ?? "").split(".")[0] ?? "");
          } else if (imp !== undefined && imp.name !== "*") names.add(imp.name);
          if (isCallee(n)) {
            names.add(n.text);
            calls.add(n.text);
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    for (const n of nodes) visit(n);
    return {
      names,
      calls,
      props: props.map((p) => ({ runs: local(p.runs), seed: local(p.seed) })),
      explores: explores.map((x) => ({ closed: x.closed, depth: local(x.depth) })),
      typed,
    };
  };

  const helpers = new Map<string, Use>();
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name !== undefined && st.body !== undefined)
      helpers.set(st.name.text, useOf([st.body]));
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations) {
        const init = d.initializer;
        if (
          ts.isIdentifier(d.name) &&
          init !== undefined &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        )
          helpers.set(d.name.text, useOf([init.body]));
      }
  }

  const tests: Use[] = [];
  const walk = (n: ts.Node, skipped: boolean): void => {
    const c = ts.isCallExpression(n) && !inChain(n) ? chainOf(n) : undefined;
    if (c === undefined) {
      ts.forEachChild(n, (k) => walk(k, skipped));
      return;
    }
    const skip = skipped || c.root.startsWith("x") || c.mods.some((m) => NOT_RUN.has(m));
    if (SUITES.has(c.root)) {
      for (const a of c.args) walk(a, skip);
      return;
    }
    const body = c.args.some((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a) || ts.isIdentifier(a));
    if (!skip && body) {
      const use = useOf(c.args);
      const named = c.args.filter((a) => ts.isIdentifier(a)).map((a) => a.text);
      tests.push({ ...use, calls: new Set([...use.calls, ...named]) });
    }
  };
  walk(sf, false);
  const objectFacts = new Map<string, ReadonlyMap<string, NumRef>>();
  for (const [name, o] of objects) {
    const keys = options(o, new Set([name]));
    if (keys !== undefined) objectFacts.set(name, keys);
  }
  return {
    imports,
    consts,
    objects: objectFacts,
    helpers,
    tests,
    global: { runs: local(global.runs), seed: local(global.seed) },
  };
}
