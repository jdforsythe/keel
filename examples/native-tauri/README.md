# native-tauri

One page in a Tauri shell, and no server. `topology.ts` has one deployable, `web`, with `adapter: "client"` and `shells.tauri`; its `id`, `dev.keel.nativetauri`, is the shell's identifier and the scheme it registers. A Tauri shell lists no plugin the app must list itself, so `package.json` holds `@keel/std-tauri` and the Tauri CLI, `@tauri-apps/cli`, at an exact version. The app has no `identity.ts`, so it makes no request to a server.

`keel build` writes the web build to `dist/web/`; `deploy/web/tauri/` holds the Tauri project Keel generates and the repository commits. `KEEL_ORIGIN=http://localhost:4182 keel build --target tauri` builds the shell with `cargo` into `dist/web/tauri/target/debug/native-tauri`.

`test/home.test.ts` renders the page as it runs in the shell (`renderRoute` with `shell`), with the a11y checks every render runs. Run `keel check`, `keel test` and `keel build`.
