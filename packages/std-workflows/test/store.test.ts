// std.workflows Store: `start` past `limit` instances not final fails `store.invariant`; a final instance is removed
// by its forget job `keepMs` after the runner saw it, and `forget` leaves an instance that is not final. Seed 1337.
import { ok } from "@keel/schema";
import { commitStores, createApp, topology } from "@keel/server";
import { queue } from "@keel/std-jobs";
import { tx } from "@keel/store";
import { expect, test } from "vitest";
import { flows, workflow } from "../src/index.ts";
import { close, nextId, pass, removalChart, settle, sim } from "./support.ts";

const data = { n: 0, freed: 0, code: "" };

test("`start` past `limit` instances not final fails `store.invariant`", async () => {
  const ctx = sim();
  const wf = workflow(nextId("limited"), { chart: removalChart(), limit: 2 });
  const r = await commitStores(ctx, wf.stores, (S) => {
    const codes = ["a", "b", "c"].map((id) => {
      const t = tx(S.start, { id, data });
      return t.ok ? "ok" : t.error.code;
    });
    void tx(S.events.hide, { id: "a", payload: {} });
    void tx(S.events.expired, { id: "a", payload: {} });
    const after = tx(S.start, { id: "c", data });
    return ok([...codes, after.ok ? "ok" : after.error.code]);
  });
  expect(r).toEqual({ ok: true, value: ["ok", "ok", "store.invariant", "ok"] });
});

test("A final instance is forgotten `keepMs` after the runner saw it; `forget` leaves one that is not final", async () => {
  const ctx = sim();
  const wf = workflow(nextId("kept"), { chart: removalChart(), keepMs: 10_000 });
  const jobs = queue({ ...wf.jobs });
  const app = await createApp({
    topology: topology({ web: { modules: ["api"], adapter: "node" } }),
    ctx,
    mode: "dev",
    runners: { api: [jobs, flows(jobs, [wf])] },
  });
  const rows = async () => {
    const r = await commitStores(ctx, wf.stores, (S) => ok(Object.keys(S.store.get("instances"))));
    return r.ok ? r.value : [];
  };
  void (await commitStores(ctx, wf.stores, (S) => {
    void tx(S.start, { id: "gone", data });
    void tx(S.start, { id: "open", data });
    void tx(S.forget, { id: "open" });
    void tx(S.events.hide, { id: "gone", payload: {} });
    void tx(S.events.expired, { id: "gone", payload: {} });
    return ok(null);
  }));
  await settle();
  await pass(ctx, 9000);
  expect(await rows()).toEqual(["gone", "open"]);
  await pass(ctx, 3000);
  expect(await rows()).toEqual(["open"]);
  await close(app);
});
