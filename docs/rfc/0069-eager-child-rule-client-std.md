# RFC 0069: E1808 flags eager base-element children, and the browser reads std config

Status: accepted (ADR-0058)

## Problem
- **Backlog 0188.** A base element given an eager child (`Box({ children: Input({ label, onInput }) })`) is bound, so its route level is an island (rfc:0067). The child is made before its parent, so at resume it claims the parent's server element: E1253, and the island re-renders on the client. Nothing told the author before the page shipped. RFC 0067 known limit, filed as a follow-up.
- **Backlog 0189.** In the browser `stdConfig(ctx, pkg, Config)` returned `{}`: only `createApp({ std })` bound `.keel/std.json`, and only on the server. An island that reads std config rendered one value on the server and another after resume, and std.sessions `record` in the browser saw no `redact` list. RFC 0066 follow-up "Client deployables".

## Proposal
1. **E1808 (k.ui, `@keel/check`).** In app code, a call to a base element (`Box`, `Text`, `Heading`, `Button`, `Link`, `Image`, `Input`, `TextArea`, `Select`, `Checkbox`) imported from `@keel/ui` whose first argument's `children` is made eagerly reports E1808 at the value. Eager means a call to a base element, a JSX element or fragment, an array holding one, or a same-file `const` whose initializer is one of those (followed through `const` aliases). The callee resolves through the shared rfc:0053 resolver (`@keel/compiler/internal`): a renamed import (`import { Box as B }`), a `const` alias of it, and a namespace import (`ui.Box`) are base elements; a local function named `Box` is not. A thunk (`() => Input(...)`), a string, a signal, `props.children` and a component call are clean. The fix wraps an inline value in `() => `; a `const` binding has no fix, since a thunk returning it still returns a node made first (the message says to move the call into the thunk).
2. **Code choice.** E1808 sits in the k.ui block: the defect is k.ui's resume contract (thunk children claim in document order), like E1805, which `@keel/check` also implements. E175x is the checker's own block (types, structure, budgets).
3. **Std config in an island document (k.module).** When a page has islands, `documentResponse` adds `std` to `#k-state`: the data `createApp({ std })` bound to its ctx, absent when none was bound. `#k-state` is `<script type="application/json">`, a data block that no CSP `script-src` governs, and its JSON is already escaped against `</script>` (`stateJson`). A page without islands loads no JS and carries no `std`.
4. **The resume entry binds it.** `RESUME_ENTRY` calls `bindClientStd(ctx, document.getElementById("k-state")?.textContent)` (`@keel/compiler/std/bindClientStd`) before `resume`. It parses the text and binds `std` with `bindStd` when it is `{ [pkg]: { [moduleId]: JSON } }`; absent, unparsable, or another shape binds nothing (`stdConfig` gives `{}`, as it does for any unbound ctx). Imports are hoisted, so every island module, and every std package it imports, has registered its schema first; a value failing one throws E1158, as at `createApp`.
5. **`client` deployables.** A `client` deployable has no server document: `index.html` is static. Its generated entry (`entryCode`) binds the build's `std.json` data, embedded as a JSON literal, with `bindStd` before the router starts; with no config it imports nothing. In dev, a changed manifest reloads the entry.
6. **Only client-readable config leaves the server** (amended, backlog 0199). A stdlib package whose code reads its config in the browser declares it once at import with `clientStd(pkg)` (`@keel/compiler/std/clientStd`), beside `s.register(pkg, Config)`; the default is server-only. `#k-state` and a `client` entry carry `clientStdData(data, modules)`: `clientStd` packages only, and in each only the served deployable's modules (from its routes on the server, from `topology.ts` in the Vite plugin); `std` is absent when that is empty. In the browser `stdConfig` gives `{}` for any other package or module. The server still binds the whole file. A repo can be private, so `module.ts` being committed does not make its config public; the opt-in is the gate. docs/THREAT-MODEL.md records this.
7. **Tests.** `@keel/testing` is unchanged: `render` and `renderRoute` take `options.ctx`, so a test that needs config binds its own ctx with `bindStd`; the default sim ctx reads `{}`.

## Amendments (red-team 0199, 0201)
- **0199, opt-in.** Item 6 above. std.sessions declares `clientStd('@keel/std-sessions')`: its `redact` list must reach the browser, where `record` redacts. A separate `clientStd` call keeps `s.register` (k.schema) the one way to register a schema; a `registerStdConfig(pkg, Config, { client })` wrapper would be a second one. A key-name heuristic warning (`secret`, `token`) was rejected: names do not decide secrecy, and the opt-in is deterministic.
- **0201, more eager forms.** E1808 also flags a `For`, `If` or `Match` call (`@keel/runtime-dom`) as children, since k.runtime builds its rows or branch at the call; base elements and control flow destructured from a namespace import (`const { Box, Input } = ui`); and a `const` object literal passed as the props (`Box(opts)`), fixed in the literal. Still not followed: `o.f` members, array destructuring (`const [f] = [Input(...)]`), and IIFEs.

