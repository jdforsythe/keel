import {
  type Argument,
  type ArrowFunctionExpression,
  type Expression,
  type Function as FunctionNode,
  type Program,
  type Statement,
  Visitor,
} from "oxc-parser";
import { alwaysExits } from "./alwaysExits.ts";

type Fn = FunctionNode | ArrowFunctionExpression;
/** A condition and the value it has where a returned expression stands. */
type Guard = { readonly test: Expression; readonly holds: boolean };
/** How an expression reads the thrown value: the value itself, `typeof` of it, or a property of it. */
type Read = "value" | "typeof" | "prop";

/** Classes whose `instanceof` nearly every thrown value passes. */
const WIDE_CLASSES = new Set(["Error", "Object"]);

const bare = (e: Expression): Expression =>
  e.type === "ParenthesizedExpression" ||
  e.type === "TSAsExpression" ||
  e.type === "TSSatisfiesExpression" ||
  e.type === "TSNonNullExpression"
    ? bare(e.expression)
    : e;

const isFn = (e: Expression): e is ArrowFunctionExpression | FunctionNode =>
  e.type === "ArrowFunctionExpression" || e.type === "FunctionExpression";

/** The function a name in `program` is declared as at its top level: a function declaration or a `const` bound to one. */
function declared(program: Program, name: string): Fn | null {
  for (const st of program.body) {
    const d = st.type === "ExportNamedDeclaration" && st.declaration !== null ? st.declaration : st;
    if (d.type === "FunctionDeclaration" && d.id?.name === name) return d;
    if (d.type !== "VariableDeclaration" || d.kind !== "const") continue;
    for (const v of d.declarations) {
      if (v.id.type !== "Identifier" || v.id.name !== name || v.init === null || v.init === undefined) continue;
      const init = bare(v.init);
      return isFn(init) ? init : null;
    }
  }
  return null;
}

/** The name of a function's first parameter, or null. */
function paramOf(fn: Fn): string | null {
  const [p] = fn.params;
  return p !== undefined && p.type === "Identifier" ? p.name : null;
}

/** Whether a node lies inside a function nested in `fn` (its own returns and tests are not `fn`'s). */
function nestedIn(fn: Fn, n: { start: number; end: number }, inner: readonly Fn[]): boolean {
  return inner.some((g) => g !== fn && g.start >= fn.start && g.end <= fn.end && n.start >= g.start && n.end <= g.end);
}

/** Whether a declared helper's body tests its first parameter by a class (not `Error` or `Object`) or a property. */
function helperTests(program: Program, fn: Fn): boolean {
  const p = paramOf(fn);
  if (p === null) return false;
  const isP = (e: Expression | Argument): boolean =>
    e.type !== "SpreadElement" && bare(e).type === "Identifier" && nameIs(bare(e), p);
  let tests = false;
  new Visitor({
    BinaryExpression: (n) => {
      if (n.start < fn.start || n.end > fn.end) return;
      if (
        n.operator === "instanceof" &&
        isP(n.left) &&
        !(n.right.type === "Identifier" && WIDE_CLASSES.has(n.right.name))
      )
        tests = true;
      if (n.operator === "in" && isP(n.right)) tests = true;
    },
    MemberExpression: (n) => {
      if (n.start >= fn.start && n.end <= fn.end && isP(n.object)) tests = true;
    },
    CallExpression: (n) => {
      const [a] = n.arguments;
      if (n.start >= fn.start && n.end <= fn.end && isReflectGet(n.callee) && a !== undefined && isP(a)) tests = true;
    },
  }).visit(program);
  return tests;
}

const nameIs = (e: Expression, name: string): boolean => e.type === "Identifier" && e.name === name;

const isReflectGet = (c: Expression): boolean =>
  c.type === "MemberExpression" &&
  !c.computed &&
  c.object.type === "Identifier" &&
  c.object.name === "Reflect" &&
  c.property.type === "Identifier" &&
  c.property.name === "get";

