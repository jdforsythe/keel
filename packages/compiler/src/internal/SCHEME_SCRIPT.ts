/**
 * The first-paint scheme script of a `client` or `static` document (k.schemes First paint): a classic script, at most
 * 300 bytes, that sets `data-k-scheme` on `<html>` from the `keel-scheme` cookie when it is `light` or `dark`.
 */
export const SCHEME_SCRIPT =
  '(function(){var m=/(?:^|; )keel-scheme=(light|dark)(?:;|$)/.exec(document.cookie);if(m)document.documentElement.setAttribute("data-k-scheme",m[1])})();\n';
