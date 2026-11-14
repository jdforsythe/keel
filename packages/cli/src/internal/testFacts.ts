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

const KEEL_TESTING = "@keel/testing";
/** Helpers and matchers whose argument is expected to throw or reject (`thrownSync(() => ...)`, `toThrow`). */
const THROWS = /throw/i;

/** The file name without extensions: an app file's default export is named after it. */
const baseOf = (from: string): string => (from.split("/").pop() ?? "").split(".")[0] ?? "";

const isBool = (e: ts.Expression): boolean =>
  e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword;

/** The name a callee ends in: `f` for `f(...)` and `a.b.f(...)`. */
const calleeName = (e: ts.Expression): string =>
  ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : "";

/**
 * A call whose outcome the test expects to be a throw or a rejection, so it is no passing run: inside a function
 * passed to `expect(...)` (`expect(() => explore(...)).toThrow()`), inside `expect(p).rejects`, or inside an argument
 * of a call named like `thrownSync` or `toThrow`.
 */
function expectedToThrow(call: ts.CallExpression): boolean {
  let inFunction = false;
  for (let n: ts.Node = call; n.parent !== undefined; n = n.parent) {
    const p = n.parent;
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) inFunction = true;
    if (!ts.isCallExpression(p) || !p.arguments.some((a) => a === n)) continue;
    const name = calleeName(p.expression);
    if (THROWS.test(name)) return true;
    if (name !== "expect") continue;
    if (inFunction) return true;
    for (let q: ts.Node = p; ts.isPropertyAccessExpression(q.parent) || ts.isCallExpression(q.parent); q = q.parent)
      if (ts.isPropertyAccessExpression(q.parent) && q.parent.name.text === "rejects") return true;
  }
  return false;
}

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
      // A computed key, method or accessor could name any option: the object is not readable.
      else return undefined;
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
   * The `@keel/testing` export a callee is (`explore`, `ns.explore`), else "": a local of the same name is not it.
   * Inside `packages/testing` a relative import of its own sources counts as the package.
   */
  const keelName = (ce: ts.Expression): string => {
    const own = (from: string): boolean =>
      from === KEEL_TESTING || (from.startsWith(".") && path.startsWith("packages/testing/"));
    if (ts.isIdentifier(ce)) {
      const imp = imports.get(ce.text);
      return imp !== undefined && own(imp.from) ? imp.name : "";
    }
    if (ts.isPropertyAccessExpression(ce) && ts.isIdentifier(ce.expression)) {
      const imp = imports.get(ce.expression.text);
      return imp?.name === "*" && own(imp.from) ? ce.name.text : "";
    }
    return "";
  };

  /** `prove` of `@keel/testing/prove` (a named or namespace import; inside `packages/testing`, its own `prove` source). */
  const isProve = (ce: ts.Expression): boolean => {
    const from = (f: string): boolean =>
      f === `${KEEL_TESTING}/prove` ||
      (f.startsWith(".") && f.includes("prove") && path.startsWith("packages/testing/"));
    if (ts.isIdentifier(ce)) {
      const imp = imports.get(ce.text);
      return imp?.name === "prove" && from(imp.from);
    }
    if (!ts.isPropertyAccessExpression(ce) || !ts.isIdentifier(ce.expression) || ce.name.text !== "prove") return false;
    const imp = imports.get(ce.expression.text);
    return imp?.name === "*" && from(imp.from);
  };

  /**
   * `explore(...)`: closed-form when the options argument is absent or an object naming none of `from`, `payloads` and
   * `depth`; options the ledger cannot read count as given. `depth` as written, when given.
   */
  const exploreRun = (c: ts.CallExpression): { closed: boolean; depth: NumRef } | undefined => {
    if (keelName(c.expression) !== "explore") return undefined;
    const o = c.arguments.some(ts.isSpreadElement) ? undefined : options(c.arguments[1], new Set());
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
    const keel = !fc && ["properties", "simulate"].includes(keelName(ce));
    if (!fc && !keel) return undefined;
    const runsKey = fc ? "numRuns" : "runs";
    const runs = fc ? global.runs : DEFAULT_RUNS;
    const seed = fc ? global.seed : PROPERTIES_SEED;
    const arg = c.arguments.some(ts.isSpreadElement) ? c.arguments[0] : c.arguments[1];
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
    const pins = new Set<string>();
    const calls = new Set<string>();
    const props: PropRun[] = [];
    const explores: { closed: boolean; depth: NumRef }[] = [];
    let typed = false;
    let proves = false;
    const visit = (n: ts.Node): void => {
      if (ts.isTypeNode(n) || ts.isImportDeclaration(n)) return;
      if (ts.isIfStatement(n) && isBool(n.expression)) {
        visit(n.expression);
        const live = n.expression.kind === ts.SyntaxKind.TrueKeyword ? n.thenStatement : n.elseStatement;
        if (live !== undefined) visit(live);
        return;
      }
      if (ts.isBlock(n) || ts.isSourceFile(n)) {
        // Statements after a `return` or `throw` never run.
        for (const st of n.statements) {
          visit(st);
          if (ts.isReturnStatement(st) || ts.isThrowStatement(st)) break;
        }
        return;
      }
      if (ts.isCallExpression(n) && !expectedToThrow(n)) {
        const p = propRun(n);
        if (p !== undefined) props.push(p);
        const x = exploreRun(n);
        if (x !== undefined) explores.push(x);
        if (TYPE_ASSERTS.has(nameOf(n.expression))) typed = true;
        if (isProve(n.expression)) proves = true;
      }
      if (ts.isIdentifier(n)) {
        const p = n.parent;
        const own = imports.get(n.text);
        // A relative import pins the name to the file it resolves to (`pins`); any other reference is by name.
        const rel = own?.from.startsWith(".") === true ? own : undefined;
        if (ts.isPropertyAccessExpression(p) && p.name === n) {
          const base = p.expression;
          const ns = ts.isIdentifier(base) ? imports.get(base.text) : undefined;
          if (ns?.name === "*" && ns.from.startsWith(".")) pins.add(`${ns.from}\n${n.text}`);
          else if (ns?.name === "*" || isCallee(p)) names.add(n.text);
        } else if (
          (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) &&
          p.tagName === n
        ) {
          if (rel !== undefined && rel.name !== "*")
            pins.add(`${rel.from}\n${rel.name === "default" ? baseOf(rel.from) : rel.name}`);
          else names.add(n.text);
        } else if (!isDeclName(n)) {
          if (rel !== undefined && rel.name !== "*")
            pins.add(`${rel.from}\n${rel.name === "default" ? baseOf(rel.from) : rel.name}`);
          else if (own?.name === "default") {
            names.add(n.text);
            names.add(baseOf(own.from));
          } else if (own !== undefined && own.name !== "*") names.add(own.name);
          if (isCallee(n)) {
            if (rel === undefined) names.add(n.text);
            calls.add(n.text);
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    for (const n of nodes) visit(n);
    return {
      names,
      pins,
      calls,
      props: props.map((p) => ({ runs: local(p.runs), seed: local(p.seed) })),
      explores: explores.map((x) => ({ closed: x.closed, depth: local(x.depth) })),
      typed,
      proves,
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
