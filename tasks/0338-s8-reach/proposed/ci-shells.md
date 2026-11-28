# CI shell jobs (backlog 0809, the CI half of 0609)

## What the design asks

RFC 0085:
- D3: "CI as Proposal 9 lists: Linux jobs per PR touching golden-1 (Tauri build and replay, Android debug APK) with a `postgres:17` service container pinned by digest; the Android emulator replay nightly once green on a developer machine; the iOS job on `macos-15` on manual dispatch only."
- Exit criterion: "golden-1's `web` ships from CI as a Tauri Linux binary and an Android debug APK, a recorded session replayed inside the Tauri shell gives the server state its sim replay gives".
- Proposal 9, Tauri row: "`keel build --target tauri` (apt packages, `tauri-driver` pinned and cached), `tooling/smoke/shell.mjs --shell tauri` under `xvfb-run`: applies user 0's `fire` and `nav` inputs from the S4 group session to the shell over WebDriver by element id, then compares the server's `api.board` with `replayGroup`'s (ids normalized by first appearance); stops the API, toggles `t2` (outbox queues it), quits the app, starts the API and the app, and sees the write drain from the persisted outbox | every PR touching `apps/golden-1`, artifact uploaded".
- Proposal 9, Android rows: "`keel build --target capacitor --platform android` (debug APK) | every PR touching `apps/golden-1`, artifact uploaded"; the emulator replay "nightly once it holds green on a developer machine (D3)"; iOS "manual dispatch on `macos-15`".
- Tools table: "Tauri, Linux | Rust 1.95+ (`tauri` 2.12.5 requires it), `libwebkit2gtk-4.1-dev`, `build-essential`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` | GitHub `ubuntu-24.04`"; "Capacitor, Android | Node 22+, JDK 21, Android SDK (API 36, min 24) | `ubuntu-24.04` (SDK preinstalled, JDK 21 installed beside the default 17)".
- k.shell CI: "The generated workflow gains a job per shell on its deployable's paths: Tauri on Ubuntu (WebKitGTK packages), Capacitor Android on Ubuntu (JDK 21), each uploading its artifact; Capacitor iOS on macOS, on manual dispatch only."

## What existed

- The repository's own workflow (`tooling/ci.source.json`) had no shell job.
- `packages/scaffold/src/templates/ciWorkflow.ts` already writes shell jobs, but into the `.github/workflows/ci.yml` of a project outside the monorepo (k.shell CI): `<name>-tauri`, `<name>-android`, `<name>-ios`. Those are "the CI shell jobs" of 0609. They are not this repository's CI and were not changed (packages/ is out of scope). Gaps seen there, for a later change: no `timeout-minutes`, no Cargo or Gradle cache, `KEEL_ORIGIN` from `vars.KEEL_ORIGIN` (unset is E1574), and the Tauri artifact path under `dist/` (see Finding 1).
- The replay script `tooling/smoke/shell.mjs` does not exist, nor any WebDriver client or `tauri-driver` install. `replayGroup` exists (std.sessions), and the S4 group session is the hidden acceptance test's (`evals/tasks/golden-1-api`), not a committed file.

## Jobs added (`tooling/ci.source.json`, `ci.yml` regenerated)

Both `needs: check` only, so they run beside the test shards and neither hides the other's failure; skipped on scheduled runs (as `check` is); `ubuntu-24.04` as the RFC names; `KEEL_ORIGIN=http://localhost:4182`; actions pinned by major tag as the rest of the workflow; no secret.

