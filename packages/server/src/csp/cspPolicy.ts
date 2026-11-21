import type { Origins } from "@keel/compiler";

/**
 * The one Content-Security-Policy (k.security Policy), as a header value. With `nonce`: a `node` document's policy,
 * `script-src 'nonce-<nonce>' 'strict-dynamic'` and the report directives; `dev` adds `'unsafe-inline'` to `style-src`
 * for Vite's styles (the server sends it as `Content-Security-Policy-Report-Only`). With `peers`: the policy of a
 * `client` or `static` document (`dist/<name>/csp.txt`, and a `client` `index.html` a `node` host serves),
 * `script-src 'self'`, no nonce and no report directives, `connect-src` adding each `keel-peer` origin.
 * `origins`, the deployable's declaration (k.origins), is the only input that widens it: `img`, `font` and `connect`
 * append to their directive in declaration order (a `connect` origin equal to a peer once, in the peer's place), and
 * `media` and `frame` add `media-src` and `frame-src` after `connect-src`, holding the declared origins alone.
 */
export function cspPolicy(
  input: ({ readonly nonce: string; readonly dev?: boolean } | { readonly peers: readonly string[] }) & {
    readonly origins?: Origins | undefined;
  },
): string {
  const doc = "nonce" in input;
  const src = (k: keyof Origins, head: string, ...more: readonly string[]): string =>
    [`${k}-src${head}`, ...new Set([...more, ...Object.keys(input.origins?.[k] ?? {})])].join(" ");
  return [
    "default-src 'none'",
    doc ? `script-src 'nonce-${input.nonce}' 'strict-dynamic'` : "script-src 'self'",
    doc && input.dev === true ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    src("img", " 'self'"),
    src("font", " 'self'"),
    src("connect", " 'self'", ...(doc ? [] : input.peers)),
    src("media", ""),
    src("frame", ""),
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    "trusted-types keel",
    ...(doc ? ["report-uri /__keel/csp", "report-to keel-csp"] : []),
  ]
    .filter((d) => / /.test(d))
    .join("; ");
}
