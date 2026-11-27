---
name: keel-e2e
description: "End-to-end tests of a built Keel app or library in a browser: keel test --e2e, @keel/testing/e2e serve, answer, build, pages by Keel id, problems, log, resume, the runner's reach and run folder; E1705, E1720, E1734-E1738, W1734"
---

# End to end

Exact rules: `keel docs k.e2e`, `k.e2e-page`, `k.e2e-run`. Component and route tests: keel-testing.

```ts
import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";

it("an add survives a reload", async () => {
  const app = await serve();
  const page = await app.open("/");
  await page.fire("a.add", { type: "click" });
  await page.reload();
  expect((await page.find("a.count")).text).toBe("1");
});
```
- `test/**/*.e2e.ts` runs under `keel test --e2e` alone: it builds, then runs Chromium (`playwright-core`, E1734), sandbox on (W1734 as root on Linux). Verbs take Keel ids only; an unknown id is E1705 at once with 3 nearest, a known one not shown yet is waited for.
- `serve({ env, origins, dev })` starts the built app on fresh data, on `127.0.0.1` alone: `state(store)`, `log(store)` (`head`, `digest` SHA-256 of the stored text, each entry's `digest`; compare across `stop()`/`start()`, no values), `until`, `serverLog`. A served process gets `PATH`, `LANG`, `LC_ALL`, `TZ` and what `env` passes, nothing else of your shell. `answer(fn)` makes an origin `origins` maps; any other request of a page is refused and is an `offsite` problem.
- Pages: `fire`, `press`, `find`, `findAll`, `until`, `reload`, `offline`, `fetch(path)` (`.text()` is the served document), `upload`, `download`, `hover`, `opened()`, `open(path, { hold })` then `resume({ grows: [ids] })`: E1720 when the claim removes or replaces an element under an island root or adds one outside `grows`.
- `problems(...expected)` takes what an entry `{ kind, text }` matches (`pageerror`, `console`, `warning`, `csp`, `offsite`, `dialog`); no argument reads, takes nothing. One left at the test's end is E1738.
- Waits: 10 s, `{ within }` scaled, `{ fixed }` app time (E1735). No sim clock, seed or fault reaches a built app.
- No verb for a drag (test its keyboard path with `press`), the clipboard (assert the text a copy holds; paste by `fire` `input`) or a frame (`serve` that app; an id inside one is E1705).
- In a library: `serve({ page: 'src/Card.tsx', props, wrap: 'test/Frame.tsx', tokens: 'test/dark.ts' })`, a host per call in `.keel/e2e-host-<random>/`, removed at the end (E1736 a path outside `src/` or `test/`).
- A failure is one T0001; a non-Keel error reads `uncaught: <code> <line>`. The run's files live in one `keel-e2e-*` temp folder, removed at the end.
