# Red team 6

Scope: `git diff de073d1a..HEAD -- . ':!packages/std-offline' ':!apps/golden-1'`, against RFC 0124, 0121, 0115, 0114, 0116 and 0117. Nothing was run in `packages/std-offline` or `apps/golden-1`. All probe files are deleted. Probe builds used the repo's Vite 8.3.6 in a temp project with `@keel/*` linked. Node 24.19.0, ICU 78.3, host tz 2026b.

Counts: HIGH 0, MEDIUM 4, LOW 6.

## Findings

### 1. MEDIUM: std-live abandons hung reads without cancelling them, so they pile up (about 60 an hour)
- Where: `packages/std-live/src/live.ts:48`. `Promise.race([attempt(() => opts.read(ctx)), bounded])` gives up on a read after 30 s, but `read` gets no signal, so the request stays open. One read later the bound starts the next one.
- Probe (ran): a vitest file in `packages/std-live/test/` (deleted) used the conformance fixtures (`controlled()` reads that never settle) and ticked the sim clock in 10 s steps.
  - With no saves, after 1 sim hour: `calls 62, status connecting`.
  - With one `server.save` every 10 s, after 10 sim minutes: `calls 21`.
  - After `dispose`, no more reads start (held).
- Impact: in a browser each abandoned read is a fetch still in flight. HTTP/1.1 allows 6 connections per origin, and the event stream already holds one. So within about 6 minutes of a hanging backend, every other fetch to that origin queues behind the dead reads, including the user's writes. "One read at a time" holds for the reads `live` counts, not for the ones on the wire.
- Fix: pass an `AbortSignal` to `read` (`read(ctx, { signal })`, which a loader or service call forwards to `ctx.net.fetch`). Abort it at the bound and on dispose. Add a conformance bullet: an abandoned read's signal is aborted.

### 2. MEDIUM: `ctx.dispose()` on the shared app ctx is reachable from any component or loader, and one call silently stops `net` events for the whole page
- Where: `packages/ctx/src/Ctx.ts:16`, `packages/ctx/src/createCtx.ts` (realNet `dispose` sits on the public `Ctx`).
- Probe (reasoned from the code and the conformance bullet; not run): the generated entry (`entryCode.ts:62`, `resumeEntry.ts:23`) makes one real ctx and passes it to every island and component. An island that calls `ctx.dispose()` in its own cleanup removes the window `online`/`offline` listeners for all of them. The method's name invites exactly that, since a component's cleanup is where people call `dispose`. After that, `observe` sees no `net` event. Reconnect-driven work (sync drain, live status) never hears that the network came back, while `ctx.net.online()` keeps reading `navigator.onLine` correctly. Nothing reports an error.
- Principles: before this, a capability object could only be read. Now it carries an irreversible, page-wide teardown that any holder can trigger.
- Fix: take `dispose` off `Ctx`. Hand it only to the creator: `createCtx` returns `{ ctx, dispose }` through an internal overload, or `disposeCtx(ctx)` from `@keel/ctx/internal` keyed by a WeakMap. std-sessions is the only caller today.

### 3. MEDIUM: `line`/`para` still accept values that show nothing: U+2800, U+FFF9 to U+FFFB, and combining marks alone
- Where: `packages/std-text/src/textCheck.ts:7` (`VISIBLE = /[^\p{White_Space}\p{Default_Ignorable_Code_Point}]/u`).
- Probe (ran): node script calling `textCheck(1, 80, false|true)`. Each of these passed both `line` and `para`:

  | Input | What it is |
  |---|---|
  | `"⠀"` | Braille blank. The usual "invisible name" trick, rendered blank in common fonts. |
  | `"￹"`, `"￹￺￻"` | Interlinear annotation characters, invisible in most renderers |
  | `"́"`, `"́̂̃̄̅"` | Combining marks with no base |
  | `"\u{13430}"` | Egyptian format control |
  | `"⠀⠀​"` | Braille blanks plus a zero-width space |
  | `""` | Private use |
  | `"￿"` | Noncharacter |

  These were correctly refused: lone VS16, lone `E0100`, tag characters, Hangul fillers (3164, 115F, 1160, FFA0), 180E, ZWSP, 2060, 2062, soft hyphen, CGJ, 17B4, 1BCA0, 1D173, U+3000, U+1680.
