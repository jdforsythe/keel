# RFC 0139: sign-in outlives the caller: a durable sign-in in `@keel/std-credentials`, `user` beside `caller`, a session-only caller unless a deployable opts in

Status: draft, for the orchestrator to accept (ADR-0161).

## Problem
Each claim below was read in the code on 2026-11-18.

The caller cookie (`packages/server/src/internal/callerOf.ts`, `CALLER_COOKIE.ts`, `issueCaller.ts`) is `__Host-keel-caller` (https, `Secure`) or `keel-caller`, `HttpOnly; SameSite=Lax; Path=/`, with no `Max-Age`: an anonymous per-browser token minted on the first write, HMAC-signed, whose SHA-256 loaders and actions see as `caller`. `docs/THREAT-MODEL.md` (Caller identity): "It is not authentication: anyone who holds the cookie is that caller."

`@keel/std-credentials` gives password `hash`/`verify` (std.credentials) and token `mint`/`check` (std.tokens), and no sign-in. golden-2's `accounts` module ties being signed in to the caller: `Session.schema.ts` is `{ caller, userId }`; `signIn.ts` keeps one session per caller in the store `accounts.sessions`; `submitSignIn.server.ts` writes `{ caller, userId }`; `loadAccount.server.ts` and `postToken.server.ts` find the session by `caller`. So a browser quit signs the user out, and so does every relaunch of a shell: Capacitor removes session cookies at start and stop, iOS keeps them for the process only, Tauri's cookie store saves only persistent cookies (RFC 0132 Proposal 4; `tasks/0338-s8-reach/proposed/s8-shells.md`). Outbox entries queued under a signed-in owner (std.outbox-owner: "the signed-in user's id, else ''") are then refused with `offline.owner`, not sent, after the restart.

Other readers of `caller` as a person: std.sessions' `sessions.reader` admits a `caller` hash listed in `readers` (a hash that changes with every browser restart); std.channels' `member` gets `caller`; golden-3's organizers and "my sign-ups" key off the caller hash (`evals/tasks/golden-3/TASK.md`). Undo is scoped by `tx` meta `{ caller }` (golden-1 `postUndo.server.ts`, `loadBoard.server.ts`).

RFC 0132 posed one choice for the caller cookie: "session" or "persistent" (`Max-Age` 400 days). This RFC supersedes that choice: the caller stays session-only, sign-in gets its own durable cookie, and a deployable may opt in to a persistent caller.

## Proposal
Two new sections, status proposed: `k.user` (kernel: `user`, the sign-in cookie, the `signin` handle, caller lifetime) and `std.signin` (the package: token, rows, rotation, end, shells). k.server (5,993 characters), k.security (5,998) and std.credentials (5,842) are full.

### D1. The caller stays session-only; it is not a credential
No `Max-Age` by default: a browser quit or shell restart is a new caller, which is what an anonymous identity should be. Undo stays scoped by caller (one browser's own writes), stream caps stay per caller. Alternative rejected: **persistent caller for everyone** (RFC 0132's second option: every browser gets a 400-day identifier to fix a sign-in problem, and the caller would still not be a credential).