## Alternatives
- **Fetch `/.keel/std.json`.** One more request before resume can run, a route `createApp` must serve, and an ordering problem for code that reads config while resuming.
- **Warn on secret-looking `std` keys.** Not deterministic about secrecy, and a value can be sensitive under any name (0199).
- **Embed std in `RESUME_ENTRY` for node deployables.** The entry is app-independent text that `createApp` and the Vite plugin serve alike (RFC 0046); per-app text would split it, and a built entry could disagree with the `std.json` the server bound.
- **A `resume` option for std.** k.runtime would learn a stdlib concern, and k.runtime is at its token limit.
- **E1808 as a type error.** Base elements accept a `Node` child by type (k.ui Standard slots); a node passed down as `props.children` is legitimate.
- **E1758 (k.check).** That block is the checker's own diagnostics, not a component contract.

## Spec diff
- **k.ui.** Rules add "E1808 base element `children` made eagerly (an element call or JSX, or an array or `const` of them) (fix: `() =>`)". The Base elements sentence "A thunk child is made after its parent and claims in document order; an eager `Node` child is made first, so its island re-renders (E1253)." becomes "An eager `Node` child is made first, so its island re-renders (E1253; check E1808)." "whether the token exists is E1801, reported by `check`" becomes "whether the token exists is E1801 (`check`)". 1,488 -> 1,499 tokens.
- **k.module Std config.** Adds "In the browser (rfc:0069) an island document's `#k-state` carries the bound data as `std`, and the resume entry binds it to its ctx before resuming (`bindClientStd(ctx, text)`, `@keel/compiler/std/bindClientStd`); a `client` deployable's entry binds the build's `std.json`. Std config reaches browsers: it holds no secrets." Conformance adds "In an island document of `createApp({ std })`, `#k-state` carries the bound data as `std`, and a route component reading `stdConfig` resumes on a ctx `bindClientStd` bound to it with the server's value; a document from a `createApp` without `std` has no `std`."
- **k.check.** The fix-carrying list adds E1808. Conformance adds "A base element given `children: Input(...)`, also through an aliased import, in an array, or held by a `const`, reports E1808; a thunk, a string or `props.children` does not."
- **k.runtime, k.server.** Unchanged (both at the 1,500-token limit). The resume entry's extra statement and the `std` key of `#k-state` are specified in k.module, where their contract lives.

## Conformance diff
- **Added.**
  - `packages/check/conformance/E1808-eager-child.test.ts` (k.check clause).
  - `packages/server/conformance/module-std-config-client.test.ts` (k.module clause), happy-dom, property seed 1337: random configs round-trip `createApp({ std })` -> document -> `bindClientStd` -> `stdConfig` in a resumed island.
- **Edited (rfc:0069).** `packages/check/conformance/fixtures-by-code.ts` gains the E1808 fixture (rfc:0065: one per reported code); `fix-applies.test.ts` gains an E1808 case; `fix-diffs.test.ts` gains an E1808 case, E1808 in its fix-bearing list, and the edited clause text in its header.
- **Unit tests.** `packages/check/test/eagerChild.test.ts` (message, location, fix text, conditional and logical values, bindings without a fix, shadowed and type-only imports, test files, nesting); `packages/compiler/test/std-client.test.ts` (property seed 1337: `bindClientStd` round-trips random configs; absent or misshapen `std` binds nothing; E1158; the resume entry binds before `resume`; property: a `client` entry embeds and binds the data before the router; the Vite plugin's client entry); `packages/compiler/test/islands.test.ts` matches the new resume entry lines.

## Migration
- **App code.** None found: no app passes a base element an eager child (the `children: [title, submit]` calls in the golden apps are router `Form`, not a base element). A hit moves the element into a thunk.
- **Markup.** Island documents of a `createApp({ std })` with config gain `"std":{...}` in `#k-state`.

## Token impact
k.ui 1,488 -> 1,499; k.module 1,328 -> 1,473; k.check 1,234 -> 1,278.

## Known limits
- E1808 does not follow a binding across files or through a function's return, an `o.f` member, array destructuring or an IIFE, and does not flag a component call (`Box({ children: Card(props) })`, a component may return a string) or a mapped list (`children: xs.map((x) => Text(...))`).
- A server whose `std.json` changes while it runs keeps the data it bound at startup; so do its documents.
