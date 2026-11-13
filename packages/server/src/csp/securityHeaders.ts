/**
 * The headers every `createApp` response carries (k.security Headers), lower-case names: `nosniff`,
 * `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Frame-Options` and
 * `Permissions-Policy`; with `https` (the caller cookie's rule) also `Strict-Transport-Security`. The policy header
 * is separate (`cspPolicy`).
 */
export function securityHeaders(opts: { readonly https: boolean }): Readonly<Record<string, string>> {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), payment=(), usb=()",
    ...(opts.https ? { "strict-transport-security": "max-age=63072000" } : {}),
  };
}
