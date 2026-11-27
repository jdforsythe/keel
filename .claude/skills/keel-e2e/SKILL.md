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
`test/**/*.e2e.ts` runs under `keel test --e2e` alone: it builds, then runs Chromium (`playwright-core`, E1734). `serve({ env, origins })` starts the built app on fresh data (`state`, `log`, `until`, `stop`, `start`, `serverLog`); `answer(fn)` makes an origin. Pages add `until`, `findAll`, `press`, `reload`, `offline`, `upload`, `download`, `hover`, `opened()`, `open(path, { hold })`, `resume()` (E1720). Waits: 10 s, `{ within }` scaled, `{ fixed }` app time (E1735). A problem no `problems({ kind, text })` takes fails (E1738). No verb for drag (use keys), clipboard (type) or frames (`serve` that app). No sim clock, seed or fault reaches a built app.
