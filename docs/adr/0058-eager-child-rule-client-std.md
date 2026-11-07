# ADR-0058: E1808 flags eager base-element children; the browser binds std config (RFC 0069)

**Status:** accepted

**Context.**
- A base element given an eager child (`Box({ children: Input(...) })`) is an island that cannot resume in place: the child claims its parent's server node (E1253) and the island re-renders (backlog 0188, RFC 0067 known limit).
- `stdConfig` in the browser returned `{}`: only `createApp({ std })` bound `.keel/std.json`, on the server (backlog 0189, RFC 0066 follow-up).

**Decision.**
- **E1808 (k.ui block, `@keel/check`).** A base element call imported from `@keel/ui` (renamed, `const`-aliased or through a namespace, via the rfc:0053 resolver) whose `children` is a base element call, JSX, or a conditional, logical, array or same-file binding holding one. Fix: `() => ` before an inline value; none for a binding.
- **Island documents carry `std` in `#k-state`.** Only when the page has islands and `createApp` bound std. A JSON data block, so CSP-neutral and escaped like the rest of `#k-state`; config is tiny.
- **The resume entry binds it** with `bindClientStd(ctx, #k-state text)` before `resume`. Absent or misshapen binds nothing; a registered schema failure throws E1158.
- **A `client` deployable's entry** embeds the build's `std.json` data and calls `bindStd` before the router starts.
- **Only client-readable config reaches browsers** (amended, backlog 0199). `clientStd(pkg)` opts a package in (default server-only); documents and `client` entries carry `clientStdData`: opted-in packages, served deployable's modules only. std.sessions opts in (`redact` runs in the browser).
- **E1808 covers `For`/`If`/`Match` children, destructured namespaces and `const` props objects** (backlog 0201).

**Alternatives.**
- Fetch `/.keel/std.json` (an extra request before resume, a new served path).
- Per-app resume entry text (splits the app-independent entry of RFC 0046).
- A `resume` option (k.runtime would learn a stdlib concern; k.runtime is at its token limit).
- E1758 in the checker's own block.

**Consequences.**
- Island documents of a `createApp({ std })` with config gain `"std"` in `#k-state`; `RESUME_ENTRY` imports `@keel/compiler/std/bindClientStd`.
- `@keel/testing` is unchanged: a test passes its own ctx bound with `bindStd`; the default sim ctx reads `{}`.
- `@keel/check` size re-based for the rule (handoff D7).
- **Known limits.** E1808 does not follow bindings across files or through function returns, `o.f` members, array destructuring or IIFEs, and does not flag component calls or mapped lists (`xs.map(...)`). A running server keeps the std data it bound at startup.
