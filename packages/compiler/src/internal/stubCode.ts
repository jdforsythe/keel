const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * The module a browser build loads in place of a server-only file (k.boundary Browser builds): each of `names` a
 * `serverOnly(file, name)` stub from `router` (the resolved `@keel/router/internal`), and no other import.
 */
export function stubCode(file: string, names: readonly string[], router: string): string {
  const lines = [`import { serverOnly } from ${JSON.stringify(router)};`];
  names.forEach((n, i) => {
    lines.push(`const k${i} = serverOnly(${JSON.stringify(file)}, ${JSON.stringify(n)});`);
    lines.push(`export { k${i} as ${IDENT.test(n) ? n : JSON.stringify(n)} };`);
  });
  return `${lines.join("\n")}\n`;
}
