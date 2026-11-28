# links-in

A link from outside the app opens a page inside its Tauri shell. The `web` deployable in `topology.ts` is a `client` with `shells.tauri`, and the shell's `id`, `dev.keel.linksin`, is the scheme it registers. A link such as `dev.keel.linksin:/places/oslo`, from a mail or another app, lands on `/places/oslo` as a web link to that page would: the router matches it, guards run and loaders read. A link of another scheme, or to a path no page matches, changes nothing.

`test/linksIn.test.ts` runs the pages as in the shell (`renderRoute` with `shell`): a link while the shell runs, a link the shell was launched with, and two links it ignores. Run `keel check`, `keel test` and `keel build`; `keel build --target tauri` builds the shell, with no `KEEL_ORIGIN`, as the topology has no `node` deployable. The built shell hands page links to the router with or without an `identity.ts`; the project has none, so it takes page links only.