/**
 * Whether an `attempt` call's `expect` (its second argument) claims nearly every throw (R1017, k.escapes, k.expect
 * Decides): some value it returns other than `undefined` stands where no narrow test of the thrown value holds. A narrow
 * test is `instanceof` a class other than `Error` or `Object`, `===` on a property, a property's truthiness, `'p' in x`,
 * `S.parse(x).ok`, or a call of a function declared in the file whose body tests a class or a property; `typeof x`,
 * `!==`, the branch where a test fails and every other condition are not. An `expect` given by a name declared in the
 * file is read at its declaration; one the file does not declare is not read. `program` is the file the call is in.
 */
export function wideExpect(program: Program, expect: Argument | undefined): boolean {
  if (expect === undefined || expect.type === "SpreadElement") return false;
  const given = bare(expect);
  const fn = isFn(given) ? given : given.type === "Identifier" ? declared(program, given.name) : null;
  if (fn === null || fn.body === null) return false;
  const x = paramOf(fn);
  if (x === null) return false;
  const inner: Fn[] = [];
  new Visitor({
    ArrowFunctionExpression: (n) => void inner.push(n),
    FunctionExpression: (n) => void inner.push(n),
    FunctionDeclaration: (n) => void inner.push(n),
  }).visit(program);
  const aliases = new Map<string, Read>();

  const reads = (e: Expression | Argument): Read | null => {
    if (e.type === "SpreadElement") return null;
    const b = bare(e);
    if (b.type === "Identifier") return b.name === x ? "value" : (aliases.get(b.name) ?? null);
    if (b.type === "MemberExpression") return reads(b.object) === null ? null : "prop";
    if (b.type === "CallExpression" && isReflectGet(b.callee)) {
      const [a] = b.arguments;
      return a !== undefined && reads(a) !== null ? "prop" : null;
    }
    if (b.type === "UnaryExpression" && b.operator === "typeof") {
      const r = reads(b.argument);
      return r === "prop" ? "prop" : r === null ? null : "typeof";
    }
    return null;
  };
  const mentions = (e: Expression): boolean => {
    let seen = false;
    new Visitor({
      Identifier: (n) => {
        if (n.start >= e.start && n.end <= e.end && (n.name === x || aliases.has(n.name))) seen = true;
      },
    }).visit(program);
    return seen;
  };

  /** Whether `c` having the value `holds` means a narrow test of the thrown value held. */
  const narrow = (c: Expression, holds: boolean): boolean => {
    const b = bare(c);
    if (b.type === "UnaryExpression" && b.operator === "!") return narrow(b.argument, !holds);
    if (b.type === "LogicalExpression" && b.operator === "&&")
      return holds ? narrow(b.left, true) || narrow(b.right, true) : narrow(b.left, false) && narrow(b.right, false);
    if (b.type === "LogicalExpression" && b.operator === "||")
      return holds ? narrow(b.left, true) && narrow(b.right, true) : narrow(b.left, false) || narrow(b.right, false);
    if (b.type === "BinaryExpression") {
      if (b.operator === "instanceof") {
        if (!holds) return false;
        const r = reads(b.left);
        if (r === "prop") return true;
        return r === "value" && !(b.right.type === "Identifier" && WIDE_CLASSES.has(b.right.name));
      }
      if (b.operator === "in") return holds && reads(b.right) !== null;
      const eq = b.operator === "===" || b.operator === "==";
      const ne = b.operator === "!==" || b.operator === "!=";
      if (!eq && !ne) return false;
      if (holds !== eq) return false;
      const left = reads(b.left);
      const right = reads(b.right);
      if (left === "prop" && !mentions(b.right)) return true;
      return right === "prop" && !mentions(b.left);
    }
    if (b.type === "MemberExpression") {
      const parsed = b.object.type === "CallExpression" ? parseCall(b.object) : false;
      if (holds && parsed && !b.computed && b.property.type === "Identifier" && b.property.name === "ok") return true;
      return holds && reads(b) === "prop";
    }
    if (b.type === "CallExpression") {
      if (!holds) return false;
      if (isReflectGet(b.callee)) return reads(b) === "prop";
      if (b.callee.type === "MemberExpression" && reads(b.callee.object) === "prop") return true;
      if (b.callee.type !== "Identifier" || !b.arguments.some((a) => reads(a) !== null)) return false;
      const helper = declared(program, b.callee.name);
      return helper !== null && helperTests(program, helper);
    }
    return false;
  };
  /** `S.parse(v)` with `v` reading the thrown value. */
  const parseCall = (c: Expression): boolean => {
    if (c.type !== "CallExpression") return false;
    const callee = c.callee;
    const [a] = c.arguments;
    return (
      callee.type === "MemberExpression" &&
      !callee.computed &&
      callee.property.type === "Identifier" &&
      callee.property.name === "parse" &&
      a !== undefined &&
      reads(a) !== null
    );
  };

  let wide = false;
  const under = (guards: readonly Guard[]): boolean => guards.some((g) => narrow(g.test, g.holds));
  /** Each leaf `e` can return, read through `?:`, `&&`, `||`, `??`, `,` and parentheses, under `guards`. */
  const leaves = (e: Expression, guards: readonly Guard[]): void => {
    const b = bare(e);
    if (b.type === "ConditionalExpression") {
      leaves(b.consequent, [...guards, { test: b.test, holds: true }]);
      leaves(b.alternate, [...guards, { test: b.test, holds: false }]);
    } else if (b.type === "LogicalExpression") {
      if (b.operator === "&&") leaves(b.right, [...guards, { test: b.left, holds: true }]);
      else if (b.operator === "||") {
        leaves(b.left, guards);
        leaves(b.right, [...guards, { test: b.left, holds: false }]);
      } else {
        leaves(b.left, guards);
        leaves(b.right, guards);
      }
    } else if (b.type === "SequenceExpression") {
      const last = b.expressions.at(-1);
      if (last !== undefined) leaves(last, guards);
    } else {
      const none =
        (b.type === "Identifier" && b.name === "undefined") || (b.type === "UnaryExpression" && b.operator === "void");
      if (!none && !under(guards)) wide = true;
    }
  };
  /** The returns of `fn`'s own statements, each under the conditions that hold where it stands. */
  const block = (list: readonly Statement[], guards: readonly Guard[]): void => {
    let now = guards;
    for (const st of list) {
      if (st.type === "VariableDeclaration" && st.kind === "const")
        for (const v of st.declarations) {
          const r = v.init === null || v.init === undefined ? null : reads(v.init);
          if (v.id.type === "Identifier" && r !== null) aliases.set(v.id.name, r);
        }
      statement(st, now);
      if (st.type === "IfStatement") {
        if (alwaysExits(st.consequent)) now = [...now, { test: st.test, holds: false }];
        else if (st.alternate !== null && alwaysExits(st.alternate)) now = [...now, { test: st.test, holds: true }];
      }
    }
  };
  const statement = (st: Statement, guards: readonly Guard[]): void => {
    if (st.type === "ReturnStatement") {
      if (st.argument !== null) leaves(st.argument, guards);
    } else if (st.type === "BlockStatement") block(st.body, guards);
    else if (st.type === "IfStatement") {
      statement(st.consequent, [...guards, { test: st.test, holds: true }]);
      if (st.alternate !== null) statement(st.alternate, [...guards, { test: st.test, holds: false }]);
    } else if (st.type !== "VariableDeclaration" && st.type !== "ExpressionStatement") {
      // Any other statement: its own returns stand under the guards around it and no condition of its own.
      new Visitor({
        ReturnStatement: (n) => {
          if (n.start >= st.start && n.end <= st.end && !nestedIn(fn, n, inner) && n.argument !== null)
            leaves(n.argument, guards);
        },
      }).visit(program);
    }
  };
  if (fn.body.type === "BlockStatement") block(fn.body.body, []);
  else leaves(fn.body, []);
  return wide;
}
