// Shared fixtures for std.multi conformance (not a test file). Property seed: 1337.
// This file is also the group's user module: `openGroup({ user })` loads it in each worker and reads `routes` and `base`.
// Assumptions (the spec is silent, each is an ordinary reading of k.component / k.ctx / k.server):
// - `user` is the file URL (a string) of this module;
// - a route component receives `ctx` as its third argument (k.component Shape);
// - `ctx.storage` holds a server store as the JSON text of its `snapshot()` under `keel.store.<id>` (a parsed value is
//   accepted on read too), and `serve(ctx)` reads and writes it through `ctx.storage` (k.server Server state);
// - the server mints the caller cookie `keel-caller` itself (a hand-built `{ fetch }`, as createApp does, over http).
import type { Ctx, SimCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import type { JsonValue } from "@keel/schema";
import type { openGroup } from "@keel/std-sessions/group";
import { store, transaction, tx } from "@keel/store";
import type { Snapshot } from "@keel/store";
import { Box, Button, Input, Text } from "@keel/ui";

export const SEED = 1337;
export const ORIGIN = "http://group.test";
export const USER = new URL("./group-fixtures.ts", import.meta.url).href;

type Group = Awaited<ReturnType<typeof openGroup>>;

// ---- the server -------------------------------------------------------------------------------------------------

const Board = s.object({ title: s.string() });
const Log = s.object({ items: s.array(s.string()) });

const serverStores = () => {
  const board = store(Board, { title: "Milk" }, { id: "board" });
  const log = store(Log, { items: [] }, { id: "log" });
  const setTitle = transaction(board, "board.setTitle", s.object({ title: s.string() }), (_st, p) => ({
    title: p.title,
  }));
  const append = transaction(log, "log.append", s.object({ text: s.string() }), (st, p) => ({
    items: [...st.items, p.text],
  }));
  return { board, log, setTitle, append };
};

const isSnapshot = <T>(v: unknown): v is Snapshot<T> => typeof v === "object" && v !== null && "state" in v;

const load = async <T>(ctx: SimCtx, id: string): Promise<Snapshot<T> | undefined> => {
  const raw: unknown = await ctx.storage.get(`keel.store.${id}`);
  const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  return isSnapshot<T>(parsed) ? parsed : undefined;
};

export const ItemsState = s.object({ items: s.array(s.string()) });
export const TitleState = s.object({ title: s.string() });

const Title = s.object({ title: s.string() });
const Text1 = s.object({ text: s.string() });

/** The server over a sim ctx: GET /api/board, POST /api/title, POST /api/append; other paths 404. */
export function serve(ctx: SimCtx): { fetch(req: Request): Promise<Response> } {
  return {
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const headers = new Headers({ "content-type": "application/json" });
      const m = /(?:^|; )keel-caller=([^;]+)/.exec(req.headers.get("cookie") ?? "");
      const caller = m?.[1] ?? ctx.random.id("Caller");
      if (m === null) headers.append("set-cookie", `keel-caller=${caller}; Path=/`);
      const known = url.pathname === "/api/board" || url.pathname === "/api/title" || url.pathname === "/api/append";
      if (!known) return new Response("{}", { status: 404, headers });
      const body: unknown = req.method === "POST" ? await req.json() : null;
      const boardSnap = await load<{ title: string }>(ctx, "board");
      const logSnap = await load<{ items: string[] }>(ctx, "log");
      const sets: unknown[] = [];
      let reply = "{}";
      let status = 200;
      const sc = scope(() => {
        const st = serverStores();
        if (boardSnap !== undefined) st.board.restore(boardSnap);
        if (logSnap !== undefined) st.log.restore(logSnap);
        if (url.pathname === "/api/title") {
          const p = Title.parse(body);
          if (p.ok) void tx(st.setTitle, p.value, { meta: { caller } });
          else status = 422;
        }
        if (url.pathname === "/api/append") {
          const p = Text1.parse(body);
          if (p.ok) void tx(st.append, p.value, { meta: { caller } });
          else status = 422;
        }
        if (req.method === "POST") {
          sets.push(ctx.storage.set("keel.store.board", JSON.stringify(st.board.snapshot())));
          sets.push(ctx.storage.set("keel.store.log", JSON.stringify(st.log.snapshot())));
        }
        reply = JSON.stringify({
          title: st.board.get("title"),
          head: st.log.head() + st.board.head(),
          items: st.log.get("items"),
          caller,
        });
      });
      sc.dispose();
      await Promise.all(sets);
      return new Response(reply, { status, headers });
    },
  };
}

