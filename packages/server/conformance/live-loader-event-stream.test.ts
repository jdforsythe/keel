// @vitest-environment happy-dom
// Spec: k.server Conformance, event-stream GET of a live loader. Seed 1337 (fc.assert below). No wall time.
import { guard, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { SEED, createAppLoose, liveLoader, readChunks, simCtx } from "./topology-fixtures.ts";

const Out = s.object({ n: s.int() });
const T = () => topology({ web: { modules: ["app"], adapter: "node" } });
const view = () => document.createElement("main");
const sse = { accept: "text/event-stream" };

describe("k.server: live loaders", () => {
  test("An event-stream GET of a live loader yielding `ok(1)`, `ok(2)` gets two `data:` lines in order; a document GET renders `ok(1)`; aborting the request aborts `signal`; a denying guard gives 403.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }), async (a, b) => {
        let fnSignal: AbortSignal | undefined;
        const live = liveLoader(Out, async function* (args: { signal: AbortSignal }) {
          fnSignal = args.signal;
          yield ok({ n: a });
          yield ok({ n: b });
        });
        const hold = liveLoader(Out, async function* (args: { signal: AbortSignal }) {
          fnSignal = args.signal;
          yield ok({ n: a });
          await new Promise<void>((resolve) => args.signal.addEventListener("abort", () => resolve()));
        });
        const deny = guard({ redirect: "app.login" }, () =>
          Promise.resolve(err(s.error("keel.denied", s.object({})).make({}))),
        );
        const routes = manifest({
          "app.live": { path: "/live", loader: live, component: view },
          "app.hold": { path: "/hold", loader: hold, component: view },
          "app.locked": { path: "/locked", loader: live, guard: deny, component: view },
          "app.login": { path: "/login", component: view },
        });
        const app = await createAppLoose({ topology: T(), routes, ctx: simCtx(), mode: "dev" });

        const text = (
          await readChunks(await app.fetch(new Request("http://localhost/live", { headers: sse })), 8)
        ).join("");
        const lines = text.split("\n").filter((l) => l.startsWith("data:"));
        expect(lines).toHaveLength(2);
        expect(JSON.parse(lines[0]?.slice(5) ?? "null")).toEqual({ ok: true, value: { n: a } });
        expect(JSON.parse(lines[1]?.slice(5) ?? "null")).toEqual({ ok: true, value: { n: b } });

        const doc = await app.fetch(new Request("http://localhost/live"));
        expect(doc.status).toBe(200);
        const json = await app.fetch(new Request("http://localhost/live", { headers: { accept: "application/json" } }));
        expect(JSON.stringify(await json.json())).toContain(String(a));

        const ac = new AbortController();
        const res = await app.fetch(new Request("http://localhost/hold", { headers: sse, signal: ac.signal }));
        await readChunks(res, 1);
        expect(fnSignal?.aborted).toBe(false);
        ac.abort();
        await Promise.resolve();
        expect(fnSignal?.aborted).toBe(true);

        const denied = await app.fetch(new Request("http://localhost/locked", { headers: sse }));
        expect(denied.status).toBe(403);
        expect(await denied.text()).toContain("keel.denied");
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