### D2. A sign-in has its own durable cookie, kept by `@keel/std-credentials`
- **Cookie** (k.user): `__Host-keel-signin` (`Secure`) on https, else `keel-signin`; `HttpOnly; SameSite=Lax; Path=/; Max-Age=<seconds left>`. Separate from the caller cookie; neither changes the other.
- **Where `user` reaches server code:** beside `caller`, in the same argument object: guards, loaders (live too) and actions get `user: string` (`""` for no one); `renderRoute({ user })` as `{ caller }`. Not in `ctx`: `ctx` holds capabilities that are the same for every request (k.ctx), while `caller` and `bearer` are per-request arguments; `user` follows them (principle 1: one place for request identity).
- **Signing in and out:** an action's args gain `signin` with `start(userId)`, `end()`, `endAll()`. Only actions: a GET changes no sign-in, so a link or an image cannot sign anyone in or out.
- **Seam:** `createApp({ signin: signins })`, `signins` exported by `@keel/std-credentials/server`; the generated entries (`server.mjs`, `keel dev`, the in-process peers) pass it when a served module lists the package in `deps`. The kernel owns the cookie transport and `user`; the package owns tokens and rows. Without the package `user` is always `""` and the cookie is never read.
- **Lifetime chosen by the app:** std config `signin: { days, idleDays, perUser }` (defaults 30, 30, 32; ranges 1–400, 1–`days`, 1–256; the lowest across modules wins, as the strictest module's wish).
- **Token and rows:** std.tokens' token form (256 random bits); the package's store `credentials.signins` in `ctx.storage` holds `{ id, digest, userId, made, seen, prev? }`: the SHA-256 digest, never the token; `userId` is `.pii('identifier')`; constant-time comparison (`timingSafeEqual`); `seen` written at most hourly.
- **Rotation:** a sign-in older than 24 h gets a new secret (same `id`) on its next request; the old one proves the user for 60 s (requests in flight), and presented later ends the sign-in (two holders: one is a copy). A wrong secret for a known `id` ends nothing, so a guess cannot sign someone out.
- **Revocation:** `end()` (this browser), `endAll()` (every sign-in of `user`: sign out everywhere; also what a password change calls); a deleted row proves no one at the next request in every tab and device. Expiry: `made + days` absolute, `seen + idleDays` idle.
- **Limits:** `perUser` sign-ins per user; past it the oldest `seen` ends. Rate-limiting sign-in attempts stays the operator's, as for ingest.

Alternatives rejected: **a kernel-only sign-in** (the operator placed it in `@keel/std-credentials`, beside the hashes and tokens it builds on; the kernel keeps only transport); **sign-in as a store the app writes, as golden-2 does** (every app re-implements rotation, revocation and fixation defence); **a signed self-contained cookie (no rows)** (no revocation before expiry, no sign-out everywhere); **`user` in `ctx`** (per-request identity in the per-app capability object; two places to look).

### D3. Security posture
- **CSRF:** `SameSite=Lax` plus k.server's same-site check, which runs before anything on every write, so a cross-site form cannot sign in (login CSRF), act or sign out. `Lax`, not `Strict`, so a link from another site arrives signed in; a GET runs loaders only. An origin in `KEEL_ALLOW_ORIGINS` gets the cookie only where the browser sends it (same-site), as the caller today.
- **Fixation:** `start` ends the presented sign-in and mints a new token; it never adopts a presented or planted value. The caller cookie is not a credential, so a planted caller (THREAT-MODEL's http residual risk) gains nothing.
- **Theft in shells:** D4. **Stored server-side:** digests only, so a leaked store signs no one in.
- **Limit:** a copied browser token works until ended, expired or caught by rotation; an event stream keeps the `user` it opened with until it closes.

### D4. Shells keep the sign-in in secure storage
The shell's native client keeps the sign-in cookie in a secure slot, never in its cookie store or the `storage` driver, sends it to `KEEL_ORIGIN` only, and never gives it to the page (no read API; `set-cookie` already never reaches the page, std.shells):
- Capacitor Android (`KeelHttpPlugin.java`): the value encrypted (AES-GCM) under a non-exportable Android Keystore key, in the plugin's private preferences, excluded from backup; the `set-cookie` is taken from the response before `CookieHandler` stores it.
- Capacitor iOS (`KeelHttpPlugin.swift`): a Keychain generic-password item, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (not in backups or iCloud); cleared on the first start after an install, since Keychain items outlive an uninstall.
- Tauri (`@keel/std-tauri`): today `net` is `@tauri-apps/plugin-http`, whose Rust cookie jar would keep a persistent cookie in clear, and whose response headers reach page JavaScript. The package gains a Rust plugin that carries own-origin requests and holds the slot in the OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service); with no keyring the slot lasts the process (signed out at restart, never written in clear).
So a sign-in outlives restarts, the caller does not, and outbox entries queued under the user flush after a relaunch. Alternatives rejected: **the cookie store** (Android's WebView cookie database and Tauri's jar are files in clear); **the `storage` driver** (`@capacitor/preferences` and `plugin-store` are plain files); **a header token the page holds** (page JavaScript, and so any injected script, could read and send it elsewhere).

### D5. Per-user keys
- Outbox owner (std.outbox-owner): `user`. An app writes `writeFor(input.write, user)`.
- Undo: stays `caller` (D1).
- Channels: `member` gets `user` beside `caller`; caps stay per caller.
- std.sessions `readers`: admits a request whose `user` or `caller` it lists; listing user ids keeps a reader across browser restarts.

### D6. A persistent caller, opted in per deployable
`topology.ts`: `caller: { days }` on a `node` deployable (1–400; else E1578, new, k.server's block): a caller cookie it mints carries `Max-Age=days × 86,400`, from that write, never extended (a rolling identifier would never end). For continuity without accounts (golden-3's "my sign-ups" and organizer list). Privacy: the caller hash is then a long-lived device identifier, so k.privacy treats it as a `.pii('network')` value (the class names device ids): std.sessions' capture replaces a recorded `meta.caller`; the evidence bundle's `pii.json` records `caller: { days, class: 'network' }`, and `{ days: null, class: null }` without the option, so an auditor sees the choice. Alternative rejected: **per app** (topology is per deployable, and a peer's cookies are its own origin's); **unbounded or sliding** (an identifier that never ends).

## Spec diff
- New `spec/kernel/k.user.md`, status proposed: intro, User, Sign-in cookie, Actions, Caller lifetime, Rules (E1578), seven Conformance bullets. 3,750 characters, 938 tokens.
- New `spec/std/std.signin.md`, status proposed: intro, Config, Token, Rotation, Start and end, Forgery and theft, Shells, Per user, nine Conformance bullets. 4,929 characters, 1,233 tokens.
- `spec/00-map.md`: row `k.user` after `k.leave`; `k.user` added to E155x's owners; one-line cells trimmed (k.sync, k.forms, k.guards, k.router, k.head, k.prefix, k.host). 1,195 to 1,192 tokens. `spec/std/README.md`: row `std.signin`.
- No existing bullet changes, so the ledger does not move. Prose that describes today's code changes with the build (commit 3), each measured within its budget:
  - k.server API: loader `fn` gets "`{ params, search, url, caller, user, bearer, stores }`"; action "`{ params, url, caller, user, signin, stores }`" (with RFC 0138's `#k-state` edit, 5,993 to 5,997 characters).
  - k.guards: "`caller` and `user` are k.server's and k.user's (`''` if none or client-only);" (1,235).
  - k.shell Shell ctx: "stay in the shell's cookie store, the sign-in cookie in its secure slot (std.signin), and go only to their origin." (5,925).
  - std.sessions Ingest: "`user` or `caller` in `readers`, else 403." (5,995).
  - std.channels: "`member` is a pure predicate over the request's `caller` and `user`," (5,972).
  - std.outbox-owner Write: "`owner` being the request's `user` (k.user): the id its pages give `send` and `drain`, `""` when signed in as no one."; its code line `writeFor(input.write, user)` (2,431).
  - k.evidence `pii.json` row: "…at `probabilistic` or higher; `caller` (k.user)" (4,732).

## Conformance diff
One `rfc:0139` commit by the `conformance-writer`, files headed `Spec: k.user` or `Spec: std.signin`.

**User and cookie** (`packages/server/conformance/user-signin.test.ts`, `createApp` with a fixture `signin` slot double that maps token `t1` to `u1`, under a sim ctx; and with `signins` from the package for one end-to-end case):
- After an action calling `signin.start('u1')`: the next request's guard, loader and action each record `user` `'u1'`; `renderRoute(id, { user: 'u1' })` gives its loader `'u1'`.
- On https the `set-cookie` is `__Host-keel-signin=…; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=<n>` (attribute order free); on http `keel-signin` with no `Secure`; the response sets no caller cookie when the request had one.
- `signin.end()` and `endAll()` responses carry `Max-Age=0`; the next request's `user` is `''`.
- Negative: an unknown or forged sign-in cookie gives `user` `''` and a clearing `set-cookie`; with no `signin` slot, a `keel-signin` cookie gives `user` `''`, no `set-cookie` for it, and `start` returns `err` `keel.unexpected`; a loader's args have no `signin`.
- A cross-site POST (`Sec-Fetch-Site: cross-site`) to the sign-in action is 403 and sets no cookie.

**Caller lifetime** (`packages/server/conformance/caller-lifetime.test.ts`, `packages/check/conformance/caller-days.test.ts`, `packages/cli/conformance/evidence-caller.test.ts`):
- No option: the minted caller cookie has no `Max-Age`. `caller: { days: 30 }`: `Max-Age=2592000`; a request presenting it gets no new caller cookie.
- E1578 for `{ days: 0 }`, `{ days: 401 }`, `{ days: 1.5 }`, and `caller` on a `client` deployable; `{ days: 400 }` on `node` is clean.
- `pii.json` of a fixture with `caller: { days: 30 }` has `caller: { days: 30, class: 'network' }`; without, `{ days: null, class: null }`.
- A std.sessions capture of a `tx` with `meta: { caller }` under `caller: { days: 30 }` holds a generated value, not the hash; without the option, the hash.

**Sign-in** (`packages/std-credentials/conformance/signin.test.ts`, sim ctx, `createApp` with `signins`):
- The row after `start('u1')` holds `digest` = base64url SHA-256 of the token and no field equal to the token or containing its secret.
- One secret character changed, or a token of another form: `user` `''`, row kept.
- `days: 1`: proves `u1` at 23 h 59 m, `''` at 24 h, row gone. `idleDays: 1` with `days: 30`: unused 24 h, `''`.
- At 25 h a request gets a new token with the same `id`; the old token at +59 s is `u1`; at +61 s `''`, and the new token is then `''` too.
- `start('u2')` presenting `u1`'s token: that token is `''`; with a planted `keel-signin` value the new cookie's value differs from it.
- `perUser: 2`: a third `start('u1')` ends the oldest-`seen` one.
- `endAll()` from one of three `u1` sign-ins: all three `''`; a `u2` sign-in still `u2`.
- `seen` is written once for 100 requests within an hour (storage write count).
- Config: `signin: { days: 0 }`, `{ idleDays: 31 }` with `days: 30`, `{ perUser: 257 }` are each E1158; two modules with `days` 30 and 7 give 7.

**Shells** (`packages/std-capacitor/conformance/signin-slot.test.ts` against the `fakeKeelHttp` native double, `packages/std-tauri/conformance/signin-slot.test.ts` under `mockIPC`):
- A response from `origin` with `set-cookie: __Host-keel-signin=…` reaches the page with no `set-cookie`, the cookie store double holds no `keel-signin`, and the slot double holds the value; the next request to `origin` carries it in `cookie`; one to another origin does not.
- A `Max-Age=0` answer empties the slot; the slot double exposes no read to the page (`Object.keys` of the plugin's JS surface).
- iOS double: the first start with no install marker clears the slot.

**Per user** (`packages/std-channels/conformance/member-user.test.ts`, `packages/std-sessions/conformance/readers-user.test.ts`): `member` receives `user`; `readers: ['u1']` admits a request signed in as `u1` with any caller, and still admits a listed caller hash.

## Migration
- `@keel/server`: `createApp({ signin })`, `user` and `signin` in guard, loader and action args, the cookie (`callerOf.ts` beside a new reader), `caller.days` from the topology (`TopologySchema.ts`, `issueCaller.ts`), `start.ts` and the dev entry pass `signins`; README.
- `@keel/router`: arg types gain `user` (and `signin` for actions); `@keel/testing` `renderRoute({ user })`.
- `@keel/std-credentials`: `signins` slot, store `credentials.signins`, config schema `signin`; README; `spec/std/std.credentials.md` unchanged.
- `@keel/std-capacitor` (`KeelHttpPlugin.java`, `KeelHttpPlugin.swift`, `test/fakeKeelHttp.ts`), `@keel/std-tauri` (a Rust plugin and `tauriNet.ts`): D4.
- `@keel/std-channels` (`member` args), `@keel/std-sessions` (`sessions.reader`, capture of `meta.caller` under `days`), `@keel/std-offline` README (`writeFor(input.write, user)`).
- `@keel/check`: E1578; `@keel/cli` evidence: `pii.json` `caller`.
- golden-2 `accounts`: `submitSignIn.server.ts` calls `signin.start(user.id)` in place of `tx(stores.signIn, …)`; `loadAccount.server.ts` and `postToken.server.ts` read `user`; `Session.schema.ts`, `Sessions.schema.ts`, `signIn.ts` and the `sessions` store in `accountStores.ts` are removed; `module.ts` sets `std: { '@keel/std-credentials': { signin: { days: 30 } } }`; `test/accounts.test.ts` (the "one session per caller" property becomes a sign-in round trip); `.keel/surface.json` regenerated; README.
- golden-1: unchanged (`writeFor(…, "")`, undo by caller).
- Evals, call shape only: `evals/tasks/golden-2/spec-slice.txt` lines 68 and 69 gain `user` (and `signin`); `evals/tasks/golden-2-catalog/spec-slice.txt` if it lists the arg shapes; `evals/tasks/golden-3/TASK.md` keeps its caller-keyed `owner` and organizers and adds `caller: { days: 400 }` to its node deployable.
- Docs: `docs/THREAT-MODEL.md` (Caller identity: session-only, the opt-in and its class; a Sign-in commitment: cookie, digests, rotation, revocation, fixation, shells' slots, the copied-token limit; Outbox: the owner survives restarts); `docs/GLOSSARY.md` gains **sign-in** (distinct from **session**, a recording); skills `.claude/skills/keel-server/SKILL.md` (`user`, `signin`), `keel-deploy` (`caller.days`, shells' keyring), `keel-compliance` (the persistent caller's class, `pii.json`).

## Build order
1. This RFC, ADR-0161, k.user and std.signin (commit 1).
2. `conformance-writer`: the conformance diff (commit 2), red.
3. Builders (commit 3): the Migration; the prose of the Spec diff; changesets; k.user and std.signin to `conformance-covered`. Native slots that cannot run in CI are proven against the doubles; a device run is recorded as in RFC 0132.

## Token impact
k.user 938 and std.signin 1,233 (new). Map 1,195 to 1,192. Each edited section stays at or under 1,500 after the build's prose.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: the caller stays session-only and grants nothing (D1).
- C2: `@keel/std-credentials` keeps a durable sign-in in its own cookie; `user` sits beside `caller`; `signin` only on actions; the kernel holds the transport behind `createApp({ signin })` (D2).
- C3: rotation every 24 h with a 60 s overlap and reuse detection; `days`/`idleDays`/`perUser` chosen by the app (D2, D3).
- C4: shells hold the sign-in in a native secure slot the page cannot read; Tauri gains a Rust plugin (D4).
- C5: outbox owner by `user`; undo by `caller`; channels and readers see both (D5).
- C6: a node deployable may opt in to a caller of 1 to 400 days, classed `network` and recorded in `pii.json` (D6).
