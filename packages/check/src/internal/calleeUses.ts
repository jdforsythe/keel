import ts from "typescript";
import { THROW_MESSAGE } from "./THROW_MESSAGE.ts";
import { catchMessage } from "./catchMessage.ts";

/** A function the type pass follows by its symbol (k.unsafe One path, k.reactive Static). */
type Callee =
  | "reject"
  | "catch"
  | "then"
  | "allSettled"
  | "any"
  | "defect"
  | "scope"
  | "signal"
  | "computed"
  | "effect"
  | "resource"
  | "store";

/** The TypeScript lib members followed, by interface. */
const LIB: ReadonlyMap<string, ReadonlyMap<string, Callee>> = new Map([
  [
    "PromiseConstructor",
    new Map<string, Callee>([
      ["reject", "reject"],
      ["allSettled", "allSettled"],
      ["any", "any"],
    ]),
  ],
  [
    "Promise",
    new Map<string, Callee>([
      ["catch", "catch"],
      ["then", "then"],
    ]),
  ],
  ["PromiseLike", new Map<string, Callee>([["then", "then"]])],
]);

/** The Keel exports followed, by package. */
const KEEL: ReadonlyMap<string, ReadonlyMap<string, Callee>> = new Map([
  ["@keel/schema", new Map<string, Callee>([["defect", "defect"]])],
  [
    "@keel/reactive",
    new Map<string, Callee>([
      ["scope", "scope"],
      ["signal", "signal"],
      ["computed", "computed"],
      ["effect", "effect"],
      ["resource", "resource"],
    ]),
  ],
  ["@keel/store", new Map<string, Callee>([["store", "store"]])],
]);

const NAMES: ReadonlySet<string> = new Set([
  ...[...LIB.values()].flatMap((m) => [...m.keys()]),
  ...[...KEEL.values()].flatMap((m) => [...m.keys()]),
]);
const MAKERS: ReadonlySet<string> = new Set(["scope", "signal", "computed", "effect", "resource", "store"]);
const CODE = /^E\d{4}$/;
const NOT_LITERAL = "defect code is not a literal E and four digits";
const UNREADABLE = "defect code check cannot read";
const NOT_TEXT = "defect message is not a literal: pass values as data, defect('text', { data })";
const NOT_DETAIL = "defect detail is not an object literal";
const DETACHED = "scope({ detached }) is for kernel code; nest the scope, or make a module root";

/** One finding: its code, offset in the parsed text, message and spec section. */
type Use = { readonly code: string; readonly at: number; readonly message: string; readonly see: string };

/**
 * How a reference to a followed function is run: `call`, the call that runs it; `args`, the arguments it gets, or
 * `unread`, an arguments value that is no array literal; `holder`, the array literal holding `args`; `bound`, the
 * `bind` name of a `.bind(...)`, `called` false when that bound function is not called right away.
 */
type Call = {
  readonly call: ts.CallExpression;
  readonly args?: readonly ts.Expression[];
  readonly unread?: ts.Expression;
  readonly holder?: ts.Expression;
  readonly bound?: ts.Node;
  readonly called: boolean;
};

const bare = (e: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(e) ? bare(e.expression) : e);

/** `n` with the parentheses around it. */
function outer(n: ts.Node): ts.Node {
  let at = n;
  while (ts.isParenthesizedExpression(at.parent)) at = at.parent;
  return at;
}

/** The member name of `a.b` or `a['b']`, else `undefined`. */
function memberName(m: ts.Node): string | undefined {
  if (ts.isPropertyAccessExpression(m)) return m.name.text;
  if (ts.isElementAccessExpression(m) && ts.isStringLiteralLike(m.argumentExpression)) return m.argumentExpression.text;
  return undefined;
}

/** `n` when it is a function with a body of its own, else `undefined`. */
function asFunction(n: ts.Node): ts.FunctionLikeDeclaration | undefined {
  if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) return n;
  if (ts.isMethodDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n)) return n;
  return ts.isConstructorDeclaration(n) ? n : undefined;
}

