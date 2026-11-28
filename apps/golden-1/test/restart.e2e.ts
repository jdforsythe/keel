// Restart proof for golden-1 on SQLite, built: a list, two todos, a toggle and an edit are written over HTTP, the api
// is killed with SIGKILL and started again on the same data: the stored board is equal before and after, the api
// answers the same board, and the next write is applied to the restored board.
import { scope } from "@keel/reactive";
import { store } from "@keel/store";
import { type Served, type StoreLog, serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";
import { Board } from "../modules/api/Board.schema.ts";

// The api's board store, named for `state`: its id and schema, made in a detached root of the file's own.
const board = scope(() => undefined, { detached: true }).run(() =>
  store(Board, { lists: [], todos: [] }, { id: "api.board" }),
);

const headers = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };

/** The `api.lists` value of `GET /api/lists`: lists, todos, head and removals. */
async function view(app: Served): Promise<unknown> {
  const body: unknown = await (await app.fetch("/api/lists", { headers: { accept: "application/json" } })).json();
  return Reflect.get(Object(Reflect.get(Object(Reflect.get(Object(body), "results")), "api.lists")), "value");
}

/** The field at `keys` of `value`, `undefined` where a step is not an object. */
function field(value: unknown, ...keys: string[]): unknown {
  return keys.reduce<unknown>((o, k) => (typeof o === "object" && o !== null ? Reflect.get(o, k) : undefined), value);
}

/** The ids of a store's log entries. */
const ids = (log: StoreLog): number[] => log.entries.map((e) => e.id);

it("the board stored before a SIGKILL is the board after the restart, and the next write applies", async () => {
  const app = await serve();
  let keys = 0;
  const write = (base = 0): { key: string; base: number; owner: string } => ({ key: `a${++keys}`, base, owner: "" });
  const post = async (path: string, body: unknown): Promise<number> =>
    (await app.fetch(path, { method: "POST", headers, body: JSON.stringify(body) })).status;

  // writes: a list, two todos, a toggle and an edit, each answered 200.
  const statuses = [await post("/api/lists", { name: "Home", write: write() })];
  const listId = String(field(await view(app), "lists", "0", "id"));
  for (const title of ["Milk", "Eggs"])
    statuses.push(await post(`/api/lists/${listId}/todos`, { title, priority: "normal", write: write() }));
  const todo = String(field(await view(app), "todos", "1", "id"));
  statuses.push(await post(`/api/todos/${todo}/toggle`, { write: write() }));
  const head = Number(field(await view(app), "head"));
  statuses.push(await post(`/api/todos/${todo}`, { title: "Oat milk", priority: "high", write: write(head) }));
  expect(statuses).toEqual([200, 200, 200, 200, 200]);

  // stored row: the board is in the api's storage.
  const before = await app.state(board);
  expect(before.lists.map((l) => l.name)).toEqual(["Home"]);
  expect(before.todos.map((t) => t.title)).toEqual(["Milk", "Oat milk"]);
  const shown = JSON.stringify(await view(app));
  const was = await app.log(board);
  expect(was.entries.length).toBeGreaterThan(0);
  expect(ids(was).every((id, i) => i === 0 || id === (ids(was)[i - 1] ?? 0) + 1)).toBe(true);
  expect(ids(was).at(-1)).toBe(was.head);

  await app.stop();
  await expect(app.fetch("/api/lists")).rejects.toThrow();
  await app.start();

  // restart: the stored board equals the one before, and the api answers the same board.
  expect(await app.state(board)).toEqual(before);
  // Byte for byte: the stored snapshot's digest and each entry's payload digest are the ones before the SIGKILL.
  const again = await app.log(board);
  expect(was.digest).toMatch(/^[0-9a-f]{64}$/);
  expect(again.digest).toBe(was.digest);
  expect(again.entries.map((e) => e.digest)).toEqual(was.entries.map((e) => e.digest));
  expect(again).toEqual(was);
  expect(JSON.stringify(await view(app))).toBe(shown);

  // next write: a toggle after the restart is applied to the restored board (done flips back).
  const done = before.todos.find((t) => t.id === todo)?.done;
  expect(await post(`/api/todos/${todo}/toggle`, { write: { key: "b1", base: 0, owner: "" } })).toBe(200);
  const after = await app.state(board);
  expect(after.todos.find((t) => t.id === todo)?.done).toBe(done === undefined ? undefined : !done);
  expect(after.todos).toHaveLength(2);
  // The log gained one entry, and its id is the head before the restart plus one.
  const next = await app.log(board);
  expect(ids(next).filter((id) => !ids(was).includes(id))).toEqual([was.head + 1]);
  expect(next.head).toBe(was.head + 1);
});
