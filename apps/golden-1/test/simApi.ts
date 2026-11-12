import { type SimCtx, createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { Board } from "../modules/api/Board.schema.ts";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";

/** Where the api deployable keeps `api.board` (k.server Server state: `ctx.storage` key `keel.store.<id>`). */
export const BOARD_KEY = "keel.store.api.board";

let server: SimCtx = createCtx({ mode: "sim", seed: 7 });

/** Forget the api's storage: the next `apiApp`/`simApi` serves an empty board (call in `afterEach`). */
export function resetApi(): void {
  server = createCtx({ mode: "sim", seed: 7 });
}

/** The api's sim ctx: its `storage` is the board's persistence, shared by every `apiApp` until `resetApi`. */
export const apiCtx = (): SimCtx => server;

/** Serve the real `api` deployable over the api's sim ctx, as its generated entry does over the real one. */
export const apiApp = () => createApp({ topology, routes: apiRoutes, ctx: server, deployable: "api" });

/** Store `state` as the api's board (empty log), for apps built after this call. */
export const seedBoard = (state: Board): Promise<void> =>
  server.storage.set(BOARD_KEY, JSON.stringify({ state, log: [], initial: state }));

/** The api's saved board: what every later request restores (empty when nothing was saved). */
export async function readBoard(): Promise<Board> {
  const raw = await server.storage.get(BOARD_KEY);
  const snap: unknown = raw === null ? null : JSON.parse(raw);
  const state = typeof snap === "object" && snap !== null && "state" in snap ? snap.state : { lists: [], todos: [] };
  const parsed = Board.parse(state);
  if (!parsed.ok) throw new Error(`saved board does not parse: ${parsed.error.message}`);
  return parsed.value;
}

/**
 * A sim ctx whose net sends every `/api/*` request to the real `api` deployable, so client code gets the k.server
 * runtime `Result` bodies; `sent` records `METHOD /path` of each request. It keeps the `keel-caller` cookie the api
 * sets, as a browser would, so undo is scoped to this client. happy-dom drops `cookie` and `set-cookie` passed at
 * construction, but not set on the headers afterwards.
 */
export async function simApi(seed = 1) {
  const app = await apiApp();
  const ctx = createCtx({ mode: "sim", seed });
  const sent: string[] = [];
  let jar = "";
  ctx.net.route(new URL("/api/*", location.href).href, async (req) => {
    sent.push(`${req.method} ${new URL(req.url).pathname}`);
    if (jar !== "") req.headers.set("cookie", jar);
    const res = await app.fetch(req);
    jar = res.headers.get("set-cookie")?.split(";")[0] ?? jar;
    return res;
  });
  return { ctx, sent };
}