| job | steps | limit | caches | expected cold / warm |
|---|---|---|---|---|
| `shell-tauri` | setup; apt `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev xvfb xauth` (Tauri 2's Debian list, which is the RFC's; `patchelf` is only for AppImage bundles, and the build is `--no-bundle`); `rustup` stable; `keel build --target tauri` in golden-1 with `CARGO_TARGET_DIR=.cargo-target`; `xvfb-run -a node tooling/ci-shell.mjs .cargo-target/debug/golden-1`; upload the binary (7 days) | 30 min | Cargo registry and `.cargo-target`, keyed on the shell's `Cargo.lock` and `Cargo.toml`; pnpm store | 6-10 min / 3-4 min |
| `shell-android` | setup; `actions/setup-java@v4` Temurin 21; `keel build --target capacitor --platform android` in golden-1 (it runs `cap add`, `cap sync` and `./gradlew assembleDebug` itself, so no second Gradle step); upload the APK (7 days) | 25 min | `~/.gradle/caches` and `wrapper`, keyed on golden-1's `package.json` (the Capacitor version); pnpm store | 8-12 min / 4-6 min |

Path filtering ("PR touching apps/golden-1") is not added: no job in this workflow filters by path, and the shell build also depends on `packages/` (compiler, cli, std-tauri, std-capacitor). The jobs run on every push and pull request; a path filter is the operator's call (it saves two jobs per run on changes that cannot affect the shells).

No turbo cache restore: `keel build --target` runs from the packages' `src` exports (Node 22 type stripping); the Docker run below built with no `pnpm build`.

## The replay

The RFC's replay is `tooling/smoke/shell.mjs --shell tauri` driving the shell over WebDriver (`tauri-driver` with WebKitWebDriver) with the S4 group session's user 0 inputs, comparing the server board with `replayGroup`'s, then the outbox drain across an app restart. None of it exists: the script, a WebDriver client dependency, the `tauri-driver` install (a `cargo install tauri-driver --locked` plus `webkit2gtk-driver` from apt), and a committed group session to replay. Writing them is a test-tooling task beyond this lane; it should land with the session file it replays.

What the job runs instead, `tooling/ci-shell.mjs` (new): starts golden-1's built `api` (`dist/api/server.mjs`, port 4181, throwaway secret and SQLite file), a recording proxy at `KEEL_ORIGIN` (4182) forwarding to it, and the debug binary under Xvfb; it passes when the app's native HTTP client (`tauri-plugin-http`) reads `GET /api/lists` within 90 s and the app is still running 5 s later, else E0014 with the requests seen and the app's last 20 output lines. So it proves the shell starts on Linux WebKitGTK, loads its entry, runs the app's JS and reaches the server at `KEEL_ORIGIN`. It stops all three processes and removes its temp folder.

## Local proof (Docker, `ubuntu:24.04` arm64, `--cpus 2 --memory 7700m`, container `keel-ci-shell`, removed with its image afterwards)

- apt list above: installed in 34 s; `pkg-config --modversion webkit2gtk-4.1` `2.52.6`. Node 22.22.0, `rustup` stable `cargo 1.100.0`, `pnpm install --frozen-lockfile` (HEAD copied in with `git archive`).
- `KEEL_ORIGIN=http://localhost:4182 pnpm exec keel build --target tauri`: `ok build web tauri dist/web/tauri/target/debug/golden-1`, exit 0, 66 s cold (registry download included); binary 246,781,912 bytes.
- `xvfb-run -a node tooling/ci-shell.mjs .cargo-target/debug/golden-1`: `ok ci-shell 3 requests (6.1s)`; the requests: `GET /api/lists`, `GET /api/board/events`, `GET /api/lists`, each `origin tauri://localhost`, `agent tauri-plugin-http/2.9.0`. No `golden-1` process left. Failure paths: `/bin/false` gives `E0014 the shell read no GET /api/lists through KEEL_ORIGIN before it exited (1); 0 requests`; a missing path gives `E0014 no shell binary at ...`.
- Android not proven locally: the container is arm64 Linux, and the Android build tools Gradle fetches (`aapt2`) ship for x86_64 Linux only. The first proof is the CI run.

## Findings (source changes, not made here)

