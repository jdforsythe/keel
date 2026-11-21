// Shared fixtures for std.conflicts conformance (not a test file). Property seed: 1337.
// This file is also the session group's user module: `openGroup({ user })` loads it in each worker (`routes`, `base`).
// Assumptions (the spec is silent, each is an ordinary reading of k.server / k.component / k.ctx):
// - `stores` factories ignore their argument, so `races` may call them with any ctx;
// - `user` is the file URL (a string) of this module; a route component receives `ctx` as its second argument;
// - `ctx.storage` holds a server store as the JSON text of its `snapshot()` under `keel.store.<id>` (a parsed value is
//   accepted on read too), and the hand-built server reads and writes it as k.server's Server state does.
import type { Ctx, SimCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import type { JsonValue } from "@keel/schema";
import type { openGroup } from "@keel/std-sessions/group";
import { invariant, store, transaction, tx } from "@keel/store";
import type { Snapshot } from "@keel/store";
import { Box, Button, Input, Text } from "@keel/ui";

export const SEED = 1337;
export const ORIGIN = "http://conflicts.test";
export const USER = new URL("./fixtures.ts", import.meta.url).href;
export const STORE_ID = "api.board";

export type Policy = "reject" | "rebase";
export type Options = { readonly edit?: Policy; readonly logLimit?: number };

const Todo = s.object({ id: s.string(), title: s.string(), done: s.boolean() });
const BoardState = s.object({ todos: s.array(Todo) });
export type BoardState = s.infer<typeof BoardState>;

/** The factory of `api.board`: `addTodo` and `toggleTodo` are `'rebase'`, `editTodo` is `opts.edit` (default `'rebase'`); titles are unique. */
export const boardStores =
  (opts: Options = {}) =>
  (_ctx?: unknown) => {
    const board = store(
      BoardState,
      { todos: [] },
      { id: STORE_ID, ...(opts.logLimit === undefined ? {} : { logLimit: opts.logLimit }) },
    );
    invariant(board, (st) => new Set(st.todos.map((t) => t.title)).size === st.todos.length);
    const addTodo = transaction(
      board,
      "api.addTodo",
      s.object({ id: s.string(), title: s.string() }),
      (st, p) => ({ todos: [...st.todos, { id: p.id, title: p.title, done: false }] }),
      { concurrent: "rebase" },
    );
    const editTodo = transaction(
      board,
      "api.editTodo",
      s.object({ id: s.string(), title: s.string() }),
      (st, p) => ({ todos: st.todos.map((t) => (t.id === p.id ? { ...t, title: p.title } : t)) }),
      { concurrent: opts.edit ?? "rebase" },
    );
    const toggleTodo = transaction(
      board,
      "api.toggleTodo",
      s.object({ id: s.string() }),
      (st, p) => ({ todos: st.todos.map((t) => (t.id === p.id ? { ...t, done: !t.done } : t)) }),
      { concurrent: "rebase" },
    );
    return { board, addTodo, editTodo, toggleTodo };
  };

export type Op =
  | { readonly t: "add"; readonly id: string; readonly title: string; readonly base?: number; readonly key?: string }
  | { readonly t: "edit"; readonly id: string; readonly title: string; readonly base?: number; readonly key?: string }
  | { readonly t: "toggle"; readonly id: string; readonly base?: number; readonly key?: string }
  | { readonly t: "undo" };

const writer = (op: { readonly base?: number; readonly key?: string }) => ({
  ...(op.base === undefined ? {} : { base: op.base }),
  ...(op.key === undefined ? {} : { key: op.key }),
});

/** Live stores after `ops` (every op must commit); the scope stays open until `dispose()`. */
export function open(opts: Options, ops: readonly Op[]) {
  const made: { snapshot: Snapshot<BoardState>; stores: ReturnType<ReturnType<typeof boardStores>> }[] = [];
  const sc = scope(() => {
    const st = boardStores(opts)();
    for (const op of ops) {
      if (op.t === "undo") {
        if (!st.board.undo()) throw new Error("fixture: nothing to undo");
        continue;
      }
      const r =
        op.t === "add"
          ? tx(st.addTodo, { id: op.id, title: op.title }, writer(op))
          : op.t === "edit"
            ? tx(st.editTodo, { id: op.id, title: op.title }, writer(op))
            : tx(st.toggleTodo, { id: op.id }, writer(op));
      if (!r.ok) throw new Error(`fixture: ${op.t} was refused`);
    }
    // a stored snapshot is JSON
    const snapshot: Snapshot<BoardState> = JSON.parse(JSON.stringify(st.board.snapshot()));
    made.push({ snapshot, stores: st });
  });
  const [first] = made;
  if (first === undefined) throw new Error("fixture: build failed");
  return { ...first, dispose: () => sc.dispose() };
}

/** The stored snapshot of `api.board` after `ops` (the live stores are disposed). */
export function snapshotOf(opts: Options, ops: readonly Op[]): Snapshot<BoardState> {
  const o = open(opts, ops);
  o.dispose();
  return o.snapshot;
}

// ---- the server for session groups -----------------------------------------------------------------------------

export const SEED_BOARD: { [store: string]: JsonValue } = {
  [STORE_ID]: {
    state: { todos: [{ id: "t1", title: "Milk", done: false }] },
    log: [],
    initial: { todos: [{ id: "t1", title: "Milk", done: false }] },
    head: 0,
  },
};

const isSnapshot = <T>(v: unknown): v is Snapshot<T> => typeof v === "object" && v !== null && "state" in v;

const Edit = s.object({
  id: s.string(),
  title: s.string(),
  write: s.object({ base: s.int(), key: s.string() }),
});

/** The server over a sim ctx: GET /api/board, POST /api/edit `{ id, title, write: { base, key } }`; other paths 404. */
export const serveWith =
  (edit: Policy) =>
  (ctx: SimCtx): { fetch(req: Request): Promise<Response> } => ({
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const headers = new Headers({ "content-type": "application/json" });
      if (url.pathname !== "/api/board" && url.pathname !== "/api/edit") {
        return new Response("{}", { status: 404, headers });
      }
      const body: unknown = req.method === "POST" ? await req.json() : null;
      const raw: unknown = await ctx.storage.get(`keel.store.${STORE_ID}`);
      const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
      const sets: unknown[] = [];
      let reply = "{}";
      let status = 200;
      const sc = scope(() => {
        const st = boardStores({ edit })();
        if (isSnapshot<BoardState>(parsed)) st.board.restore(parsed);
        if (url.pathname === "/api/edit") {
          const p = Edit.parse(body);
          if (!p.ok) status = 422;
          else {
            const r = tx(
              st.editTodo,
              { id: p.value.id, title: p.value.title },
              { base: p.value.write.base, key: p.value.write.key },
            );
            if (r.ok) sets.push(ctx.storage.set(`keel.store.${STORE_ID}`, JSON.stringify(st.board.snapshot())));
            else {
              status = r.error.code === "keel.conflict" ? 409 : 400;
              reply = JSON.stringify({ err: r.error.code });
            }
          }
        }
        if (status === 200) reply = JSON.stringify({ head: st.board.head(), todos: st.board.get("todos") });
      });
      sc.dispose();
      await Promise.all(sets);
      return new Response(reply, { status, headers });
    },
  });

