import ts from "typescript";
import { bareExpression } from "./bareExpression.ts";

/** One finding of an `expect`: its code, the node it lies at, its message. */
type ExpectUse = { readonly code: "E1452" | "E1460"; readonly at: ts.Node; readonly message: string };
type Fn = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;

const UNREADABLE = "expect is not readable here: write the function in the call";
const NEVER = "expect claims every throw: it never returns undefined";
const UNTESTED = "expect claims every throw: return the error where instanceof, ===, a guard or .ok holds";
const COPIES = "expect copies thrown text: carry a number, a boolean or a closed code";
const BUILDS = "expect builds its error from the thrown value: return X.make(data)";
const OPEN = "error data an expect returns is open text: carry a number, a boolean or a closed code";
/** Members whose read in a copy carries the thrown value's text (k.expect Carries). */
const TEXT_MEMBERS: ReadonlySet<string> = new Set(["message", "stack", "cause", "errors", "toString"]);
const LITERAL_FLAGS =
  ts.TypeFlags.StringLiteral |
  ts.TypeFlags.NumberLiteral |
  ts.TypeFlags.BooleanLiteral |
  ts.TypeFlags.EnumLiteral |
  ts.TypeFlags.BigIntLiteral;

const isFn = (n: ts.Node): boolean =>
  ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n);

/**
 * The function an `expect` argument names (k.expect Readable): an arrow function or function expression written in the
 * call, or a name that resolves by symbol to a function declaration or to a `const` bound to one, declared in a file
 * that is no declaration file and lies with the call (`sameHome`). Else `undefined`.
 */
