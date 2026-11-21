/** Whether an AST subtree holds a call `<x>.secret(...)` (`s.secret`). */
export function holdsSecretCall(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  if (Array.isArray(node)) return node.some(holdsSecretCall);
  if (Reflect.get(node, "type") === "CallExpression") {
    const callee: unknown = Reflect.get(node, "callee");
    const prop: unknown = typeof callee === "object" && callee !== null ? Reflect.get(callee, "property") : undefined;
    if (typeof prop === "object" && prop !== null && Reflect.get(prop, "name") === "secret") return true;
  }
  return Object.keys(node).some((k) => k !== "parent" && holdsSecretCall(Reflect.get(node, k)));
}