// ---- the user module --------------------------------------------------------------------------------------------

const Reply = s.object({ head: s.int(), todos: s.array(Todo) });

const call = async (ctx: Ctx, method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> => {
  const init: RequestInit = {
    method,
    headers: { accept: "application/json", "x-keel": "1", "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await ctx.net.fetch(new Request(`${ORIGIN}${path}`, init));
  return res.json();
};

function build() {
  const View = s.object({ head: s.int(), title: s.string(), draft: s.string(), status: s.string() });
  const view = store(View, { head: 0, title: "", draft: "", status: "" }, { id: "view" });
  const setServer = transaction(view, "view.setServer", s.object({ head: s.int(), title: s.string() }), (st, p) => ({
    ...st,
    ...p,
  }));
  const setDraft = transaction(view, "view.setDraft", s.object({ draft: s.string() }), (st, p) => ({ ...st, ...p }));
  const setStatus = transaction(view, "view.setStatus", s.object({ status: s.string() }), (st, p) => ({
    ...st,
    ...p,
  }));
  const act = async (ctx: Ctx, method: "GET" | "POST", path: string, body?: unknown): Promise<void> => {
    try {
      const r = Reply.parse(await call(ctx, method, path, body));
      if (r.ok) {
        const t1 = r.value.todos.find((t) => t.id === "t1");
        void tx(setServer, { head: r.value.head, title: t1?.title ?? "" });
        void tx(setStatus, { status: "ok" });
      } else void tx(setStatus, { status: "refused" });
    } catch {
      void tx(setStatus, { status: "offline" });
    }
  };
  const todoContract = contract("todo", { "todo.show": { path: "/todos" } });
  const routes = manifest(todoContract, {
    "todo.show": {
      component(_props: unknown, ctx: Ctx): Node {
        return Box({
          as: "main",
          id: "todo.page",
          children: () => [
            Input({ id: "todo.draft", label: "Title", onInput: (v) => void tx(setDraft, { draft: v }) }),
            Button({ id: "todo.refresh", children: "Refresh", onClick: () => void act(ctx, "GET", "/api/board") }),
            Button({
              id: "todo.save",
              children: "Save",
              onClick: () =>
                void act(ctx, "POST", "/api/edit", {
                  id: "t1",
                  title: view.get("draft"),
                  write: { base: view.get("head"), key: ctx.random.id("Write") },
                }),
            }),
            Text({ id: "todo.title", children: () => view.get("title") }),
            Text({ id: "todo.status", children: () => view.get("status") }),
          ],
        });
      },
    },
  });
  return { routes };
}

const made: ReturnType<typeof build>[] = [];
scope(() => {
  made.push(build());
});
const [built] = made;
if (built === undefined) throw new Error("conflicts fixture: build failed");

/** The user module's route table. */
export const routes = built.routes;
/** The route every user starts at. */
export const base = { id: "todo.show", params: {}, search: {} };

type Group = Awaited<ReturnType<typeof openGroup>>;

/** The options `openGroup` takes: two users, the seeded board, the server with `edit` as `editTodo`'s policy. */
export const groupOptions = (edit: Policy, seed = SEED) => ({
  user: USER,
  serve: serveWith(edit),
  users: 2,
  seed,
  origin: ORIGIN,
  server: SEED_BOARD,
});

/**
 * The lost update: both users read the board (head 0); user 0 renames `t1` to `first` and saves (entry 1); user 1,
 * still holding head 0, renames it to `second` and saves (entry 2, rebased with base 0 under `'rebase'`).
 */
export async function lostUpdate(g: Group, first = "Oat milk", second = "Soy milk"): Promise<void> {
  const click = async (u: 0 | 1, id: string): Promise<void> => {
    await g.user(u).fire(id, { type: "click" });
    await g.settle();
    await g.advance(1);
  };
  const type = async (u: 0 | 1, value: string): Promise<void> => {
    await g.user(u).fire("todo.draft", { type: "input", value });
    await g.settle();
    await g.advance(1);
  };
  await click(0, "todo.refresh");
  await click(1, "todo.refresh");
  await type(0, first);
  await click(0, "todo.save");
  await type(1, second);
  await click(1, "todo.save");
}
