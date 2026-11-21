const FROM_CTX = /\bfrom\s*["']@keel\/ctx["']/;
const REGISTER = /\bregister\b/;

/**
 * Whether `source` may call `@keel/ctx`'s `register` (k.data Dev): it imports `@keel/ctx` and names `register`. A file
 * that does is evaluated again only with the whole server graph, so the registry it registers with starts empty.
 */
export function registersCapability(source: string): boolean {
  return FROM_CTX.test(source) && REGISTER.test(source);
}