/** Whether `opts` may make a detached scope: not an object literal, or a `detached` other than `false` (E1207). */
function mayDetach(opts: ts.Expression): boolean {
  const o = bare(opts);
  if (!ts.isObjectLiteralExpression(o)) return true;
  for (const p of o.properties) {
    if (ts.isSpreadAssignment(p)) return true;
    if (p.name !== undefined && ts.isComputedPropertyName(p.name)) return true;
    const key =
      p.name === undefined ? undefined : ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : "";
    if (key !== "detached") continue;
    if (!ts.isPropertyAssignment(p) || p.initializer.kind !== ts.SyntaxKind.FalseKeyword) return true;
  }
  return false;
}

/**
 * The type pass's callee findings in one file (k.unsafe One path): E1451 (`Promise.reject`), E1452 (`.catch()`, a
 * `.then()` given a second argument, `Promise.allSettled`, `Promise.any`), E1455 (`defect`'s code argument) and,
 * unless `kernel`, E1207 (`scope` that may detach), each callee found by its symbol: through an import alias, a
 * namespace member, a literal computed member, a `const` alias every use of which runs it, `.call`, `.apply`,
 * `.bind` and `Reflect.apply`. Any other use of one of these functions as a value is its code at that use. Also
 * E1208 (`scope`) and E1203 (`signal`, `computed`, `effect`, `resource`, `store`) for a call that follows an `await`
 * in the same function body, not inside a function given to a `run` call (k.reactive Static). `ownerOf` names the
 * package a declaration's file belongs to.
 */
