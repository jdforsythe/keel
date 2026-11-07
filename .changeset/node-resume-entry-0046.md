---
"@keel/compiler": minor
"@keel/server": minor
"@keel/ui": minor
---

RFC 0046: a node `createApp` answers GET/HEAD `/@keel/entry.ts` with the generated resume entry (`@keel/compiler/entry/RESUME_ENTRY`: imports `components` from `/@keel/islands.ts`, calls `resume(document.body, components, { ctx, stores })`); the Vite plugin serves it for a `node`/`static` `KEEL_DEPLOYABLE` and generates `/@keel/islands.ts` from the deployable's `routes.ts` component imports (static, best effort). `Topology` and `StyleUsage` are defined once, in `@keel/compiler` (`@keel/server` re-exports `Topology`; `@keel/ui/css` re-exports `StyleUsage`, whose `props` is `Record<string, string>`); `TopologySchema` is no longer exported (use `topology()`).
