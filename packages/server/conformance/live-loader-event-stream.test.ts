// @vitest-environment happy-dom
// Spec: k.server, clause "An event-stream GET of a live loader yielding `ok(1)`, `ok(2)` gets two `data:` lines in order; a JSON GET answers `ok(1)`; aborting the request aborts `signal`; a denying guard gives 403."
// Seed 1337 (fc.assert below). No wall time.
import { guard, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
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
  test("An event-stream GET of a live loader yielding `ok(1)`, `ok(2)` gets two `data:` lines in order; a JSON GET answers `ok(1)`; aborting the request aborts `signal`; a denying guard gives 403.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }), async (a, b) => {
        let fnSignal: AbortSignal | undefined;
        const appContract = contract("app", {
          "app.live": { method: "GET", path: "/api/live", events: true, output: Out },
          "app.hold": { method: "GET", path: "/api/hold", events: true, output: Out },
          "app.locked": { method: "GET", path: "/api/locked", events: true, output: Out },
          "app.login": { path: "/login" },
        });
        const live = liveLoader(appContract, "app.live", async function* (args: { signal: AbortSignal }) {
          fnSignal = args.signal;
          yield ok({ n: a });
          yield ok({ n: b });
        });
        const hold = liveLoader(appContract, "app.hold", async function* (args: { signal: AbortSignal }) {
          fnSignal = args.signal;
          yield ok({ n: a });
          await new Promise<void>((resolve) => args.signal.addEventListener("abort", () => resolve()));
        });
        const locked = liveLoader(appContract, "app.locked", async function* () {
          yield ok({ n: a });
        });
        const deny = guard({ redirect: "app.login" }, () =>
          Promise.resolve(err(s.error("keel.denied", s.object({})).make({}))),
        );
        const routes = manifest(appContract, {
          "app.live": { loader: live },
          "app.hold": { loader: hold },
          "app.locked": { loader: locked, guard: deny },
          "app.login": { component: view },
        });
        const app = await createAppLoose({ topology: T(), routes, ctx: simCtx(), mode: "dev" });

        const text = (
          await readChunks(await app.fetch(new Request("http://localhost/api/live", { headers: sse })), 8)
        ).join("");
        const lines = text.split("\n").filter((l) => l.startsWith("data:"));
        expect(lines).toHaveLength(2);
        expect(JSON.parse(lines[0]?.slice(5) ?? "null")).toEqual({ ok: true, value: { n: a } });
        expect(JSON.parse(lines[1]?.slice(5) ?? "null")).toEqual({ ok: true, value: { n: b } });

        const json = await app.fetch(
          new Request("http://localhost/api/live", { headers: { accept: "application/json" } }),
        );
        expect(json.status).toBe(200);
        expect(JSON.stringify(await json.json())).toContain(String(a));

        const ac = new AbortController();
        const res = await app.fetch(new Request("http://localhost/api/hold", { headers: sse, signal: ac.signal }));
        await readChunks(res, 1);
        expect(fnSignal?.aborted).toBe(false);
        ac.abort();
        await Promise.resolve();
        expect(fnSignal?.aborted).toBe(true);

        const denied = await app.fetch(new Request("http://localhost/api/locked", { headers: sse }));
        expect(denied.status).toBe(403);
        expect(await denied.text()).toContain("keel.denied");
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
