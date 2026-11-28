// Spec: std.channels, clause "Under sim, `subscribe` reopens 1 s, 2 s, 4 s after successive drops on `ctx.clock`, sends nothing while `online()` is false, reconnects on `{ kind: 'net', online: true }`, and its `status()` passes through `connecting`, `open`, `offline` and `denied` as those happen."
// Seed 1337
// Assumptions: `scope(fn)` returns a handle with `dispose()` (k.reactive); `ctx.net.setOnline` is the sim switch (k.sync);
// `status()` is `open` once the stream delivers its `reset`; coming back online reconnects at once, not at the next backoff step.
import { scope } from "@keel/reactive";
import { subscribe } from "@keel/std-channels";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ORIGIN, roomChannel, scripted, settle, simCtx, waitFor } from "./fixtures.ts";

const CLAUSE =
  "Under sim, `subscribe` reopens 1 s, 2 s, 4 s after successive drops on `ctx.clock`, sends nothing while `online()` is false, reconnects on `{ kind: 'net', online: true }`, and its `status()` passes through `connecting`, `open`, `offline` and `denied` as those happen.";

type Handle = ReturnType<typeof subscribe>;
function start(ctx: ReturnType<typeof simCtx>, on: (e: unknown) => void = () => undefined) {
  const box: { handle?: Handle } = {};
  const sc = scope(
    () => {
      box.handle = subscribe(ctx, ORIGIN, roomChannel, { room: "a" }, on);
    },
    { detached: true },
  );
  return {
    sc,
    status: () => box.handle?.status(),
  };
}

const delay = (i: number): number => Math.min(30_000, 1000 * 2 ** i);

async function drops(mode: "reject" | "empty", k: number): Promise<void> {
  const ctx = simCtx();
  const srv = scripted(ctx);
  srv.state.mode = mode;
  const run = start(ctx);
  await settle();
  expect(srv.requests).toHaveLength(1);
  for (let i = 0; i < k; i++) {
    const last = srv.requests.at(-1)?.at ?? 0;
    const d = delay(i);
    await ctx.clock.advance(d - 1);
    await settle();
    expect(srv.requests).toHaveLength(i + 1);
    await ctx.clock.advance(1);
    await settle();
    expect(srv.requests).toHaveLength(i + 2);
    expect(srv.requests.at(-1)?.at).toBe(last + d);
  }
  run.sc.dispose();
}

test(`${CLAUSE} (after fetch failures: 1 s, 2 s, 4 s, doubling to a 30 s cap)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 3, max: 8 }), (k) => drops("reject", k)),
    {
      seed: 1337,
      numRuns: 6,
    },
  );
});

test(`${CLAUSE} (after streams that end: 1 s, 2 s, 4 s)`, async () => {
  await drops("empty", 3);
});

test(`${CLAUSE} (sends nothing while \`online()\` is false, reconnects on net online)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 3_600_000 }), async (idle) => {
      const ctx = simCtx();
      const srv = scripted(ctx);
      ctx.net.setOnline(false);
      const run = start(ctx);
      await settle();
      await ctx.clock.advance(idle);
      await settle();
      expect(srv.requests).toHaveLength(0);
      expect(run.status()).toBe("offline");
      ctx.net.setOnline(true);
      await waitFor(() => srv.requests.length === 1);
      run.sc.dispose();
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test(`${CLAUSE} (an open stream cut by going offline stays closed until net online)`, async () => {
  const ctx = simCtx();
  const srv = scripted(ctx);
  const run = start(ctx);
  await waitFor(() => srv.requests.length === 1);
  srv.send({ kind: "reset" });
  await waitFor(() => run.status() === "open");
  ctx.net.setOnline(false);
  await waitFor(() => run.status() === "offline");
  await ctx.clock.advance(120_000);
  await settle();
  expect(srv.requests).toHaveLength(1);
  ctx.net.setOnline(true);
  await waitFor(() => srv.requests.length === 2);
  run.sc.dispose();
});

test(`${CLAUSE} (\`status()\` passes through connecting, open, offline, connecting, open and denied)`, async () => {
  const ctx = simCtx();
  const srv = scripted(ctx);
  const got: unknown[] = [];
  const run = start(ctx, (e) => got.push(e));
  const seen: (string | undefined)[] = [run.status()];
  const note = () => {
    if (seen.at(-1) !== run.status()) seen.push(run.status());
  };
  await waitFor(() => srv.requests.length === 1);
  note();
  srv.send({ kind: "reset" });
  await waitFor(() => run.status() === "open");
  note();
  ctx.net.setOnline(false);
  await waitFor(() => run.status() === "offline");
  note();
  ctx.net.setOnline(true);
  await waitFor(() => srv.requests.length === 2);
  note();
  srv.send({ kind: "reset" });
  await waitFor(() => run.status() === "open");
  note();
  srv.send({ kind: "closed", reason: "denied" });
  await waitFor(() => run.status() === "denied");
  note();
  expect(seen).toEqual(["connecting", "open", "offline", "connecting", "open", "denied"]);
  expect(got).toContainEqual({ kind: "closed", reason: "denied" });
  // after `closed` `denied` it stops
  await ctx.clock.advance(600_000);
  await settle();
  expect(srv.requests).toHaveLength(2);
  expect(run.status()).toBe("denied");
  run.sc.dispose();
});