- Impact: RFC 0116's stated rule ("a visible character") is bypassed by the best-known blank character (U+2800), so blank display names and titles get through.
- Fix: make `VISIBLE` exclude U+2800, U+FFF9 to U+FFFB, `\p{M}` and `\p{Co}`/`\p{Cn}`, so the visible character must be a base character. Add conformance cases for `"⠀"`, `"￹"` and `"́"`.

### 4. MEDIUM: `TimeZone.check` still asks the host's `Intl`, so parse and gen depend on the host again, and a value one host accepts another refuses on decode
- Where: `packages/std-temporal/src/TimeZone.ts:19` (`check: pinnedZones().names.has(v) && intlAccepts(v)`) and `:22` (`gen` maps into the pinned Zone names and does not ask `Intl`).
- Probe:
  - Ran, on this host: Intl accepts all 597 pinned names, and the host lists no zone missing from the pin. Prototype keys (`constructor`, `__proto__`, `toString`, `hasOwnProperty`) were refused. So were case variants (`utc`, `america/new_york`), a trailing space, a ZWSP, a Cyrillic `А` look-alike, `Z`, `+05:00`, `UTC+1` and `US/Pacific-New`. All held.
  - Reasoned, not run (no older ICU on this machine): a browser with older tz data (for example Safari before tz 2022g has no `America/Ciudad_Juarez`, and pre-2025b ICU has no `America/Coyhaique`) refuses names the server accepted. A server-stored value then fails `parse` in that client's loader decode, which breaks the whole result. On that host `gen` can also draw a name `parse` refuses, which breaks "for every value gen produces, parse accepts it". That is the cross-host split RFC 0117 set out to remove.
- Fix: let the pinned list alone decide validity (drop `intlAccepts` from `check`). Make `formatInstant`/`plainDateOf` fall back (the Link target, then `UTC` with a typed error) when the host's `Intl` refuses a pinned name.

