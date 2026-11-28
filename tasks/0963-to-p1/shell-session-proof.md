# A session proven in the macOS and iOS shells (backlog 0961)

The stage exit asks for a recorded session replayed in the shell. `tooling/smoke/shell.mjs` proves it for the Tauri shell on Linux over WebDriver. WKWebView has no WebDriver, so the macOS Tauri binary and the iOS Capacitor app need another driver. Both have one, and it runs without a person: `tooling/smoke/shell-drive.mjs`.

## Result

| Shell | Driver | Replay session | Outbox session | Planted failure |
| --- | --- | --- | --- | --- |
| Tauri, macOS | accessibility API (`shell-drive/ax.swift`) | passes, about 10 s | passes, about 12 s | `--drop-store` ends in E0015, exit 1 |
| Capacitor, iOS Simulator | UI test (`shell-drive/ShellDrive.xcodeproj`) | passes, about 55 s | passes, about 60 s | `--drop-store` ends in E0015, exit 1 |

Each run records the session under simulation, serves the built `api` behind the recording proxy, makes the session's inputs in the page, and compares the stored `api.board` with `replayGroup`'s. The outbox session makes two writes with the server down, waits until the shell's store holds both, kills the app, brings the server back, starts the app and checks that the board matches and the stored outbox is empty. These are the checks `shell.mjs` makes on Linux, from the same session files. No shell package changes and no attended mode is needed.

Measured on one Mac (Xcode 26.6, iOS 26.5 simulator, macOS 26.3) while another job loaded it, three runs each:

| Smoke | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| `--shell tauri` | 10.5 s | 10.1 s | 10.2 s |
| `--shell tauri --session outbox` | 11.7 s | 11.6 s | 11.8 s |
| `--shell ios` | 66.0 s | 53.9 s | 54.4 s |
| `--shell ios --session outbox` | 64.4 s | 59.9 s | 59.9 s |

## macOS Tauri

**Accessibility API: works.** WebKit on macOS gives every page element's DOM id to the accessibility tree as `AXDOMIdentifier`, a link's target as `AXURL`, and the page's URL on its `AXWebArea`. `ax.swift` (150 lines, compiled by `swiftc` in 2 s) finds an element by id and presses it (`AXPress`), sets a field's `AXValue`, which the page hears as an `input` event, and reads the route. That covers every input of both sessions by the same element ids the Linux smoke uses, and by the real `href` for a followed link. The page builds its accessibility tree on the first question, so the first call is repeated until it finds the page (about 200 ms).

The calling process needs the Accessibility permission (TCC `kTCCServiceAccessibility`), which macOS grants to the terminal that runs the script. `ax <pid> trusted` calls `AXIsProcessTrusted`, which answers without a prompt; an ungranted process gets E0014 naming the setting. On this Mac the terminal holds the permission and no prompt appears. GitHub's macOS runner images write the grant for `/bin/bash`, `/usr/bin/osascript` and the runner's provisioner into the system and user TCC databases at image build (`images/macos/scripts/build/configure-tccdb-macos.sh` in `actions/runner-images`), so a workflow `run:` step holds it. That is read from the image scripts and is unproven until the `shell-tauri-macos` job runs these steps.

**XCUITest against the macOS app: not used.** A macOS UI test needs Automation Mode. `automationmodetool` on this Mac reports that it is disabled and that enabling it requires user authentication, so a run here would raise a password prompt. The runner images enable it without authentication (`configure-machine.sh`), so this route is open in CI if the accessibility API ever fails there. The debug binary is built `--no-bundle` and has no bundle id; the accessibility route needs only its pid.

**A test hook in the app: not needed.** `tauri-driver` has no macOS driver. A debug-only hook (a script file named by an environment variable and evaluated at start, or a Tauri command the smoke calls) would change `@keel/std-tauri` and the generated `src/lib.rs`, and would put an evaluate-anything entry into a shell build. If a later need calls for it, the conditions for an RFC are: compiled only under a Cargo feature that `keel build` sets for a smoke build and never for `--release`, refused when `debug_assertions` is off, and absent from the capabilities file of every other build. Nothing here depends on it.

## iOS Simulator

