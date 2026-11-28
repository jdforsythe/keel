---
"@keel/cli": patch
---

`keel build --target tauri` works on a project with no icon: the build uses Keel's mark unless the app holds its own `deploy/<name>/tauri/icons/icon.png`. `--target capacitor` copies the app's `package.json` beside the shell files, which the Capacitor CLI needs. A failing native tool ends the build with its own error lines (at most 12), and Cargo is found in `$CARGO_HOME/bin` or `~/.cargo/bin` when it is not on `PATH`.
