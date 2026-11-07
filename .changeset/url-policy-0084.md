---
"@keel/runtime-dom": minor
"@keel/compiler": minor
"@keel/ui": patch
---

One URL policy (red-team 0084). `@keel/runtime-dom/url` (kernel packages only) exports `URL_ATTRS`, `RAW_HTML_ATTRS`, `isSafeUrl`, `safeUrl`; the `./internal/safeUrl` subpath is removed. The compiler's E1003 now uses the runtime's allow-list over the same attributes (`poster`, `ping`, `xlink:href` included; any `srcdoc` rejected) and carries a removal fix; static templates render about:blank exactly when the runtime would. `@keel/ui` imports from `@keel/runtime-dom/url`.
