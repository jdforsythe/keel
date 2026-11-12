// @vitest-environment happy-dom
// k.server: a stream frees its place when it ends for any reason, including a request whose signal was already aborted.
import { manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { expect, test } from "vitest";
import { createAppLoose, flush, liveLoader, readChunks, simCtx } from "../conformance/topology-fixtures.ts";
import { topology } from "../src/index.ts";

const sse = { accept: "text/event-stream" };

test("an event stream whose request signal is already aborted frees its place", async () => {
  const hold = liveLoader(s.object({ n: s.int() }), async function* (args: { signal: AbortSignal }) {
    yield ok({ n: 1 });
    await new Promise<void>((resolve) => args.signal.addEventListener("abort", () => resolve()));
  });
  const routes = manifest({
    "a.live": { path: "/live", loader: hold, component: () => document.createElement("main") },
  });
  const app = await createAppLoose({
    topology: topology({ x: { modules: ["a"], adapter: "node" } }),
    routes,
    ctx: simCtx(),
    mode: "dev",
    maxStreams: 1,
  });
  await app
    .fetch(new Request("http://localhost/live", { headers: sse, signal: AbortSignal.abort() }))
    .catch(() => undefined);
  await flush();
  const next = await app.fetch(new Request("http://localhost/live", { headers: sse }));
  expect(next.status).toBe(200);
  await readChunks(next, 1);
  await app.close?.();
});