function readable(
  arg: ts.Expression,
  checker: ts.TypeChecker,
  sameHome: (f: ts.SourceFile) => boolean,
): Fn | undefined {
  const a = bareExpression(arg);
  if (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) return a;
  const at = ts.isIdentifier(a)
    ? a
    : ts.isPropertyAccessExpression(a) && ts.isIdentifier(a.expression)
      ? (() => {
          const ns = checker.getSymbolAtLocation(a.expression);
          const r = ns !== undefined && (ns.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(ns) : ns;
          return r !== undefined && (r.flags & ts.SymbolFlags.ValueModule) !== 0 ? a.name : undefined;
        })()
      : undefined;
  if (at === undefined) return undefined;
  const sym = checker.getSymbolAtLocation(at);
  if (sym === undefined) return undefined;
  const s = (sym.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(sym) : sym;
  const d = s.valueDeclaration;
  if (d === undefined || d.getSourceFile().isDeclarationFile || !sameHome(d.getSourceFile())) return undefined;
  if (ts.isFunctionDeclaration(d) && d.body !== undefined) return d;
  if (!ts.isVariableDeclaration(d) || d.initializer === undefined) return undefined;
  const list = d.parent;
  if (!ts.isVariableDeclarationList(list) || (list.flags & ts.NodeFlags.Const) === 0) return undefined;
  const init = bareExpression(d.initializer);
  return ts.isArrowFunction(init) || ts.isFunctionExpression(init) ? init : undefined;
}

/**
 * The findings of one `attempt` call's `expect` argument `arg` in the type pass (k.expect): E1452 when check cannot
 * read it (Readable) or it claims every throw (Decides 1 or 2), and E1460 for error data it returns that is not closed,
 * however the value reached it, or a returned error built from the thrown value (Carries). A function read by name is judged as written in the call and
 * reported at `arg`. `made` names the `make` or `causedBy` call of an `s.error` a call is (k.unsafe One path).
 */
export function expectFindings(
  arg: ts.Expression,
  checker: ts.TypeChecker,
  sameHome: (f: ts.SourceFile) => boolean,
  made: (call: ts.CallExpression) => "make" | "causedBy" | undefined,
): ExpectUse[] {
  const fn = readable(arg, checker, sameHome);
  if (fn === undefined) return [{ code: "E1452", at: arg, message: UNREADABLE }];
  const written = fn.pos >= arg.pos && fn.end <= arg.end && fn.getSourceFile() === arg.getSourceFile();
  const where = (n: ts.Node): ts.Node => (written ? n : arg);
  const param = fn.parameters[0];
  const x = param !== undefined && ts.isIdentifier(param.name) ? checker.getSymbolAtLocation(param.name) : undefined;

  const reading = new Map<ts.Symbol, boolean>();
  /** Whether identifier `id` is the thrown value, or a `const` of `fn` whose initializer reads it. */
  const readsName = (id: ts.Identifier): boolean => {
    const sym = checker.getSymbolAtLocation(id);
    if (sym === undefined || x === undefined) return false;
    if (sym === x) return true;
    const held = reading.get(sym);
    if (held !== undefined) return held;
    reading.set(sym, false);
    const d = sym.valueDeclaration;
    const inFn = d !== undefined && d.pos >= fn.pos && d.end <= fn.end && d.getSourceFile() === fn.getSourceFile();
    const list = d?.parent;
    const found =
      inFn &&
      d !== undefined &&
      ts.isVariableDeclaration(d) &&
      d.initializer !== undefined &&
      list !== undefined &&
      ts.isVariableDeclarationList(list) &&
      (list.flags & ts.NodeFlags.Const) !== 0 &&
      reads(d.initializer);
    reading.set(sym, found);
    return found;
  };
  /**
   * Whether `e` reads the thrown value (k.expect Decides): `x`, a property of one, `Reflect.get` of one, `Object(…)` of
   * one, `typeof` one.
   */
  function reads(e: ts.Expression): boolean {
    const b = bareExpression(e);
    if (ts.isIdentifier(b)) return readsName(b);
    if (ts.isPropertyAccessExpression(b) || ts.isElementAccessExpression(b)) return reads(b.expression);
    if (ts.isTypeOfExpression(b)) return reads(b.expression);
    if (ts.isNonNullExpression(b)) return reads(b.expression);
    if (ts.isCallExpression(b)) {
      const c = bareExpression(b.expression);
      const first = b.arguments[0];
      if (first === undefined) return false;
      if (ts.isIdentifier(c) && c.text === "Object" && b.arguments.length === 1) return reads(first);
      return (
        ts.isPropertyAccessExpression(c) &&
        ts.isIdentifier(c.expression) &&
        c.expression.text === "Reflect" &&
        c.name.text === "get" &&
        reads(first)
      );
    }
    return false;
  }
  /** Whether `e` is `S.parse(v)` with `v` reading the thrown value, or a `const` of the function bound to one. */
  const parsesThrown = (e: ts.Expression, depth = 0): boolean => {
    const b = bareExpression(e);
    if (ts.isCallExpression(b)) {
      const c = bareExpression(b.expression);
      const first = b.arguments[0];
      return ts.isPropertyAccessExpression(c) && c.name.text === "parse" && first !== undefined && reads(first);
    }
    if (!ts.isIdentifier(b) || depth > 8) return false;
    const d = checker.getSymbolAtLocation(b)?.valueDeclaration;
    const list = d?.parent;
    return (
      d !== undefined &&
      ts.isVariableDeclaration(d) &&
      d.initializer !== undefined &&
      d.pos >= fn.pos &&
      d.end <= fn.end &&
      d.getSourceFile() === fn.getSourceFile() &&
      list !== undefined &&
      ts.isVariableDeclarationList(list) &&
      (list.flags & ts.NodeFlags.Const) !== 0 &&
      parsesThrown(d.initializer, depth + 1)
    );
  };
  /** Whether `e` mentions the thrown value anywhere: `x` or a `const` reading it. */
  const mentions = (e: ts.Node): boolean => {
    if (ts.isIdentifier(e) && readsName(e)) return true;
    return ts.forEachChild(e, (c) => (mentions(c) ? true : undefined)) === true;
  };
  const booleanOrPredicate = (call: ts.CallExpression): boolean => {
    const sig = checker.getResolvedSignature(call);
    if (sig === undefined) return false;
    if (checker.getTypePredicateOfSignature(sig) !== undefined) return true;
    return (checker.getReturnTypeOfSignature(sig).flags & ts.TypeFlags.BooleanLike) !== 0;
  };
  /** Whether `e` is a test of the thrown value (k.expect Decides). */
  function isTest(e: ts.Expression): boolean {
    const b = bareExpression(e);
    if (ts.isPrefixUnaryExpression(b)) return b.operator === ts.SyntaxKind.ExclamationToken && isTest(b.operand);
    if (ts.isCallExpression(b)) return b.arguments.some((a) => reads(a)) && booleanOrPredicate(b);
    if (ts.isPropertyAccessExpression(b) && b.name.text === "ok") return parsesThrown(b.expression);
    if (!ts.isBinaryExpression(b)) return false;
    const op = b.operatorToken.kind;
    if (op === ts.SyntaxKind.InstanceOfKeyword) return reads(b.left);
    if (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken)
      return (reads(b.left) && !mentions(b.right)) || (reads(b.right) && !mentions(b.left));
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return isTest(b.left) || isTest(b.right);
    if (op === ts.SyntaxKind.BarBarToken) return isTest(b.left) && isTest(b.right);
    return false;
  }

  /**
   * The values `e` returns, read through `?:`, `&&`, `||`, `??`, a comma's last operand and parentheses, each with
   * whether a test guards it; `t && e` returns `e` guarded when `t` is a test.
   */
  const leaves = (e: ts.Expression, guarded: boolean, into: { e: ts.Expression; guarded: boolean }[]): void => {
    const b = bareExpression(e);
    if (ts.isConditionalExpression(b)) {
      const t = guarded || isTest(b.condition);
      leaves(b.whenTrue, t, into);
      leaves(b.whenFalse, t, into);
      return;
    }
    if (ts.isBinaryExpression(b)) {
      const op = b.operatorToken.kind;
      if (op === ts.SyntaxKind.CommaToken) {
        leaves(b.right, guarded, into);
        return;
      }
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
        leaves(b.right, guarded || isTest(b.left), into);
        return;
      }
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
        leaves(b.left, guarded, into);
        leaves(b.right, guarded, into);
        return;
      }
    }
    into.push({ e: b, guarded });
  };
  const returned: { e: ts.Expression; guarded: boolean }[] = [];
  const body = fn.body;
  if (body !== undefined && !ts.isBlock(body)) leaves(body, false, returned);
  else if (body !== undefined) walkStatements(body.statements, false);

  /** Whether statement `s` is `return`, `return undefined` or `return void 0`, bare or alone in a block. */
  function returnsUndefined(s: ts.Statement): boolean {
    if (ts.isBlock(s)) {
      const only = s.statements[0];
      return s.statements.length === 1 && only !== undefined && returnsUndefined(only);
    }
    return ts.isReturnStatement(s) && (s.expression === undefined || isUndefined(bareExpression(s.expression)));
  }
  /**
   * The returns of a statement list, each guarded when a test selects it (k.expect Decides): the branches of an `if`
   * whose condition is a test; the statements after `if (t) return undefined` with `t` a test, in the same list; and
   * the clauses before any `default` of a `switch` whose expression reads the thrown value, each `case` expression holding
   * no mention of it.
   */
  function walkStatements(list: readonly ts.Statement[], guarded: boolean): void {
    let g = guarded;
    for (const st of list) {
      walkStatement(st, g);
      if (ts.isIfStatement(st) && st.elseStatement === undefined && returnsUndefined(st.thenStatement))
        if (isTest(st.expression)) g = true;
    }
  }
  function walkStatement(n: ts.Node, guarded: boolean): void {
    if (isFn(n) || ts.isClassLike(n)) return;
    if (ts.isReturnStatement(n)) {
      if (n.expression !== undefined) leaves(n.expression, guarded, returned);
      return;
    }
    if (ts.isBlock(n)) {
      walkStatements(n.statements, guarded);
      return;
    }
    if (ts.isIfStatement(n)) {
      const t = guarded || isTest(n.expression);
      walkStatement(n.thenStatement, t);
      if (n.elseStatement !== undefined) walkStatement(n.elseStatement, t);
      return;
    }
    if (ts.isSwitchStatement(n)) {
      const on = reads(n.expression);
      let open = false;
      for (const clause of n.caseBlock.clauses) {
        if (ts.isDefaultClause(clause)) open = true;
        const selects = !open && on && ts.isCaseClause(clause) && !mentions(clause.expression);
        walkStatements(clause.statements, guarded || selects);
      }
      return;
    }
    ts.forEachChild(n, (c) => walkStatement(c, guarded));
  }
  function isUndefined(e: ts.Expression): boolean {
    return (
      (ts.isIdentifier(e) && e.text === "undefined") || (ts.isVoidExpression(e) && ts.isLiteralExpression(e.expression))
    );
  }

  const out: ExpectUse[] = [];
  const sig = checker.getSignatureFromDeclaration(fn);
  const ret = sig === undefined ? undefined : checker.getReturnTypeOfSignature(sig);
  const holdsUndefined =
    ret === undefined ||
    (ret.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void | ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0 ||
    (ret.isUnion() && ret.types.some((t) => (t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) !== 0));
  if (!holdsUndefined) out.push({ code: "E1452", at: arg, message: NEVER });
  else if (!returned.every((r) => isUndefined(r.e) || r.guarded))
    out.push({ code: "E1452", at: arg, message: UNTESTED });

  /**
   * Whether type `t` is closed (k.expect Carries): a number, a boolean, a literal, `null` or `undefined`, a union or
   * intersection of closed types, or an array, tuple or object whose elements, properties and index signatures are
   * closed and that has no call or construct signature. Open `string`, `bigint`, a template literal type, `symbol`,
   * `unknown`, `any`, `object`, a type parameter and a type check cannot resolve are not.
   */
  const closed = (t: ts.Type, seen: Set<ts.Type> = new Set()): boolean => {
    const SCALAR =
      ts.TypeFlags.NumberLike |
      ts.TypeFlags.BooleanLike |
      LITERAL_FLAGS |
      ts.TypeFlags.Null |
      ts.TypeFlags.Undefined |
      ts.TypeFlags.Void |
      ts.TypeFlags.Never;
    if ((t.flags & ts.TypeFlags.BigInt) !== 0 && (t.flags & ts.TypeFlags.BigIntLiteral) === 0) return false;
    if ((t.flags & SCALAR) !== 0) return true;
    if (t.isUnion() || t.isIntersection()) return t.types.every((u) => closed(u, seen));
    if ((t.flags & ts.TypeFlags.Object) === 0) return false;
    if (seen.has(t)) return true;
    seen.add(t);
    if (t.getCallSignatures().length > 0 || t.getConstructSignatures().length > 0) return false;
    if (checker.isArrayType(t) || checker.isTupleType(t)) {
      const item = checker.getIndexTypeOfType(t, ts.IndexKind.Number);
      return item !== undefined && closed(item, seen);
    }
    if (!checker.getIndexInfosOfType(t).every((i) => closed(i.type, seen))) return false;
    return checker.getPropertiesOfType(t).every((p) => closed(checker.getTypeOfSymbol(p), seen));
  };
  /** Whether every `KeelError` type in `t` has closed `data`; `undefined` members are no error. */
  const closedData = (t: ts.Type): boolean => {
    if ((t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void | ts.TypeFlags.Never)) !== 0) return true;
    if (t.isUnion()) return t.types.every(closedData);
    if ((t.flags & ts.TypeFlags.Object) === 0) return false;
    const data = checker.getPropertyOfType(t, "data");
    return data !== undefined && closed(checker.getTypeOfSymbol(data));
  };
  /** Whether a copy builds text: a read of a text member, `String(…)`, `JSON.stringify(…)`, a template or `+`. */
  const buildsText = (n: ts.Node): boolean => {
    if (ts.isPropertyAccessExpression(n) && TEXT_MEMBERS.has(n.name.text)) return true;
    if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression))
      if (TEXT_MEMBERS.has(n.argumentExpression.text)) return true;
    if (ts.isTemplateExpression(n)) return true;
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return true;
    if (ts.isCallExpression(n)) {
      const c = bareExpression(n.expression);
      if (ts.isIdentifier(c) && c.text === "String") return true;
      if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression))
        if (c.expression.text === "JSON" && c.name.text === "stringify") return true;
    }
    return ts.forEachChild(n, (c) => (buildsText(c) ? true : undefined)) === true;
  };
  /**
   * The data of a `make` or `causedBy` written in the `expect` (k.expect Carries), read through object and array
   * literals: each property value or element is judged by its own type, so a literal written there is closed; a spread,
   * a binding, a call or any other expression is judged by the type it has.
   */
  const judgeData = (d: ts.Expression): void => {
    const b = bareExpression(d);
    if (ts.isObjectLiteralExpression(b)) {
      for (const p of b.properties) {
        if (ts.isPropertyAssignment(p)) judgeData(p.initializer);
        else if (ts.isShorthandPropertyAssignment(p)) judgeLeaf(p.name);
        else if (ts.isSpreadAssignment(p)) judgeLeaf(p.expression);
        else out.push({ code: "E1460", at: where(p), message: OPEN });
      }
      return;
    }
    if (ts.isArrayLiteralExpression(b)) {
      for (const el of b.elements) {
        if (ts.isSpreadElement(el)) judgeLeaf(el.expression);
        else judgeData(el);
      }
      return;
    }
    judgeLeaf(b);
  };
  function judgeLeaf(c: ts.Expression): void {
    const copy = mentions(c);
    if ((copy && buildsText(c)) || !closed(checker.getTypeAtLocation(c)))
      out.push({ code: "E1460", at: where(c), message: copy ? COPIES : OPEN });
  }
  for (const r of returned) {
    if (isUndefined(r.e)) continue;
    const kind = ts.isCallExpression(r.e) ? made(r.e) : undefined;
    if (kind !== undefined && ts.isCallExpression(r.e)) {
      const data = r.e.arguments[kind === "make" ? 0 : 1];
      if (data !== undefined && !ts.isSpreadElement(data)) judgeData(data);
      else if (data !== undefined) out.push({ code: "E1460", at: where(data), message: OPEN });
      continue;
    }
    if (mentions(r.e)) out.push({ code: "E1460", at: where(r.e), message: BUILDS });
    else if (!closedData(checker.getTypeAtLocation(r.e))) out.push({ code: "E1460", at: where(r.e), message: OPEN });
  }
  return out;
}