1. **`keel build` empties `dist/<name>/` on every build, Cargo's target with it.** Vite's `emptyOutDir` for the `client` deployable (`packages/compiler/src/vite.ts`) removes `dist/web/tauri/target`: a marker file there was gone after the next build, and the rebuild took 60 s on 2 cores again. With `CARGO_TARGET_DIR` outside `dist/`, the next build took 9 s. The job uses `CARGO_TARGET_DIR`; then the build's trailer still names `dist/web/tauri/target/debug/golden-1`, which does not exist (the binary is `.cargo-target/debug/golden-1`). Proposal: keep Cargo's target outside `dist/` by default (for example `deploy/<name>/tauri/target`, gitignored, or a `.keel/` folder) and name the real path in the trailer, or have `shellBuild` honour `CARGO_TARGET_DIR` in the trailer. k.shell's trailer text (`dist/web/tauri/target/debug/golden-1`) would change: an RFC.
2. The replay tooling above is missing (`tooling/smoke/shell.mjs`, `tauri-driver`, a committed group session).

## Operator's choices

- **iOS job.** Not added. The RFC allows `macos-15` on manual dispatch. On a private repository macOS minutes count ten times Linux minutes; a Capacitor iOS simulator build (`cap add ios`, Swift package resolution, `xcodebuild` without signing) is about 10-20 minutes, so 100-200 Linux-equivalent minutes per dispatch. The local attempt (s8-shells.md section 5) stalled in Xcode's package download, so the first dispatch may also need `xcodebuild -resolvePackageDependencies` as its own step. Adding it is a `workflow_dispatch` trigger plus one job.
- **Android emulator replay.** Not added. An emulator without hardware acceleration does not boot API 36 within a sane limit on 2 cores; with KVM (hosted Linux runners can enable it with a udev rule, as `reactivecircus/android-emulator-runner` documents) it may fit, unmeasured here. Either way there is no replay script to run in it (the same missing smoke), and D3 puts it nightly once green on a developer machine. The emulator run on record is the local one (s8-shells.md section 3).
- **Path filter** on the two shell jobs (above).

## Watch on the first run

- `shell-tauri`: the apt step on `ubuntu-24.04` x86_64 (package names are the same as on arm64); the cold Cargo build time on 2 x86_64 cores (66 s in Docker on a fast host; expect 3-6 min); `ci-shell` under Xvfb on a host without a GPU (the script sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` and `LIBGL_ALWAYS_SOFTWARE=1`); the upload (about 250 MB before compression).
- `shell-android`: whether the preinstalled SDK has platform 36 and build-tools 36 (else Gradle installs them, a minute or two, licenses are accepted on the image); the cold Gradle download (wrapper and AGP, a few hundred MB); the APK path.
- That both show as separate checks and that a shell failure leaves `test` and the shards unaffected.
- A cache miss on the second run means the key changed; the Cargo key moves only with the shell's `Cargo.lock` or `Cargo.toml`.

## Changed

- `tooling/ci.source.json`, `.github/workflows/ci.yml` (regenerated by `node tooling/generate.mjs`)
- `tooling/ci-shell.mjs` (new)
- `docs/TESTING.md` (CI paragraph)
- this record

## Checks

- `node tooling/generate.mjs --check`: `ok generate 12 files, 3 apps`
- js-yaml 4 parses `ci.yml`: jobs `check test-shard test postgres shell-tauri shell-android build budgets golden-1-images mutate-pr mutate eval`, limits 30 and 25
- `actionlint .github/workflows/ci.yml`: clean
- `node tooling/ci-shards.mjs --verify`: `ok ci-shards 45 packages, 48 parts, 6 shards`
- `node tooling/voice-lint.mjs`: `ok voice-lint 2933 files`
- `node tooling/format-check.mjs`: `ok format 4581 files`
- `node tooling/structure-lint.mjs`: `ok structure-lint 3962 files`
- `node tooling/docs-freshness.mjs`: `ok docs-freshness 57 docs`
- `biome check tooling/ci-shell.mjs`: no fixes
