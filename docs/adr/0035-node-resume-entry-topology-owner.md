# ADR-0035: Node documents load a generated resume entry; the compiler owns `Topology` and `StyleUsage` (RFC 0046)

**Status:** accepted

**Context.** RFC 0037 made island documents load `/@keel/entry.ts`. Only a `client` deployable had one, so a node document with islands loaded a 404 and never resumed (backlog 0111). Freeze review §2 row 13 also found `Topology` and `StyleUsage` defined twice, and `TopologySchema` public although it is looser than `topology()` (backlog 0065).

**Decision.**
- **One entry text.** The resume entry is one app-independent text, `RESUME_ENTRY` (`@keel/compiler/entry/*`, next to `ENTRY_PATH` and `ISLANDS_PATH`). It imports `components` from `/@keel/islands.ts` and calls `resume(document.body, components, { ctx: createCtx({ mode: 'real' }), stores })`.
- **The island map.** The Vite plugin generates `/@keel/islands.ts` by scanning the deployable's `routes.ts` files statically. Each literal route id whose `component` is an imported identifier contributes that import, best effort. `routes.ts` itself never reaches the browser.
- **Which entry the plugin serves.** For a `node` or `static` deployable (`KEEL_DEPLOYABLE`) it serves the resume entry. For a `client` deployable it still serves the `mount` entry.
- **createApp.** It answers GET and HEAD of `/@keel/entry.ts` with the same text, after the same-site check and before route matching. Vite resolves the imports, in the dev server or in `vite build`.
- **Type owners.** `@keel/compiler` comes first in deps order, so it defines `Topology` and `StyleUsage`. Server re-exports `Topology`, and `@keel/ui/css` re-exports `StyleUsage`. The duplicates are deleted, and `TopologySchema` is internal to the server.

**Alternatives.**
- **Importing `routes.ts` in the entry.** This would ship server loaders.
- **Bundling in createApp.** This would put a bundler in the server.
- **A `component` field in `routes.json`.** This is a k.router artifact change.
- **ui owning `StyleUsage`.** The compiler cannot import ui.

**Consequences.**
- **Script resolution.** The script tag and the server agree on one URL in every process. A browser can load it only through Vite. A production node deployable still needs to serve its built client assets (follow-up).
- **Island map size.** The map includes non-island route components, which is more JS than needed.
- **ui dependency.** `@keel/ui` gains a type-only dependency on `@keel/compiler`.
- **`StyleUsage.props` widens.** It is now `Record<string, string>`.
- **`TopologySchema` removed from exports.** Its importers must call `topology()` instead.
