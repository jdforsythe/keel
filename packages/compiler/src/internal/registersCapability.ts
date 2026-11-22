/** Each package whose export registers a capability, with that export's name. */
const REGISTERING: readonly (readonly [RegExp, RegExp])[] = [
  [/\bfrom\s*["']@keel\/ctx(?:\/[\w./-]+)?["']/, /\bregister\b/],
  [/\bfrom\s*["']@keel\/std-postgres(?:\/[\w./-]+)?["']/, /\bdatabase\b/],
];

/**
 * Whether `source` may register a capability (k.data Dev): it imports `@keel/ctx` and names `register`, or imports
 * `@keel/std-postgres` and names `database`, from the package or any subpath of it (`@keel/std-postgres/server`). A
 * file that does is evaluated again only with the whole server graph, so the registry it registers with starts empty.
 */
export function registersCapability(source: string): boolean {
  return REGISTERING.some(([from, name]) => from.test(source) && name.test(source));
}
