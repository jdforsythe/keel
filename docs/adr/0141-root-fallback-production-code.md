# ADR-0141: the root fallback shows `keel.unexpected` in production (RFC 0119)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** The app root's default Boundary, for a `mount` tree and each resumed island, rendered the thrown error's message into the page in every build. A message can hold internal paths, queries or a person's data. The server already answers an uncaught throw with `keel.unexpected` and message `unexpected` in production (`createApp({ mode })`, default `production`); the client root fallback had no production mode.

**Decision.**
- D1: `mount` and `resume` take `mode: 'dev' | 'production'`, default `production`, the values and default of `createApp`'s `mode`.
- D2: in `production` the root fallback is `<pre data-k-error="<at>">keel.unexpected</pre>`; in `dev` it holds the message. The ctx report and `onError` get the full error in both.
- D3: the generated client and resume entries pass `mode` from `import.meta.env?.DEV` (`dev` in a dev build, else `production`); `@keel/runtime-dom` reads no build environment itself.
- D4: the test harness passes no `mode` and reads errors from `onError`.

**Alternatives.**
- `import.meta.env` inside the runtime: ties the kernel to Vite and cannot be driven both ways in one test run.
- Default `dev`: a caller that forgets the option leaks the message.
- An empty fallback: a person sees nothing where the tree was.

**Consequences.**
- No production page shows an unexpected error's message; support and recorders read it from the ctx report.
- Tests that read the root fallback's text pass `mode: "dev"` or read `onError`.
- docs/THREAT-MODEL's Mode line covers the client root fallback.
