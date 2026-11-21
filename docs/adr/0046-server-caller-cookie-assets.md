# ADR-0046: signed `__Host-` caller cookie and hardened asset serving (RFC 0057)

**Status:** accepted

**Context.** Any well-formed `keel-caller` value was a caller, so a sibling subdomain could plant one the attacker knew (red team L3, backlog 0134). Every file under `assets/` was served `immutable`, without `nosniff`, and symlinks were followed out of the build (red team L5, backlog 0136).

**Decision.**
- **Cookie name.** On a secure app the cookie is `__Host-keel-caller` (`Secure; Path=/; HttpOnly; SameSite=Lax`, no `Domain`), and only that name is read. On http it is `keel-caller`.
- **Secure.** `createApp({ secure })` decides it, defaulting to the request URL's scheme. `x-forwarded-proto` is not trusted; behind a TLS-terminating proxy pass `secure: true`.
- **Signature.** The value is `token.mac`: an HMAC-SHA-256 under `createApp({ secret })`, defaulting to 32 random bytes per `createApp`. An unsigned or mis-signed value is no cookie. `caller` is the SHA-256 of the whole value.
- **Secret strength (amendment, backlog 0159).** A `secret` under 32 UTF-8 bytes rejects with E1556. A deployed production start without one logs W1556.
- **Assets.** A file is `immutable` only when the manifest names it and its name ends `-<h>.<ext>`: 8 base64url characters, not all lowercase letters, or a hex run of 8 or more (amendment, backlog 0161). Others are `no-cache`. Every built file carries a weak ETag of its bytes, and `If-None-Match` gets 304. Request paths are decoded before the lookup. Every asset response is `nosniff`. Only files whose real path is inside the real `assets/` are read, and directory links are not descended. The entry must be one of them, else E1555.

**Alternatives.**
- **`__Host-` alone.** It leaves invented and leaked unsigned values valid, and http with no check.
- **An issued-token store.** That is state that grows per browser, for what an HMAC gives statelessly.
- **`x-forwarded-proto`.** Clients can spoof it when no proxy is present.
- **Requiring `secret` in production.** It burdens every test and demo; the random default fails closed.
- **Hashed by name only, or refusing every symlink.** The first pins unknown files. The second blocks harmless in-build links.

**Consequences.**
- **Restarts.** Without a shared `secret`, callers reset on restart and differ per instance, so undo by caller refuses older entries (fail closed). Production passes one secret everywhere.
- **Residual risk.** Plain http, or https behind a proxy without `secure`, can still be planted by a sibling with a signed value it obtained. A held cookie is that caller (not authentication).
- **Caching.** Unhashed and hand-copied files under `assets/` revalidate on every use.
