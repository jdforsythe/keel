/**
 * The first-paint script of a `client` or `static` document (k.schemes First paint): a classic script, at most 300
 * bytes, that sets `data-k-scheme` on `<html>` from the `keel-scheme` cookie when it is `light` or `dark`, and
 * `data-k-theme` from the `keel-theme` cookie when it has a theme name's form.
 */
export const SCHEME_SCRIPT =
  '(function(){var c=document.cookie,h=document.documentElement,m=/(?:^|; )keel-scheme=(light|dark)(?:;|$)/.exec(c);if(m)h.setAttribute("data-k-scheme",m[1]);m=/(?:^|; )keel-theme=([a-z][A-Za-z0-9]{0,23})(?:;|$)/.exec(c);if(m)h.setAttribute("data-k-theme",m[1])})();\n';
