const get = (n: unknown, k: string): unknown => (typeof n === "object" && n !== null ? Reflect.get(n, k) : undefined);

/**
 * Whether an AST subtree holds a call `<name>.secret(...)` for a `name` in `schemas` (the local names of `@keel/schema`'s
 * `s`) or `<ns>.s.secret(...)` for an `ns` in `spaces` (namespace imports of `@keel/schema`).
 */
export function holdsSecretCall(node: unknown, schemas: ReadonlySet<unknown>, spaces: ReadonlySet<unknown>): boolean {
  if (typeof node !== "object" || node === null) return false;
  if (Array.isArray(node)) return node.some((n) => holdsSecretCall(n, schemas, spaces));
  const callee = get(node, "callee");
  const obj = get(callee, "object");
  if (
    get(node, "type") === "CallExpression" &&
    get(get(callee, "property"), "name") === "secret" &&
    (schemas.has(get(obj, "name")) ||
      (get(get(obj, "property"), "name") === "s" && spaces.has(get(get(obj, "object"), "name"))))
  )
    return true;
  return Object.keys(node).some((k) => k !== "parent" && holdsSecretCall(get(node, k), schemas, spaces));
}
