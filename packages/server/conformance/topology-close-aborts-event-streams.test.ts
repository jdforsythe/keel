// @vitest-environment happy-dom
// Spec: k.topology Runners, "`app.close()` aborts each runner's `signal` and open event stream and resolves when every `run` has settled."
// Spec: k.server Request flow, event-stream GET runs "until `fn` returns or `signal` aborts (request abort, `close()`)".
// Seed 1337: no generated input (one fixed stream).
import { ok, s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { manifest } from "@keel/router";
import { createAppLoose, flush, liveLoader, simCtx } from "./topology-fixtures.ts";

describe("k.topology: close and event streams", () => {
  test.skip("`app.close()` aborts each runner's `signal` and open event stream and resolves when every `run` has settled.", async () => {
    let fnSignal: AbortSignal | undefined;
    const live = liveLoader(s.object({ n: s.int() }), async function* (args: { signal: AbortSignal }) {
      fnSignal = args.signal;
      yield ok({ n: 1 });
      await new Promise<void>((resolve) => args.signal.addEventListener("abort", () => resolve()));
    });
    const routes = manifest({
      "a.live": { path: "/live", loader: live, component: () => document.createElement("main") },
    });
    const app = await createAppLoose({
      topology: topology({ x: { modules: ["a"], adapter: "node" } }),
      routes,
      ctx: simCtx(),
      mode: "dev",
    });
    const res = await app.fetch(new Request("http://localhost/live", { headers: { accept: "text/event-stream" } }));
    const reader = res.body?.getReader();
    await reader?.read();
    expect(fnSignal?.aborted).toBe(false);
    await app.close?.();
    await flush();
    expect(fnSignal?.aborted).toBe(true);
    expect((await reader?.read())?.done).toBe(true);
  });
});
