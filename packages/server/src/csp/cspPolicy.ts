/**
 * The one Content-Security-Policy (k.security Policy), as a header value. With `nonce`: a `node` document's policy,
 * `script-src 'nonce-<nonce>' 'strict-dynamic'` and the report directives; `dev` adds `'unsafe-inline'` to `style-src`
 * for Vite's injected styles (the server sends it as `Content-Security-Policy-Report-Only`). With `peers`: the policy of a
 * `client` or `static` document (`dist/<name>/csp.txt`, and a `client` `index.html` a `node` host serves),
 * `script-src 'self'`, no nonce and no report directives, `connect-src` adding each `keel-peer` origin.
 * There is no other input: no app widens the policy.
 */
export function cspPolicy(
  input: { readonly nonce: string; readonly dev?: boolean } | { readonly peers: readonly string[] },
): string {
  const doc = "nonce" in input;
  return [
    "default-src 'none'",
    doc ? `script-src 'nonce-${input.nonce}' 'strict-dynamic'` : "script-src 'self'",
    doc && input.dev === true ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    doc ? "connect-src 'self'" : ["connect-src 'self'", ...input.peers].join(" "),
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    "trusted-types keel",
    ...(doc ? ["report-uri /__keel/csp", "report-to keel-csp"] : []),
  ].join("; ");
}