export function calleeUses(
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
  program: ts.Program,
  ownerOf: (fileName: string) => string | null,
  kernel: boolean,
): Use[] {
  const out: Use[] = [];
  const fromLib = (s: ts.Symbol | undefined): boolean =>
    (s?.declarations ?? []).some((d) => program.isSourceFileDefaultLibrary(d.getSourceFile()));
  const resolved = (s: ts.Symbol): ts.Symbol =>
    (s.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(s) : s;

  const calleeOf = (sym: ts.Symbol | undefined): Callee | undefined => {
    if (sym === undefined) return undefined;
    const s = resolved(sym);
    const name = s.getName();
    if (!NAMES.has(name)) return undefined;
    for (const d of s.declarations ?? []) {
      const file = d.getSourceFile();
      if (program.isSourceFileDefaultLibrary(file)) {
        const found = ts.isInterfaceDeclaration(d.parent) ? LIB.get(d.parent.name.text)?.get(name) : undefined;
        if (found !== undefined) return found;
        continue;
      }
      const owner = ownerOf(file.fileName);
      const found = owner === null ? undefined : KEEL.get(owner)?.get(name);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  /** The callee `ref` names itself: an identifier bound to it, or a member whose property is it. */
  const ownTarget = (ref: ts.Expression): Callee | undefined => {
    if (ts.isIdentifier(ref)) {
      const p = ref.parent;
      const sym =
        ts.isShorthandPropertyAssignment(p) && p.name === ref
          ? checker.getShorthandAssignmentValueSymbol(p)
          : checker.getSymbolAtLocation(ref);
      return calleeOf(sym);
    }
    const name = memberName(ref);
    if (name === undefined || !NAMES.has(name)) return undefined;
    if (ts.isPropertyAccessExpression(ref)) return calleeOf(checker.getSymbolAtLocation(ref.name));
    if (!ts.isElementAccessExpression(ref)) return undefined;
    const holder = checker.getApparentType(checker.getTypeAtLocation(ref.expression));
    return calleeOf(checker.getPropertyOfType(holder, name));
  };

  const isReflectApply = (e: ts.Expression): boolean => {
    const c = bare(e);
    if (memberName(c) !== "apply" || !(ts.isPropertyAccessExpression(c) || ts.isElementAccessExpression(c)))
      return false;
    const o = bare(c.expression);
    return ts.isIdentifier(o) && o.text === "Reflect" && fromLib(checker.getSymbolAtLocation(o));
  };

  const spread = (call: ts.CallExpression, value: ts.Expression | undefined): Call => {
    if (value === undefined) return { call, args: [], called: true };
    const v = bare(value);
    return ts.isArrayLiteralExpression(v)
      ? { call, args: v.elements, holder: v, called: true }
      : { call, unread: value, called: true };
  };

  /** How `ref` is run, or `undefined` when it is used as a value. */
  const callOf = (ref: ts.Expression): Call | undefined => {
    const o = outer(ref);
    const p = o.parent;
    if (ts.isCallExpression(p) && p.expression === o) return { call: p, args: p.arguments, called: true };
    if (ts.isCallExpression(p) && p.arguments[0] === o && isReflectApply(p.expression))
      return spread(p, p.arguments[2]);
    if (!(ts.isPropertyAccessExpression(p) || ts.isElementAccessExpression(p)) || p.expression !== o) return undefined;
    const name = memberName(p);
    if (name !== "call" && name !== "apply" && name !== "bind") return undefined;
    const m = outer(p);
    const c = m.parent;
    if (!ts.isCallExpression(c) || c.expression !== m) return undefined;
    if (name === "call") return { call: c, args: c.arguments.slice(1), called: true };
    if (name === "apply") return spread(c, c.arguments[1]);
    const bound = ts.isPropertyAccessExpression(p) ? p.name : p.argumentExpression;
    const b = outer(c);
    const later = b.parent;
    if (ts.isCallExpression(later) && later.expression === b)
      return { call: later, args: [...c.arguments.slice(1), ...later.arguments], bound, called: true };
    return { call: c, args: c.arguments.slice(1), bound, called: false };
  };

  /** Whether `e` names a function as a name does: an identifier, or a member of a namespace import. */
  const nameLike = (e: ts.Expression): boolean => {
    const b = bare(e);
    if (ts.isIdentifier(b)) return true;
    if (!(ts.isPropertyAccessExpression(b) || ts.isElementAccessExpression(b))) return false;
    const o = bare(b.expression);
    const sym = ts.isIdentifier(o) ? checker.getSymbolAtLocation(o) : undefined;
    return sym !== undefined && (resolved(sym).flags & ts.SymbolFlags.Module) !== 0;
  };

  const refsOf = new Map<ts.Symbol, ts.Identifier[]>();
  const references = (decl: ts.VariableDeclaration, name: ts.Identifier): readonly ts.Identifier[] => {
    const sym = checker.getSymbolAtLocation(name);
    if (sym === undefined) return [];
    const held = refsOf.get(sym);
    if (held !== undefined) return held;
    const found: ts.Identifier[] = [];
    const walk = (n: ts.Node): void => {
      if (ts.isIdentifier(n) && n !== name && n.text === name.text) {
        const p = n.parent;
        const at =
          ts.isShorthandPropertyAssignment(p) && p.name === n
            ? checker.getShorthandAssignmentValueSymbol(p)
            : checker.getSymbolAtLocation(n);
        if (at === sym) found.push(n);
      }
      ts.forEachChild(n, walk);
    };
    walk(decl.getSourceFile());
    refsOf.set(sym, found);
    return found;
  };

  /** The `const` declaration `init` initializes, when it is a non-exported `const x = <name>`. */
  const aliasDecl = (init: ts.Node): ts.VariableDeclaration | undefined => {
    const o = outer(init);
    const d = o.parent;
    if (!ts.isVariableDeclaration(d) || d.initializer !== o || !ts.isIdentifier(d.name)) return undefined;
    const list = d.parent;
    if (!ts.isVariableDeclarationList(list) || (list.flags & ts.NodeFlags.Const) === 0) return undefined;
    const st = list.parent;
    if (ts.isVariableStatement(st) && (st.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      return undefined;
    return nameLike(d.initializer) ? d : undefined;
  };

  /** Whether `decl` is an alias: every use of the name it declares runs it, or aliases it again. */
  const isAlias = (decl: ts.VariableDeclaration, depth: number): boolean => {
    if (depth > 8 || !ts.isIdentifier(decl.name)) return false;
    return references(decl, decl.name).every((r) => {
      if (callOf(r)?.called === true) return true;
      const next = aliasDecl(r);
      return next !== undefined && isAlias(next, depth + 1);
    });
  };

  /** The callee `id` reaches through `const` aliases. */
  const aliasTarget = (id: ts.Identifier, depth: number): Callee | undefined => {
    if (depth > 8) return undefined;
    const sym = checker.getSymbolAtLocation(id);
    const decl = sym?.valueDeclaration;
    if (decl === undefined || !ts.isVariableDeclaration(decl) || decl.initializer === undefined) return undefined;
    if (aliasDecl(decl.initializer) !== decl || !isAlias(decl, 0)) return undefined;
    const init = bare(decl.initializer);
    return ownTarget(init) ?? (ts.isIdentifier(init) ? aliasTarget(init, depth + 1) : undefined);
  };

  const awaitsIn = new Map<ts.Node, readonly (readonly [number, number])[]>();
  /** The `await` points of `fn`'s own body, nested functions aside: `await` and `for await`. */
  const awaitsOf = (fn: ts.FunctionLikeDeclaration): readonly (readonly [number, number])[] => {
    const held = awaitsIn.get(fn);
    if (held !== undefined) return held;
    const found: (readonly [number, number])[] = [];
    const walk = (n: ts.Node): void => {
      if (asFunction(n) !== undefined) return;
      if (ts.isAwaitExpression(n)) found.push([n.getStart(sf), n.getEnd()]);
      if (ts.isForOfStatement(n) && n.awaitModifier !== undefined) found.push([n.getStart(sf), n.expression.getEnd()]);
      ts.forEachChild(n, walk);
    };
    if (fn.body !== undefined) walk(fn.body);
    awaitsIn.set(fn, found);
    return found;
  };

  const givenToRun = (fn: ts.Node): boolean => {
    const o = outer(fn);
    const p = o.parent;
    if (!ts.isCallExpression(p) || !p.arguments.some((a) => a === o)) return false;
    const c = bare(p.expression);
    return (ts.isIdentifier(c) && c.text === "run") || memberName(c) === "run";
  };

  /** Whether `call` follows an `await` of its own function body, outside every function given to `run`. */
  const afterAwait = (call: ts.CallExpression): boolean => {
    let own: ts.FunctionLikeDeclaration | undefined;
    for (let n: ts.Node = call.parent; !ts.isSourceFile(n); n = n.parent) {
      const fn = asFunction(n);
      if (fn === undefined) continue;
      own ??= fn;
      if (givenToRun(fn)) return false;
    }
    if (own === undefined) return false;
    const start = call.getStart(sf);
    const end = call.getEnd();
    return awaitsOf(own).some(([a, b]) => b <= end && !(a <= start && b >= end));
  };

  /**
   * Whether `call` lies in a `finally` block, outside a function nested in it (E1452); one in a `return` there is
   * that `return`'s E1452 alone, a control exit from the `finally`.
   */
  const inFinally = (call: ts.Node): boolean => {
    for (let n: ts.Node = call; !ts.isSourceFile(n.parent); n = n.parent) {
      if (asFunction(n.parent) !== undefined || ts.isReturnStatement(n.parent)) return false;
      if (ts.isTryStatement(n.parent) && n.parent.finallyBlock === n) return true;
    }
    return false;
  };

  const add = (code: string, at: ts.Node, message: string, see: string): void =>
    void out.push({ code, at: at.getStart(sf), message, see });

  const nameAt = (ref: ts.Expression): ts.Node =>
    ts.isPropertyAccessExpression(ref) ? ref.name : ts.isElementAccessExpression(ref) ? ref.argumentExpression : ref;

  const valueUse = (target: Callee, ref: ts.Expression): void => {
    const message = `${target} used other than as a call; check cannot follow it`;
    if (target === "reject") add("E1451", ref, message, "k.errors");
    else if (target === "defect") add("E1455", ref, message, "k.errors");
    else if (target === "scope") {
      if (!kernel) add("E1207", ref, message, "k.reactive");
    } else if (!MAKERS.has(target)) add("E1452", ref, message, "k.errors");
  };

  const judgeCall = (target: Callee, ref: ts.Expression, use: Call): void => {
    const args = use.args ?? [];
    const spreadBefore = args.slice(0, 2).find((a) => ts.isSpreadElement(a));
    if (target === "reject") add("E1451", nameAt(ref), THROW_MESSAGE, "k.errors");
    else if (target === "catch" || target === "allSettled" || target === "any")
      add("E1452", nameAt(ref), catchMessage(target), "k.errors");
    else if (target === "then") {
      if (use.unread !== undefined) add("E1452", ref, catchMessage("value:then"), "k.errors");
      else if (args.filter((a) => !ts.isOmittedExpression(a)).length >= 2 || args.some((a) => ts.isSpreadElement(a)))
        add("E1452", nameAt(ref), catchMessage("then"), "k.errors");
    } else if (target === "defect") {
      if (use.bound !== undefined) add("E1455", use.bound, UNREADABLE, "k.errors");
      else if (use.unread !== undefined) add("E1455", use.unread, UNREADABLE, "k.errors");
      else if (spreadBefore !== undefined) add("E1455", use.holder ?? spreadBefore, UNREADABLE, "k.errors");
      else {
        const [message, second, third] = args;
        if (message !== undefined && !ts.isStringLiteral(message) && !ts.isNoSubstitutionTemplateLiteral(message))
          add("E1455", message, NOT_TEXT, "k.errors");
        if (second !== undefined && !ts.isObjectLiteralExpression(bare(second))) {
          if (!(ts.isStringLiteral(second) && CODE.test(second.text))) add("E1455", second, NOT_LITERAL, "k.errors");
          if (third !== undefined && !ts.isSpreadElement(third) && !ts.isObjectLiteralExpression(bare(third)))
            add("E1455", third, NOT_DETAIL, "k.errors");
        }
      }
      if (inFinally(use.call)) add("E1452", ref, catchMessage("defect-finally"), "k.errors");
    } else if (target === "scope" && !kernel) {
      const opts = args[1];
      if (use.unread !== undefined) add("E1207", use.unread, DETACHED, "k.reactive");
      else if (spreadBefore !== undefined) add("E1207", use.holder ?? spreadBefore, DETACHED, "k.reactive");
      else if (opts !== undefined && mayDetach(opts)) add("E1207", opts, DETACHED, "k.reactive");
    }
    if (MAKERS.has(target) && afterAwait(use.call))
      add(
        target === "scope" ? "E1208" : "E1203",
        ref,
        `${target} after await has no owner: take c = owner() before the await, then c.run(...)`,
        "k.reactive",
      );
  };

  const judgeRef = (ref: ts.Expression): void => {
    const own = ownTarget(ref);
    const target = own ?? (ts.isIdentifier(ref) ? aliasTarget(ref, 0) : undefined);
    if (target === undefined) return;
    const use = callOf(ref);
    if (use === undefined || (!use.called && target !== "defect")) {
      if (own === undefined) return;
      const decl = aliasDecl(ref);
      if (decl !== undefined && isAlias(decl, 0)) return;
      valueUse(target, ref);
      return;
    }
    judgeCall(target, ref, use);
  };

  /** Whether identifier `n` is a reference, not a name a declaration or member access gives. */
  const isReference = (n: ts.Identifier): boolean => {
    const p = n.parent;
    if (ts.isPropertyAccessExpression(p)) return p.expression === n;
    if (ts.isQualifiedName(p)) return false;
    if (
      (ts.isVariableDeclaration(p) ||
        ts.isParameter(p) ||
        ts.isFunctionDeclaration(p) ||
        ts.isFunctionExpression(p) ||
        ts.isClassDeclaration(p) ||
        ts.isPropertyAssignment(p) ||
        ts.isMethodDeclaration(p) ||
        ts.isPropertyDeclaration(p) ||
        ts.isBindingElement(p)) &&
      p.name === n
    )
      return false;
    return !(ts.isBindingElement(p) && p.propertyName === n);
  };

  const visit = (n: ts.Node): void => {
    if (ts.isTypeNode(n) || ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) return;
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) judgeRef(n);
    else if (ts.isIdentifier(n) && isReference(n)) judgeRef(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
