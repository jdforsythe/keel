# ADR-0164: a shell signs in through the app's auth library (RFC 0142)

**Status:** accepted (orchestrator under the operator's direction of 2026-11-18, and its leave of 2026-11-19 to go ahead on the orchestrator's recommendation; for the operator to confirm).

**Context.** A shell build's pages load from a bundled origin while the identity mount lives on `KEEL_ORIGIN`, so a `MountHref` navigation leaves the app and E1581 refuses the import. Keel is not an authentication library: it mints, stores, rotates and verifies no sign-in credential and sets no sign-in cookie. Shell requests through `ctx.net` already go through one native cookie store per platform, which keeps the caller cookie and which the page cannot read. OAuth providers expect an external browser for native apps. Outbox entries of a user whose sign-in expired are failed for good today.

**Decision.**
- C1: the library's cookie is kept by the shell's native cookie store, as the caller cookie is; Keel adds no credential slot and attaches no token.
- C2: in a shell, a navigation or `Form` to a `MountHref` is a request through `net` with `x-keel: 1`, `accept: application/json` and `redirect: 'manual'`; Keel reads the status and `location` only: a page is navigated to, a path under the mount is fetched again (at most 5), anything else opens in the external browser.
- C3: the external browser (Custom Tabs, an in-app Safari view, the desktop default) runs provider pages; the return is a private-use scheme named by the shell's `id`, read as a redirect target on `KEEL_ORIGIN`; the library's own callback exchanges the code with its verifier cookie from the native store.
- C4: `mount.href` is unchanged in a shell.
- C5: E1581 no longer fires for a `client` deployable with `host` and `shells`; a shell build's `KEEL_ORIGIN` is its host's origin.
- C6: sign-out is the same mount `Form`.
- C7: `writeFor` answers `offline.signin` for a request with no user; the outbox pauses on it, and an owner of `""` holds other owners' entries `queued`.

**Alternatives.** The webview navigating to the API origin (separate cookie stores on iOS and Tauri, the native bridge exposed to a remote page, providers refuse embedded webviews). A bearer token in a secure-storage plugin attached by Keel (Keel storing and sending a credential; script can read it); an app may still do it itself through `bearer`. Absolute `href`s in shell builds (an `Href` per build, and the same navigation fault). Claimed https links as the return (need signing identities Keel does not hold; the runner-up). `ASWebAuthenticationSession` on iOS (native code that differs from Android's path). Failing or re-owning queued writes at expiry (data loss, or writes under no owner).

**Consequences.**
- A shell app signs in, out and through OAuth with the same `identity.ts`, `identity.server.ts` and `fn` as the browser app; nothing in Keel handles the credential.
- The shells gain native dependencies (`@capacitor/browser`, `@capacitor/app`, three Tauri plugins) and a registered scheme; a desktop debug build without a bundle receives no return link.
- What the native stores keep across relaunch, and return-link delivery, are verified only on devices (RFC 0142 Known limits).
- k.return is new and proposed; std.outbox-owner gains a paragraph; k.mount's E1581 and std.offline's Owner sentence change with the conformance commit.
