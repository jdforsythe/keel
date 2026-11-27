---
"@keel/testing": minor
"@keel/cli": minor
"@keel/server": minor
"@keel/router": minor
"@keel/compiler": patch
"@keel/check": patch
"@keel/scaffold": patch
---

The end-to-end runner's guarantees (k.e2e-run): Chromium with its sandbox on (W1734 as root on Linux) and a new profile inside the run's one `keel-e2e-*` folder, which `keel test --e2e` points `TMPDIR` at, removes on every end (a `stopped:` line on SIGINT or SIGTERM) and sweeps when a SIGKILLed run left it; a key made per run and a certificate per `serve` for its mapped host names alone; every request of a page to an origin the run neither serves nor maps refused before it leaves the browser, an `offsite` problem; a served process given `PATH`, `LANG`, `LC_ALL`, `TZ`, its own `HOME` and temporary folders, and `env`, nothing else of the shell; every server the run starts on `127.0.0.1`; a non-Keel error printed `uncaught: <code> <line>`, never under `fix:`. Pages: `problems(...expected)` takes what an entry matches and a bare call takes nothing; `log(store)` gives SHA-256 digests of the stored snapshot and each entry's payload; `resume({ grows })` records every element under each island root; `upload`, `download`, `hover`, `opened()` and the `dialog` problem; an unknown id is E1705 at once with 3 nearest ids, an id inside a frame E1705 too. A library's `serve({ page, props, wrap?, tokens? })` writes its host in `.keel/e2e-host-<random>/` per call, removed at dispose; `page` under `src/`, `wrap` and `tokens` under `test/` (E1736). `keel dev` listens on loopback alone, a Vite `server.host` past it is E1560, and `keel dev --host <address>` listens wider with W1569 while `/__keel/inspect` answers loopback connections only. A `node` deployable's `server.mjs` listens on `HOST` when it is set. A loader gets `site` (the request's `Sec-Fetch-Site`) and `host` (the host it was sent to).
