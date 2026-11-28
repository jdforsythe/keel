import ts from "typescript";
import { bareExpression } from "./bareExpression.ts";

/** One finding: its code, the node it lies at, its message. */
type Spelling = { readonly code: "E1452"; readonly at: ts.Node; readonly message: string };

const RUN_TIME = "promise member chosen at run time; check cannot follow it";
const LISTENER = "listener for uncaught throws in app code: the Boundary and the server own them";
const TAKEN: ReadonlySet<string> = new Set(["then", "catch", "finally"]);
const GLOBAL_OBJECT: ReadonlySet<string> = new Set(["globalThis", "window", "self"]);
const BROWSER_EVENTS: ReadonlySet<string> = new Set(["unhandledrejection", "rejectionhandled", "error"]);
const HANDLERS: ReadonlySet<string> = new Set(["onunhandledrejection", "onerror"]);
const PROCESS_METHODS: ReadonlySet<string> = new Set(["on", "once", "addListener", "prependListener"]);
const PROCESS_EVENTS: ReadonlySet<string> = new Set([
  "uncaughtException",
  "unhandledRejection",
  "uncaughtExceptionMonitor",
]);

const ADD: ReadonlySet<string> = new Set(["addEventListener"]);
const PROCESS: ReadonlySet<string> = new Set(["process"]);

/**
 * The catches k.unsafe Other spellings reports in the type pass, E1452 each: a binding pattern taking `then`, `catch`
 * or `finally` off a value typed `PromiseLike`, at the element; an element access with a key that is no literal on a
 * `PromiseLike` value or on `Promise`, at the key; a listener for uncaught throws (`addEventListener` bare or on the
 * global object given `'unhandledrejection'`, `'rejectionhandled'` or `'error'`, an assignment to `onunhandledrejection`
 * or `onerror` of those, `process.on` and its siblings given an uncaught-throw event), at the call or the assignment. A
 * global is a name no declaration of the project's own code binds. A generator's `throw` is `calleeUses`'.
 */
export function otherSpellings(sf: ts.SourceFile, checker: ts.TypeChecker, program: ts.Program): Spelling[] {
  const out: Spelling[] = [];
  const fromLib = (d: ts.Node): boolean => program.isSourceFileDefaultLibrary(d.getSourceFile());
  /** Whether `t` is a promise: its `then` is the TypeScript lib's `Promise` or `PromiseLike` member. */
  const isPromise = (t: ts.Type): boolean => {
    const then = checker.getPropertyOfType(checker.getApparentType(t), "then");
    return (then?.declarations ?? []).some(
      (d) =>
        fromLib(d) &&
        ts.isInterfaceDeclaration(d.parent) &&
        (d.parent.name.text === "Promise" || d.parent.name.text === "PromiseLike"),
    );
  };
  /** Whether identifier `id` names a global: every declaration of it is in a declaration file, or it has none. */
  const isGlobal = (id: ts.Expression, names: ReadonlySet<string>): boolean => {
    const b = bareExpression(id);
    if (!ts.isIdentifier(b) || !names.has(b.text)) return false;
    const sym = checker.getSymbolAtLocation(b);
    return (sym?.declarations ?? []).every((d) => d.getSourceFile().isDeclarationFile);
  };
  const literalIn = (e: ts.Expression | undefined, set: ReadonlySet<string>): boolean =>
    e !== undefined && ts.isStringLiteralLike(e) && set.has(e.text);
  const memberName = (e: ts.Expression): string | undefined => {
    const b = bareExpression(e);
    if (ts.isPropertyAccessExpression(b)) return b.name.text;
    if (ts.isElementAccessExpression(b) && ts.isStringLiteralLike(b.argumentExpression))
      return b.argumentExpression.text;
    return undefined;
  };
  const holderOf = (e: ts.Expression): ts.Expression | undefined => {
    const b = bareExpression(e);
    return ts.isPropertyAccessExpression(b) || ts.isElementAccessExpression(b) ? b.expression : undefined;
  };

  const visit = (n: ts.Node): void => {
    if (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent) && n.dotDotDotToken === undefined) {
      const key = n.propertyName ?? n.name;
      const name = ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : undefined;
      if (name !== undefined && TAKEN.has(name) && isPromise(checker.getTypeAtLocation(n.parent)))
        out.push({ code: "E1452", at: n, message: `${name} taken off a promise; check cannot follow it` });
    } else if (ts.isElementAccessExpression(n)) {
      const key = n.argumentExpression;
      if (!ts.isStringLiteralLike(key) && !ts.isNumericLiteral(key)) {
        const holder = bareExpression(n.expression);
        const promiseCtor =
          ts.isIdentifier(holder) &&
          holder.text === "Promise" &&
          (checker.getSymbolAtLocation(holder)?.declarations ?? []).some(fromLib);
        if (promiseCtor || isPromise(checker.getTypeAtLocation(holder)))
          out.push({ code: "E1452", at: key, message: RUN_TIME });
      }
    } else if (ts.isCallExpression(n)) {
      const c = n.expression;
      const first = n.arguments[0];
      const name = memberName(c);
      const holder = holderOf(c);
      const browser =
        (isGlobal(c, ADD) ||
          (name === "addEventListener" && holder !== undefined && isGlobal(holder, GLOBAL_OBJECT))) &&
        literalIn(first, BROWSER_EVENTS);
      const node =
        name !== undefined &&
        PROCESS_METHODS.has(name) &&
        holder !== undefined &&
        isGlobal(holder, PROCESS) &&
        literalIn(first, PROCESS_EVENTS);
      if (browser || node) out.push({ code: "E1452", at: n, message: LISTENER });
    } else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = bareExpression(n.left);
      const name = ts.isIdentifier(left) ? left.text : memberName(left);
      const holder = holderOf(left);
      const target =
        name !== undefined &&
        HANDLERS.has(name) &&
        (ts.isIdentifier(left) ? isGlobal(left, HANDLERS) : holder !== undefined && isGlobal(holder, GLOBAL_OBJECT));
      if (target) out.push({ code: "E1452", at: n, message: LISTENER });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