### 5. LOW: the build-production-mode conformance test's `"production"` assertion passes whatever the entry's mode is
- Where: `packages/cli/conformance/build-production-mode.test.ts:60` (`PRODUCTION = /["'`]production["'`]/`).
- Probe (ran): `keel build` of the same client fixture. The production-built bundle holds `production` in 3 places, and 2 of them are kernel code that is always present, whatever mode the entry carries:
  - `function Xt(e,t=\`production\`)` (rootFallback default)
  - `l=n.mode===\`dev\`?\`dev\`:\`production\`` (router)
  - `vr=\`production\`` (the entry; the only one that matters)

  Only the `not.toContain("/__keel/inspect")` assertion tells dev and production apart.
- Fix: assert the entry's binding (the literal passed as `mode:` in the `createRouter`/`mount` call), or assert that no `` `dev` `` literal flows into `mode:`. Or build once under Vite `serve` as a negative control that the assertion fails.

### 6. LOW: a project `vite.config.ts` that sets `process.env.NODE_ENV` makes app code see `import.meta.env.DEV === true` under `keel build`, against k.deploy Build's "`import.meta.env.DEV` is `false`"
- Where: `packages/cli/src/internal/viteRun.ts:16`. Vite reads `process.env.NODE_ENV` again after it loads the config file (vite `node.js:37686`).
- Probe (ran): fixture `vite.config.ts` with top-level `process.env.NODE_ENV = "development"` and a route reading `import.meta.env.DEV`. `keel build` printed `ok build 3 files, 6 artifacts, 0 errors`, and the bundle held the app's dev-only marker (`appdev true`).
  - The kernel held: no `/__keel/inspect`, and the entry's mode literal stayed `production`.
  - The same held with `mode: "development"` plus `define` of `import.meta.env.DEV` and `process.env.NODE_ENV`.
- Fix: the spec sentence should limit its claim to the shell and `.env`, or the plugin's `config` hook should return `define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" }` when `command === "build"`.

### 7. LOW: the plugin's `command` defaults to `"serve"`, so if `load` runs before `configResolved` the entry is a dev entry
- Where: `packages/compiler/src/vite.ts:163` (`let command = "serve"`), `:441` (`config.command ?? "serve"`), `:493`.
- Probe (reasoned): a host that runs the plugin outside Vite's lifecycle (a Rolldown-only build, or a test harness) gets `mode = "dev"` and the inspect reporter.
- Fix: default to `"build"` so the entry fails closed. A real dev server always sets `command`.

### 8. LOW: `perAnonymous`, `perCaller` and `maxStreams` are read from the opener's module but count every module's streams in the process
- Where: `packages/std-channels/src/server/internal/full.ts` (counts all `hub.sinks`) and `channelRoute.ts:59` (`cfg` is `[module]`). `hubOf(ctx)` is one hub per process ctx.
- Probe (reasoned): module A serves a public channel with `perAnonymous: 1000`, and module B sets `perAnonymous: 4`. Four anonymous streams on A make every cookieless open on B `closed` `full`. The spec's "of all cookieless opens together" does not say whether that means per module.
- Fix: count only sinks whose route's module equals the opener's (store `module` on the `Sink`), or state in the spec that the bounds are per process across modules.

### 9. LOW: `line`/`para` accept lone surrogates
- Where: `packages/std-text/src/textCheck.ts:19`. No `isWellFormed` check.
- Probe (ran): `"\uD800"` passes `line` and `para`. JSON.parse of a request body yields one.
- Impact (reasoned): node:sqlite stores the value as UTF-8 with U+FFFD in its place, so the stored value is not the one that was validated. A Postgres `jsonb` write refuses the unpaired `\ud800` escape, so the action fails as `keel.unexpected`.
- Fix: add `!v.isWellFormed()` to the refusal, in `textCheck`, or in `s.string` for every string.

### 10. LOW: `TimeZone.parse` builds a new `Intl.DateTimeFormat` on every call
- Where: `packages/std-temporal/src/TimeZone.ts:6`.
- Probe (ran): 100,000 parses of `"America/New_York"` took 2,745 ms (about 27 µs each). A loader result of 10,000 rows with a zone field costs about 270 ms of main-thread decode. Refusals are cheap (100,000 refusals of a 1,000-character string took 182 ms).
- Fix: cache the `intlAccepts` answer per name (at most 597 entries), or drop it as in finding 4.

### Informational (RFC 0116 choice, not counted)
`'שלום‏'` is refused, because LRM, RLM and ALM are forbidden by decision. Mobile keyboards and pasted chat text often carry these marks, so a Hebrew or Arabic user sees a bare `format` refusal for text that looks correct to them. Consider stripping the three marks in the form layer before parse, or a field message that names them.

## Probes that held
- RFC 0124:
  - `keel build` with no `NODE_ENV`; with a hostile `vite.config.ts` (`mode: "development"`, `define` of `import.meta.env.DEV` and `process.env.NODE_ENV`, top-level `process.env.NODE_ENV="development"`): no `/__keel/inspect` in the bundle, and the entry is `vr=\`production\``.
  - Read only: `shellBuild` (`--target tauri|capacitor`) also forces `NODE_ENV=production`, and the shell entry's mode follows `command`, so it is production.
  - Read only: `vite preview` never runs `load`, so it serves the built (production) bundle.
  - Read only: `keel dev` listens on Vite's default (localhost). Its `/__keel/inspect` refuses a non-loopback `Host` and a cross-origin `Origin` not listed in `KEEL_INSPECT_ORIGINS`.
  - Read only: node `createApp` serves `resumeEntry(d)` as `"production"`, and the built `server.mjs` gets its own mode from `createApp` options, not from build-time `NODE_ENV`.
- RFC 0121 (read only):
  - `perAnonymous` 0 or a negative value is refused by the schema (`s.int({ min: 1 })`). A huge value leaves `maxStreams` in charge.
  - A garbage or expired cookie gives caller `""`, as documented.
  - An aborted or erroring stream leaves the hub: `finally { leave() }` runs through `liveStream`'s `it.return()`, and `inbox.next(signal)` resolves on abort.
  - The count and the join happen in the same turn, so two opens cannot both pass the cap.
  - Minting cookies (one action POST each) gives more streams under `perCaller`, but it cannot shrink `perAnonymous`. The process pool is `maxStreams`, as the spec states.
- RFC 0115 (read only): a second `dispose` is a no-op; on a sim ctx or a `drivers` net, `dispose` does nothing; a fetch in flight is unaffected by `dispose`.
- RFC 0114 (ran): after `dispose` no read starts (0 calls in 2 sim minutes after a save). A late read adds nothing (the conformance test covers this). Clock timers are cleared on abort (`realClock` `clearTimeout`).
  - Not counted as a finding: after `dispose`, the returned `status()` throws `E1205 read of a disposed computed` instead of returning a status. That is the kernel's rule for disposed computeds.
- RFC 0116 (ran): ZWJ emoji (family, England flag tag sequence, keycap, skin tone), Arabic and Hebrew text without controls, Devanagari with ZWJ, Malayalam and Persian with ZWNJ, and Korean all pass. Every Default_Ignorable-only value listed in finding 3 is refused.
- RFC 0117 (ran): see finding 4. Prototype keys, case variants, Unicode look-alikes, whitespace, offsets and removed names are all refused, and linked names are accepted.

## Proposed backlog lines (`## Red team`)
- 0770 MEDIUM std-live: an abandoned read keeps its request open (62 unsettled reads per sim hour with a hanging read); pass `read` an AbortSignal aborted at the 30 s bound and on dispose. Repro: a vitest with the `controlled()` fixture that ticks 360 × 10 s and counts `c.calls()`.
- 0771 MEDIUM ctx: `dispose` on the shared `Ctx` lets any island cut page-wide `net` events; hand it only to the creator (internal `disposeCtx`). Repro: real ctx under a stub window, `observe`, `ctx.dispose()`, dispatch `online`: no `net` event.
- 0772 MEDIUM std-text: `line` and `para` accept `"⠀"`, `"￹"` and `"́"` (blank on screen); require a visible base character. Repro: `node -e` importing `textCheck(1,80,false)` on those inputs.
- 0773 MEDIUM std-temporal: `TimeZone.check` still calls `Intl`, so an older-ICU client refuses a pinned name the server stored, and `gen` can draw one it refuses; let the pin decide and fall back in formatting. Repro: reasoned; run the conformance on an ICU before tz 2022g.
- 0774 LOW cli conformance: `build-production-mode.test.ts:60` matches kernel `"production"` defaults, so the mode assertion is vacuous; assert the entry's `mode:` binding. Repro: `grep -o '.\{40\}production.\{20\}' dist/web/assets/*.js`.
- 0775 LOW cli/compiler: a `vite.config.ts` that sets `process.env.NODE_ENV` gives app code `import.meta.env.DEV === true` under `keel build`; define DEV and PROD in the plugin for builds, or narrow the k.deploy sentence. Repro: a fixture config with top-level `process.env.NODE_ENV="development"`, then `keel build`, then grep for the app marker.
- 0776 LOW compiler: the plugin's `command` defaults to `"serve"` (`vite.ts:163`); default it to `"build"` so the entry fails closed.
- 0777 LOW std-channels: the bounds read the opener module's config but count every module's sinks; count per module or say so in the spec.
- 0778 LOW std-text: `line` and `para` accept lone surrogates (`"\uD800"`); refuse `!isWellFormed()`.
- 0779 LOW std-temporal: `TimeZone.parse` costs about 27 µs per valid name (a new `Intl.DateTimeFormat` each time); cache per name.
