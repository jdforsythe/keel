# native-tauri

One page in a Tauri shell, and no server. `topology.ts` has one deployable, `web`, with `adapter: "client"` and `shells.tauri`; its `id`, `dev.keel.nativetauri`, is the shell's identifier and the scheme it registers. `keel scaffold project native-tauri --workspace`, then `keel scaffold shell tauri --id dev.keel.nativetauri`, wrote `topology.ts` and `package.json` as they are: the shell's name `Native Tauri` comes from the package name, and `package.json` holds `@keel/std-tauri` and the Tauri CLI, `@tauri-apps/cli`, at the exact version `@keel/std-tauri` declares. A Tauri shell lists no plugin the app must list itself. The app has no `identity.ts`, so it makes no request to a server.

`keel build` writes the web build to `dist/web/`; `deploy/web/tauri/` holds the Tauri project Keel generates and the repository commits. `keel build --target tauri` builds the shell with `cargo` into `dist/web/tauri/target/debug/native-tauri`. The topology has no `node` deployable, so the build reads no `KEEL_ORIGIN` and the shell sends no request: it has no `origins.connect`, and the build writes no `capabilities/http.json`.

`test/home.test.ts` renders the page as it runs in the shell (`renderRoute` with `shell`), with the a11y checks every render runs. Run `keel check`, `keel test` and `keel build`.
