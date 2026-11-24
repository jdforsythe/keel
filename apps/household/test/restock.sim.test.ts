import { createCtx } from "@keel/ctx";
import { epochMs } from "@keel/std-temporal";
import { simulate } from "@keel/testing";
import { expect, it } from "vitest";
import { jobs } from "../modules/shopping/jobs.server.ts";
import { shoppingApi } from "../modules/shopping/shoppingApi.ts";
import { drive, ended, listOn, restocksOn, runsOn, steadily, turn } from "./restock.ts";
import { webApp } from "./serve.ts";

const STAPLES = ["Milk × 1", "Bread × 1", "Eggs × 1", "Rice × 1", "Apples × 1"];
const NAMES = ["Apples", "Bread", "Eggs", "Milk", "Rice"];
const DAY = 86_400_000;
// The sim clock starts at 1970-01-01T00:00Z, a Thursday: the first Saturday 08:00 UTC is two days and eight hours on.
const SATURDAY_8 = 2 * DAY + 8 * 3_600_000;

/**
 * For every kill point, the server is stopped while the run goes (`close()`, as SIGKILL leaves the storage and the
 * database as committed) and a new one starts on the same storage and database. Whatever the point, the run ends once,
 * done, with each staple put back once and one `restocks` row per staple.
 */
it("ends a run once, each staple put back once, wherever the server stops", async () => {
  const handledAtKill: number[] = [];
  for (let kill = 0; kill <= 30; kill += 3) {
    const ctx = createCtx({ mode: "sim", seed: 100 + kill });
    const first = await webApp(ctx);
    const started = await shoppingApi.run({ user: "member-1" }, ctx);
    expect(started.ok).toBe(true);
    for (let n = 0; n < kill; n++) await turn(ctx);
    const atKill = (await steadily(ctx, () => runsOn(ctx))).last;
    if (atKill?.state === "running") handledAtKill.push(atKill.handled);
    await first.close();
    const second = await webApp(ctx);
    await drive(ctx, ended, 120);
    const runs = await runsOn(ctx);
    expect({ kill, last: runs.last, kept: runs.kept }).toMatchObject({
      kill,
      last: { state: "done", handled: 5, putBack: 5 },
      kept: 1,
    });
    expect(await listOn(ctx)).toEqual(STAPLES);
    const rows = await restocksOn(ctx);
    expect(rows.map((r) => r.name).sort()).toEqual(NAMES);
    expect(rows.every((r) => r.putBack)).toBe(true);
    await second.close();
  }
  // The kill points fall before the first staple, between staples and inside the run's last rests.
  expect(handledAtKill.length).toBeGreaterThanOrEqual(4);
  expect(new Set(handledAtKill).size).toBeGreaterThanOrEqual(3);
}, 240_000);

/**
 * Under generated schedules of storage failures and delays, a commit of the workflow store or of the job queue may be
 * refused, so step jobs fail and run again. Whatever the schedule, no staple is on the list twice, each `restocks` row
 * names a different staple, and a run that ends done put back all five.
 */
it("retries a staple's step through refused commits and never puts a staple back twice", async () => {
  await simulate(
    async ({ ctx, run }) => {
      const app = await webApp(ctx);
      const started = await steadily(ctx, () => shoppingApi.run({ user: "member-1" }, ctx));
      await run();
      if (started.ok) {
        await drive(ctx, ended, 160);
        const list = await steadily(ctx, () => listOn(ctx));
        expect(new Set(list).size).toBe(list.length);
        const rows = await steadily(ctx, () => restocksOn(ctx));
        expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length);
        const last = (await steadily(ctx, () => runsOn(ctx))).last;
        expect(last?.state).not.toBe("running");
        if (last?.state === "done") {
          expect(last.putBack).toBe(5);
          expect(list).toEqual(STAPLES);
        }
      }
      await app.close();
    },
    { runs: Number(process.env.RUNS ?? 12), seed: 9, horizon: 30_000 },
  );
}, 240_000);

it("starts a run at Saturday 08:00 UTC, and one only after a server down across three Saturdays", async () => {
  const ctx = createCtx({ mode: "sim", seed: 120 });
  const first = await webApp(ctx);
  await turn(ctx);
  ctx.clock.advance(SATURDAY_8 - ctx.clock.now() - 1_000);
  expect((await runsOn(ctx)).last).toBeNull();
  await drive(ctx, (r) => r.last !== null, 20);
  const fired = await runsOn(ctx);
  expect(fired.last).toMatchObject({ by: "schedule", state: "running" });
  expect(fired.last === null ? Number.NaN : epochMs(fired.last.at)).toBeGreaterThanOrEqual(SATURDAY_8);
  await drive(ctx, ended);
  expect(await listOn(ctx)).toEqual(STAPLES);
  await first.close();

  // Down from Saturday through three more Saturdays, back on a Wednesday: one run for the latest missed fire. The run
  // from the first Saturday ended more than eight days before, so the workflow forgets it: one run is kept.
  ctx.clock.advance(3 * 7 * DAY + 4 * DAY);
  const back = ctx.clock.now();
  const second = await webApp(ctx);
  await drive(ctx, (r) => r.last !== null && epochMs(r.last.at) >= back, 40);
  expect((await runsOn(ctx)).last).toMatchObject({ by: "schedule", state: "running" });
  await drive(ctx, ended);
  await drive(ctx, () => false, 40);
  const caught = await runsOn(ctx);
  expect(caught.last).toMatchObject({ by: "schedule", state: "done", putBack: 0 });
  expect(caught.kept).toBe(1);
  await second.close();
}, 120_000);

it("starts one scheduled run a day, however often the start job runs", async () => {
  const ctx = createCtx({ mode: "sim", seed: 121 });
  const app = await webApp(ctx);
  expect((await jobs.enqueue(ctx, "shopping.startRestock", {}, { key: "again-1" })).ok).toBe(true);
  await drive(ctx, ended);
  expect((await jobs.enqueue(ctx, "shopping.startRestock", {}, { key: "again-2" })).ok).toBe(true);
  await drive(ctx, () => false, 20);
  expect((await runsOn(ctx)).kept).toBe(1);
  await app.close();
}, 60_000);
