import { type Node, type Program, Visitor } from "oxc-parser";

/** What a `return`, `break` or `continue` may target, and the `finally` blocks between it and its target. */
type Frame = {
  readonly kind: "function" | "loop" | "switch" | "label" | "finally";
  readonly node: Node;
  readonly label?: string;
};

/**
 * The start offsets of the `return`, `break` and `continue` statements whose target lies outside the `finally` block
 * holding them (k.errors Rules E1452): a `return` inside a `finally` of its own function, a `break` or `continue`
 * whose loop, `switch` or label encloses that `finally`. One offset per statement, however many `finally` blocks lie
 * between it and its target. A nested function is its own target for a `return`.
 */
export function finallyExits(program: Program): number[] {
  const out: number[] = [];
  const stack: Frame[] = [];
  const finalizers = new Set<Node>();
  const push = (kind: Frame["kind"], label?: string) => (node: Node) =>
    void stack.push(label === undefined ? { kind, node } : { kind, node, label });
  const pop = (node: Node): void => {
    if (stack[stack.length - 1]?.node === node) stack.pop();
  };
  /** Whether a `finally` frame lies above the first frame `target` accepts, within the current function. */
  const leaves = (target: (f: Frame) => boolean): boolean => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i];
      if (f === undefined || f.kind === "function") return false;
      if (f.kind === "finally") {
        for (let j = i - 1; j >= 0; j--) {
          const g = stack[j];
          if (g === undefined || g.kind === "function") return target({ kind: "function", node: f.node });
          if (target(g)) return true;
        }
        return false;
      }
      if (target(f)) return false;
    }
    return false;
  };
  const loop = push("loop");
  const fn = push("function");
  new Visitor({
    FunctionDeclaration: fn,
    "FunctionDeclaration:exit": pop,
    FunctionExpression: fn,
    "FunctionExpression:exit": pop,
    ArrowFunctionExpression: fn,
    "ArrowFunctionExpression:exit": pop,
    StaticBlock: fn,
    "StaticBlock:exit": pop,
    ForStatement: loop,
    "ForStatement:exit": pop,
    ForInStatement: loop,
    "ForInStatement:exit": pop,
    ForOfStatement: loop,
    "ForOfStatement:exit": pop,
    WhileStatement: loop,
    "WhileStatement:exit": pop,
    DoWhileStatement: loop,
    "DoWhileStatement:exit": pop,
    SwitchStatement: push("switch"),
    "SwitchStatement:exit": pop,
    LabeledStatement: (n) => void stack.push({ kind: "label", node: n, label: n.label.name }),
    "LabeledStatement:exit": pop,
    TryStatement: (n) => {
      if (n.finalizer !== null) finalizers.add(n.finalizer);
    },
    BlockStatement: (n) => {
      if (finalizers.has(n)) stack.push({ kind: "finally", node: n });
    },
    "BlockStatement:exit": pop,
    ReturnStatement: (n) => {
      if (leaves((f) => f.kind === "function")) out.push(n.start);
    },
    BreakStatement: (n) => {
      const label = n.label?.name;
      const hit =
        label === undefined
          ? leaves((f) => f.kind === "loop" || f.kind === "switch")
          : leaves((f) => f.kind === "label" && f.label === label);
      if (hit) out.push(n.start);
    },
    ContinueStatement: (n) => {
      const label = n.label?.name;
      const hit =
        label === undefined ? leaves((f) => f.kind === "loop") : leaves((f) => f.kind === "label" && f.label === label);
      if (hit) out.push(n.start);
    },
  }).visit(program);
  return out;
}
