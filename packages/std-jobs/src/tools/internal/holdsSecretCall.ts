/** Whether an AST subtree holds a call `<name>.secret(...)` for a `name` in `schemas` (the local names of `@keel/schema`'s `s`). */
export function holdsSecretCall(node: unknown, schemas: ReadonlySet<string>): boolean {
  if (typeof node !== "object" || node === null) return false;
  if (Array.isArray(node)) return node.some((n) => holdsSecretCall(n, schemas));
  if (Reflect.get(node, "type") === "CallExpression") {
    const callee: unknown = Reflect.get(node, "callee");
    const prop: unknown = typeof callee === "object" && callee !== null ? Reflect.get(callee, "property") : undefined;
    const obj: unknown = typeof callee === "object" && callee !== null ? Reflect.get(callee, "object") : undefined;
    if (
      typeof prop === "object" &&
      prop !== null &&
      Reflect.get(prop, "name") === "secret" &&
      typeof obj === "object" &&
      obj !== null &&
      schemas.has(String(Reflect.get(obj, "name")))
    )
      return true;
  }
  return Object.keys(node).some((k) => k !== "parent" && holdsSecretCall(Reflect.get(node, k), schemas));
}
