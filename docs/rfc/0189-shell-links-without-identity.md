# RFC 0189: k.shell: a shell delivers page links with or without an identity source

Status: implemented (ADR-0211). Amends k.shell (Shell ctx) and k.links (Testing). From `examples/links-in` (examples finding 8).

## Decisions
- D1: k.links stands. A shell build delivers return links whether or not the project has `identity.ts`: a page link is a client-side navigation, at launch or while running.
- D2: the shell's link listener belongs to the shell entry. The identity mount is one consumer of it: with `identity.ts` it adds that mount's paths and the external browser; without it, only page links are taken and every other link is ignored.
- D3: one entry point stays: the package's `shellMount(ctx, { id, origin, mount? })`, `mount` optional. Rejected: a second, links-only export, which gives each shell package two listeners to keep in step.
- D4: the harness delivers what the build delivers. `renderRoute(..., { shell })` already takes only page links when no identity mount is registered; the spec now says so, and a clause holds it.
- D5: two clauses at `none`: k.shell#9 (the entry calls `shellMount` without `mount`) and k.links#12 (page links reach a project with no identity source; a mount-looking link does not). k.shell and k.links read `implemented` until both are covered.

## Problem
`examples/links-in` is a `client` deployable with `shells.tauri` and no `identity.ts`. Under `renderRoute(..., { shell: { id } })`, `returnLink` and `launch` each land on the linked page. A `keel build --target tauri` of the same project takes no link: `packages/compiler/src/vite.ts` passes the deployable's `shells` to `entryCode` only when `identity.ts` exists, so the entry never calls `shellMount`, the only code that listens for deep links (`getCurrent`, `onOpenUrl`; Capacitor's `getLaunchUrl`, `appUrlOpen`). The generated shell files still register the scheme, so the OS opens the app on the link and the page stays where it was.

The spec disagrees with itself. k.links: "A link from outside reaches a page as a web link does". k.shell (Shell ctx): "With `identity.ts` the entry calls the package's `shellMount(...)` ... then delivers return links (k.links)", which ties delivery to the identity source. The harness follows k.links and the build follows k.shell, so a test passes for an app whose build ignores every link.

## Proposal
### Shell ctx (k.shell)
Before the router starts, a shell build's entry calls the package's `shellMount(ctx, { id, origin, mount? })`, `id` the shell's. It listens for the shell's return links, reports the launch once, then delivers each (k.links), with an identity source or without one. With `identity.ts`, `mount` is its default export: the listener also takes that mount's paths, and each URL the router hands it opens in the external browser (k.return). Without one, page links are delivered and every other link is ignored: no path is under a mount, so none is a mount request and none takes an opening.

### Testing (k.links)
`renderRoute(..., { shell })` delivers what a shell build delivers: with no identity source, page links only. The harness's mounts are the registered identity mounts, so it needs no change.

### What does not change
k.return, k.opening, the link kinds and their order in k.links, the launch report, the shell files (the scheme was already registered for every shell), std.capacitor and std.tauri's listener text.

## Alternatives
- **Amend k.links: page links only with an identity source.** Rejected (D1): a page link needs no mount, and the scheme the shell registers would open the app on a link it then drops.
- **A links-only export beside `shellMount`.** Rejected (D3): two listeners per package, each dropping the repeated launch link, kept in step by hand.
- **The harness refuses links without an identity source.** Rejected (D4): it would make the harness match a build that contradicts k.links.
- **No scheme registration without `identity.ts`.** Rejected: the same contradiction with k.links, and an app that wants page links only would have to declare an identity source.

## Spec diff
Applied in this commit:
- **k.shell**, Shell ctx: the `shellMount` sentence above replaces "With `identity.ts` the entry calls ...". Conformance gains clause 9: "The `www` entry of a project with no `identity.ts` calls the package's `shellMount` with the shell's `id` and no `mount`, before the router starts; with `identity.ts`, with its default export as `mount`."
- **k.links**, Testing: "`renderRoute(..., { shell })` delivers what a shell build delivers: with no identity source, page links only." Conformance gains clause 12: in a project with no identity source, `returnLink` and `launch` of a page link each navigate there; a link to `/api/auth/callback?code=c` sends nothing through `net` and leaves the page where it was.
- **Status**: k.shell and k.links `implemented` in each section and `spec/00-map.md`.
- **Ledger**: k.shell#9 and k.links#12 at `none`.

## Conformance
By the `conformance-writer`, under `rfc:0189`, from the spec text alone:
- k.shell#9 in `packages/compiler/conformance/`: the shell entry `entryCode` writes for a project with and without `identity.ts`, with the stub shell package.
- k.links#12 in `packages/testing/conformance/` (beside the k.links clauses): a routes table with `/` and `/about`, no identity mount, `shell: { id: 'dev.keel.linksin' }`.
Spec topics: `pnpm spec k.shell`, `pnpm spec k.links`; for context `pnpm spec k.return`.

## Build
- `packages/compiler/src/vite.ts`: pass `shellOf(all[d.name]?.shells)` to `entryCode` whatever the project holds, so a shell build always has the shell's `id`.
- `packages/compiler/src/internal/entryCode.ts`: in a shell build, import and call `shellMount` with `id` and `origin` always, and `mount: __keelIdentity` only with `identity`; import `identity.ts` only with `identity`.
- `@keel/std-tauri` and `@keel/std-capacitor` `shellMount`: `mount` optional, `mounts: mount === undefined ? [] : [mount]` to `mountRequests`; the doc comments say the listener runs with or without an identity source.
- `examples/links-in`: its smoke proof covers a built shell entry; finding 8 closes.
- Size: a few lines in each; no bundle grows for a project with `identity.ts`. A shell project without one gains the shell package's link listener and `mountRequests`, under 1 kb.

## Migration
None: unreleased.

## Token impact
k.shell gains about 60 tokens, k.links about 80; both stay under the section budget (2,350).
