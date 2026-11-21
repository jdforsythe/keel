/** Property `name` of AST node `n`, `undefined` when absent. */
export const field = (n: unknown, name: string): unknown =>
  typeof n === "object" && n !== null ? Reflect.get(n, name) : undefined;