// ---- the user module --------------------------------------------------------------------------------------------

const Reply = s.object({
  title: s.string(),
  head: s.int(),
  items: s.array(s.string()),
  caller: s.string(),
});

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
  const View = s.object({
    title: s.string(),
    head: s.int(),
    items: s.array(s.string()),
    caller: s.string(),
    note: s.string(),
    status: s.string(),
  });
  const view = store(View, { title: "", head: 0, items: [], caller: "", note: "", status: "" }, { id: "view" });
  const setServer = transaction(view, "view.setServer", Reply, (st, p) => ({ ...st, ...p }));
  const setNote = transaction(view, "view.setNote", s.object({ note: s.string() }), (st, p) => ({ ...st, ...p }));
  const setStatus = transaction(view, "view.setStatus", s.object({ status: s.string() }), (st, p) => ({
    ...st,
    ...p,
  }));
  const act = async (ctx: Ctx, method: "GET" | "POST", path: string, body?: unknown): Promise<void> => {
    try {
      const r = Reply.parse(await call(ctx, method, path, body));
      if (r.ok) {
        void tx(setServer, r.value);
        void tx(setStatus, { status: "ok" });
      } else void tx(setStatus, { status: "bad" });
    } catch {
      void tx(setStatus, { status: "offline" });
    }
  };
  const routes = manifest({
    "board.show": {
      path: "/board",
      component(_props: unknown, _slots: unknown, ctx?: Ctx): Node {
        if (ctx === undefined) throw new Error("fixture: the component got no ctx");
        return Box({
          as: "main",
          id: "board.page",
          children: () => [
            Input({ id: "board.note", label: "Note", onInput: (v) => void tx(setNote, { note: v }) }),
            Text({ id: "board.local", children: () => view.get("note") }),
            Button({ id: "board.refresh", children: "Refresh", onClick: () => void act(ctx, "GET", "/api/board") }),
            Button({
              id: "board.write",
              children: "Write",
              onClick: () => void act(ctx, "POST", "/api/append", { text: view.get("note") }),
            }),
            Button({
              id: "board.rename",
              children: "Rename",
              onClick: () => void act(ctx, "POST", "/api/title", { title: view.get("note") }),
            }),
            Button({
              id: "board.probe",
              children: "Probe",
              onClick: () => void tx(setStatus, { status: String(ctx.net.online()) }),
            }),
            Text({ id: "board.title", children: () => view.get("title") }),
            Text({ id: "board.caller", children: () => view.get("caller") }),
            Text({ id: "board.items", children: () => view.get("items").join(",") }),
            Text({ id: "board.status", children: () => view.get("status") }),
          ],
        });
      },
    },
  });
  return { view, routes };
}

const made: ReturnType<typeof build>[] = [];
scope(() => {
  made.push(build());
});
const [built] = made;
if (built === undefined) throw new Error("group fixture: build failed");

/** The route table the group's users render (the user module's `routes`). */
export const routes = built.routes;
/** The route every user starts at (the user module's `base`). */
export const base = { id: "board.show", params: {}, search: {} };
/** The client store, for seeding `renderRoute` state. */
export const clientView = built.view;
export const EMPTY_VIEW = { title: "", head: 0, items: [], caller: "", note: "", status: "" };

// ---- driving ---------------------------------------------------------------------------------------------------

export type Step =
  | { readonly u: 0 | 1; readonly do: "note"; readonly v: string }
  | { readonly u: 0 | 1; readonly do: "refresh" | "write" | "rename" | "probe" }
  | { readonly u: 0 | 1; readonly do: "online"; readonly b: boolean }
  | { readonly advance: number };

/** The options `openGroup` takes for this module and server. */
export const groupOptions = (seed = SEED, users = 2, server: { [store: string]: JsonValue } = {}) => ({
  user: USER,
  serve,
  users,
  seed,
  origin: ORIGIN,
  server,
});

/** Runs `steps` on `g`, settling after each. */
export async function drive(g: Group, steps: readonly Step[]): Promise<void> {
  for (const st of steps) {
    if ("advance" in st) {
      await g.advance(st.advance);
    } else if (st.do === "online") {
      await g.setOnline(st.u, st.b);
    } else if (st.do === "note") {
      await g.user(st.u).fire("board.note", { type: "input", value: st.v });
    } else {
      await g.user(st.u).fire(`board.${st.do}`, { type: "click" });
    }
    await g.settle();
  }
}

/** Each user's text of element `id`, after the script. */
export async function texts(g: Group, id: string, users = 2): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < users; i++) out.push((await g.user(i).find(id)).text);
  return out;
}
