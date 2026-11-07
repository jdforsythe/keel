---
"@keel/server": minor
---

Compiled templates render under plain Node (backlog 0156). The server DOM `createApp` installs without a DOM global now answers `querySelector`, `querySelectorAll`, `matches` and `closest`, so a page whose template binds an element below its root no longer fails with 500. The selector subset is a type or `*`, `#id`, `.class`, `[name]` and `[name=value]`, compounds of them and `,` lists; any other selector throws a `SyntaxError`. Inputs, selects, textareas and options are form controls as in a browser, so `@keel/forms` and `@keel/ui` controls render. `name` and `disabled` reflect their attributes; `value`, `checked` and `selected` are state and never appear in the markup. A `<template>` in parsed HTML keeps its children in `content`. A route's `errorElement` renders in its own render unit, so a compiled one shows its 404 instead of a 500.

The caller cookie follows `x-forwarded-proto` (backlog 0160, RFC 0060). With `secure` unset, a first `x-forwarded-proto` value of `https` makes the request https: `__Host-keel-caller` with `Secure` behind a TLS-terminating proxy. The header never makes an https URL count as http. A deployed production start without `secure` logs one W1557; pass `createApp({ secure: true })` in production.
