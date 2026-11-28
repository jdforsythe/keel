# ADR-0147: std.channels: a `perAnonymous` bound for cookieless opens (RFC 0121)

**Status:** accepted (user, 2026-11-17).

**Context.** An event-stream GET never sets the caller cookie, so every client that has not written opens a channel as caller `""`, and all of them shared one `perCaller` allowance (8 per process). One anonymous client holding 8 streams on a route whose `member` admits `""` shut every other first-time visitor out of live updates.

**Decision.**
- D1: cookieless opens count together against `perAnonymous` (default 64), never against `perCaller`. Config is `std['@keel/std-channels']: { perCaller?, perAnonymous?, maxStreams? }`.
- D2: an open past `perAnonymous` gets `{ kind: 'closed', reason: 'full' }` as its only event, as past `perCaller`; open streams continue.
- D3: a route whose `member` refuses `""` holds no cookieless stream, since `member` runs before the caps.

**Alternatives.**
- Only `maxStreams` for cookieless opens: one client could take the whole pool.
- Keying by client address: a spoofable trust input, and shared addresses.
- Refusing cookieless opens unless a route opts in: repeats `member`.

**Consequences.**
- Shutting out anonymous viewers takes 64 held connections instead of 8, and cookied callers keep their own `perCaller` while the anonymous pool is full.
- Apps with public channels can tune the bound; others change nothing.
- A fair share per anonymous client still needs an identity: an app that needs one mints the caller cookie with a write before it opens the channel.
