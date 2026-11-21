# ADR-0047: `x-forwarded-proto` upgrades only, W1557, and the server DOM selector subset (RFC 0060)

**Status:** accepted. Amends the Secure clause of ADR-0046.

**Context.** Behind a TLS-terminating proxy the request URL is `http:`, so the default `secure` (the URL's scheme) set an unprefixed, non-`Secure` caller cookie that a sibling subdomain can plant (red team 0160). The server DOM under plain Node had no `querySelector`, so any compiled template that binds an element below its root answered 500 (red team 0156).

**Decision.**
- **Secure.** `createApp({ secure })` decides it. Unset, a request is https when its URL is or when its first `x-forwarded-proto` value is `https`. The header only upgrades and never downgrades. A deployed production start without `secure` logs W1557.
- **Fixation.** Over plain http the cookie stays plantable by a sibling holding a validly signed value. The server cannot tell how a cookie was set, so this is documented as residual risk, not mitigated. https with `__Host-` closes it.
- **Selectors.** The server DOM answers `querySelector`, `querySelectorAll`, `matches` and `closest` for a type or `*`, `#id`, `.class`, `[name]` and `[name=value]`, compounds and `,` lists. Any other selector throws a `SyntaxError` naming it.
- **Form controls.** `input`, `select`, `textarea` and `option` are their own classes and globals (`HTML*Element`). `name` and `disabled` reflect. `value`, `checked` and `selected` are state, never markup, as in a browser.
- **errorElement.** It renders in a render unit, like a component.

**Alternatives.** Compiler-emitted `getElementById` refs: detached clones are in no document. A diag for `x-forwarded-proto` over http: noisy, and the cookie stays plantable. Trusting the header both ways: it allows a downgrade. Serializing control values: server HTML would diverge from a browser's for the same tree.

**Consequences.**
- **Spoofing.** A client that spoofs `x-forwarded-proto` over plain http only gets a `Secure` cookie its browser drops.
- **Proxies.** A proxy that forwards a client's header unchanged on an http hop has the same effect: no persistent caller (fail closed).
- **Size.** `@keel/server` is 13,692 bytes gzip, and its budget is 13.5 kB.
- **Forms.** Server-rendered controls show no bound values until resume. Whether `@keel/ui` should write a `value` attribute is open.
