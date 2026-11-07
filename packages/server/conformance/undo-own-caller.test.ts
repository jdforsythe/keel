// Spec: k.server Conformance: `undoOwn` from a caller other than the one that committed the store's last entry returns false and leaves the store unchanged; that caller's own `undoOwn` then succeeds.
// Runs under plain Node: happy-dom strips cookie headers. Only POST JSON requests are used, so no DOM is touched.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { action, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { createApp, topology, undoOwn } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import { expect, test } from "vitest";

const Notes = s.object({ items: s.array(s.int()) });
const Add = s.object({ n: s.int() });
const Nothing = s.object({});
const denied = s.error("keel.denied", s.object({}));
const component = (): Node => document.createElement("p");

let count = 0;
async function setup() {
  const box: { notes: ReturnType<typeof make> | undefined } = { notes: undefined };
  function make() {
    const notes = store(Notes, { items: [] }, { id: `undo.notes.${(count += 1)}` });
    const add = transaction(notes, "undo.add", Add, (state, { n }) => ({ items: [...state.items, n] }));
    return { notes, add };
  }
  scope(() => undefined).run(() => {
    box.notes = make();
  });
  const kit = box.notes;
  if (kit === undefined) throw new Error("store was not created");
  const write = action({ input: Add }, async (input) => {
    tx(kit.add, { n: input.n });
    return ok(null);
  });
  const undo = action({ input: Nothing }, async () => (undoOwn(kit.notes) ? ok(null) : err(denied.make({}))));
  const routes = manifest({
    "app.write": { path: "/write", actions: { POST: write }, component },
    "app.undo": { path: "/undo", actions: { POST: undo }, component },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
  return { app, kit };
}

function client(app: { fetch(req: Request): Promise<Response> }) {
  let cookie = "";
  return async (path: string, body: unknown): Promise<Response> => {
    const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
    if (cookie !== "") headers["cookie"] = cookie;
    const res = await app.fetch(
      new Request(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body), headers }),
    );
    const pair = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    if (pair.startsWith("keel-caller=")) cookie = pair;
    return res;
  };
}

test("`undoOwn` from a caller other than the one that committed the store's last entry returns false and leaves the store unchanged; that caller's own `undoOwn` then succeeds", async () => {
  const { app, kit } = await setup();
  const a = client(app);
  const b = client(app);
  expect((await a("/write", { n: 1 })).status).toBe(200);
  expect((await b("/write", { n: 2 })).status).toBe(200);
  expect(kit.notes.get("items")).toEqual([1, 2]);

  const refused = await a("/undo", {});
  expect(refused.status).toBe(403);
  expect(kit.notes.get("items")).toEqual([1, 2]);

  const accepted = await b("/undo", {});
  expect(accepted.status).toBe(200);
  expect(kit.notes.get("items")).toEqual([1]);
});

test("a caller with no cookie cannot `undoOwn` another caller's entry", async () => {
  const { app, kit } = await setup();
  const a = client(app);
  expect((await a("/write", { n: 1 })).status).toBe(200);
  const stranger = client(app);
  expect((await stranger("/undo", {})).status).toBe(403);
  expect(kit.notes.get("items")).toEqual([1]);
});