**XCUITest: works.** A UI test bundle drives an app it did not build: `XCUIApplication(bundleIdentifier: "dev.keel.golden1")` starts and queries the installed app. `ShellDrive.xcodeproj` holds one UI test target and no app target, so it lives in `tooling/smoke/shell-drive/` and the generated Capacitor project stays as `keel build` writes it. `xcodebuild build-for-testing` builds it in about 5 s warm; `test-without-building` starts the runner in about 15 s. The simulator shares the host's network, and the runner reaches the smoke's loopback port over plain HTTP. `xcodebuild` passes `TEST_RUNNER_<NAME>` variables to the runner, which is how the test learns the port and the bundle id. A simulator UI test needs no Automation Mode and no TCC grant.

The test is a command loop: it posts the last command's answer and receives the next command, so the smoke keeps the session, the proxy and the kill, and the test keeps only taps and typing. The smoke force-stops the app with `simctl terminate` between two `launch` commands while the test waits.

Three facts shape the iOS driver:

- WebKit on iOS gives the accessibility tree an element's role and label and no DOM id (the tree's `identifier` is empty for page elements). The smoke names each session id by role and label under the `main` landmark: `todos.toggle.t1` is the switch labelled `Done: Milk`, the link to `/lists/l1` the link labelled `Home`. `labelled` and `linkTo` in `shellReplay.mjs` hold that table for golden-1, with tests. The labels come from the starting board, which fits both sessions; a session that renames a todo and then uses its old id again needs the table to follow the rename.
- The software keyboard covers the lower half of the page. A tap on Add todo with the keyboard up lands on the Priority select. The test taps Done above the keyboard after typing, and answers an error when the keyboard stays up.
- A checkbox's element spans its box and its label. A tap at the element's center toggles `Done: Milk` and does nothing on `Done: Bread`, online or offline, in every run. A tap on the box toggles both, so the test taps the box. The center of the Bread element is on its label text; why that tap makes no `change` is open, and it is worth a look with a finger on a device (backlog 0964).

The store on iOS is the `keel` entry of the app's preferences file (`@capacitor/preferences` over `UserDefaults`). The simulator's preferences daemon holds a write in memory and puts it in the file some seconds later: right after two queued writes the file holds one. The smoke waits until the file holds every write of the sim replay the server has not stored (up to 30 s; about 12 s here) before the force-stop. `defaults export` run in the simulator from outside the app does not see the app's entries, so the file is the only view from the host. The force-stop does not lose a write the daemon holds, so on the simulator this wait proves the count and the drain after a restart, and the durability of a write across a device power loss stays unproven here.

**Safari Web Inspector and remote automation: not tried**, since the UI test works. For the record: `WKWebView.isInspectable` is on in both debug builds through upstream defaults and off in release builds. Capacitor 8 sets it when `ios.webContentsDebuggingEnabled` is true or, without that key, under `#if DEBUG`; wry 0.57 sets it under `debug_assertions`. Neither `@keel/std-capacitor` nor `@keel/std-tauri` names it. `ios_webkit_debug_proxy` is not installed here and GitHub's images do not carry it.

**`simctl` alone: not enough.** `simctl io` offers `enumerate`, `poll`, `recordVideo` and `screenshot`; `simctl ui` sets appearance, contrast and content size. Neither makes a tap or types a key, and `openurl` and the pasteboard reach no page element.

## CI

`tooling/ci.source.json` adds two steps to `shell-tauri-macos` and two to `shell-ios` (`macos-26`), after the launch check: the replay session and the outbox session. They run when the repository is public and the shells paths change, as the launch checks do. Neither job has run with these steps: the first run on `master` is the proof for the runner's Accessibility grant and for the UI test on the runner's simulator.

## What stays manual

Nothing in the session proof. Two things stay outside it:

- A real device. The simulator proves the page, the native HTTP client and the store. Touch on glass, the device keyboard and a device power loss are not exercised.
- A first run on a new Mac. The terminal needs the Accessibility permission once (System Settings, Privacy & Security, Accessibility); the smoke says so in E0014 and raises no prompt.

## For an RFC

No change is needed for this proof. Two options stay on file, neither required:

1. An accessibility identifier on iOS. If `@keel/ui` components also wrote their id where iOS WebKit exposes it, the iOS driver could find elements by id as the macOS driver does. WebKit on iOS has no such attribute today, so this is a watch item.
2. The debug-only test hook above, under its conditions, if a later proof needs to read page state the accessibility tree does not carry.
