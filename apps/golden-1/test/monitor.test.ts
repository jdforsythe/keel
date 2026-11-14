// routes.ts first: an action returning a route href imports it back (E1505 cycle otherwise).
import "../modules/api/routes.ts";
import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { monitor } from "@keel/std-sessions/monitor";
import { afterEach, describe, expect, it } from "vitest";
import { runners } from "../modules/api/runners.server.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";

const ORIGIN = "http://localhost";
type App = Awaited<ReturnType<typeof createApp>>;
const open: App[] = [];
afterEach(async () => {
  for (const app of open.splice(0)) await app.close();
});

/** Microtask turns for the runner's storage reads and writes to settle; no timers. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};

describe("api runners", () => {
  it("run the monitor first, then the removal jobs and flows; the monitor tallies each committed api write by name into sessions.tally", async () => {
    expect(runners[0]).toBe(monitor);
    expect(runners).toHaveLength(3);
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const app = await createApp({ topology, routes: apiRoutes, ctx, deployable: "api", runners: { api: runners } });
    open.push(app);
    await settle();
    const headers = { accept: "application/json", "content-type": "application/json", "x-keel": "1", origin: ORIGIN };
    const write = { key: "11111111-1111-4111-8111-111111111111", base: 0 };
    const res = await app.fetch(
      new Request(`${ORIGIN}/api/lists`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Home", write }),
      }),
    );
    expect(res.status).toBe(200);
    await settle();
    ctx.clock.advance(60_000);
    await settle();
    const tally: unknown = JSON.parse((await ctx.storage.get("sessions.tally")) ?? "null");
    expect(tally).toMatchObject({ v: 1, tx: { "api.addList": 1 } });
    expect(JSON.stringify(tally)).not.toContain("Home");
  });
});
