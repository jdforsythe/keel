import type { SimCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { service } from "@keel/services";
import { TodoIdParams } from "../modules/api/TodoIdParams.schema.ts";
import { api } from "../modules/api/api.contract.ts";
import { boardOf } from "./at.ts";
import { BOARD_KEY, apiCtx } from "./simApi.ts";
import { write } from "./write.ts";

/** One answer the api gave a client: `METHOD /path`, its status and, for an error body, its `code`. */
export type Answer = { readonly call: string; readonly status: number; readonly code: string };

/** The board two users share: list Home with Milk (t1) and Bread (t2), head 0. */
export const shared = boardOf({
  lists: [{ id: "l1", name: "Home" }],
  todos: [
    { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false },
    { id: "t2", listId: "l1", title: "Bread", priority: "normal", done: false },
  ],
});

const T1 = TodoIdParams.parse({ todoId: "t1" });
/** Todo Milk's route params. */
export function milk(): TodoIdParams {
  if (!T1.ok) throw new Error(T1.error.message);
  return T1.value;
}

const writes = service({ contract: api });

/** The other user's browser edits Milk's title straight through the api, naming the head it read. */
export const otherEdit = (ctx: Ctx, title: string, key: string, base: number) =>
  writes.editTodo({ params: milk(), body: { title, priority: "normal", write: write(key, base) } }, ctx);

const T2 = TodoIdParams.parse({ todoId: "t2" });
/** The other user's browser marks Bread done (a flip) straight through the api, naming the head it read. */
export function otherToggleBread(ctx: Ctx, key: string, base: number) {
  if (!T2.ok) throw new Error(T2.error.message);
  return writes.toggleTodo({ params: T2.value, body: { write: write(key, base) } }, ctx);
}

/** Read the `code` of a k.server error body, `""` for any other body. */
async function codeOf(res: Response): Promise<string> {
  if (res.status < 400 || !(res.headers.get("content-type") ?? "").includes("json")) return "";
  const body: unknown = await res.clone().json();
  if (typeof body !== "object" || body === null || !("error" in body)) return "";
  const e = body.error;
  return typeof e === "object" && e !== null && "code" in e && typeof e.code === "string" ? e.code : "";
}

/**
 * A browser on `ctx`: every `/api/*` request goes to `app` with this browser's cookie, as `simApi` does, and each answer
 * is logged. `hold(req)` is how many ms on `ctx.clock` the request waits before it reaches the api (0: none), so a test
 * can order one kind of request after another; `cut()` ends every open event stream as a dropped connection would, and
 * `loseNext(which)` drops the connection after the api applied a request, before its answer arrives.
 */
export function browser(
  ctx: SimCtx,
  app: { fetch(req: Request): Promise<Response> },
  hold: (req: Request) => number = () => 0,
) {
  /** The request to lose: it reaches the api, then the connection drops before its answer. */
  let lose: ((req: Request) => boolean) | undefined;
  const answers: Answer[] = [];
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  let jar = "";
  ctx.net.route(new URL("/api/*", location.href).href, async (req) => {
    const ms = hold(req);
    if (ms > 0) await ctx.clock.after(ms);
    if (jar !== "") req.headers.set("cookie", jar);
    const res = await app.fetch(req);
    jar = res.headers.get("set-cookie")?.split(";")[0] ?? jar;
    answers.push({ call: `${req.method} ${new URL(req.url).pathname}`, status: res.status, code: await codeOf(res) });
    if (lose?.(req) === true) {
      lose = undefined;
      ctx.net.setOnline(false);
      cut();
      throw new TypeError("connection lost");
    }
    if (res.body === null || !(res.headers.get("content-type") ?? "").includes("event-stream")) return res;
    const reader = res.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        streams.push(c);
      },
      async pull(c) {
        const next = await reader.read().catch(() => ({ done: true, value: undefined }));
        if (next.done === true || next.value === undefined) c.close();
        else c.enqueue(next.value);
      },
      cancel() {
        void reader.cancel();
      },
    });
    return new Response(body, { status: res.status, headers: res.headers });
  });
  function cut(): number {
    const open = streams.splice(0);
    for (const c of open) {
      try {
        c.error(new TypeError("connection lost"));
      } catch {
        // A stream the page already closed has nothing to cut.
      }
    }
    return open.length;
  }
  /** The next request `which` accepts is applied by the api, then the connection drops before its answer. */
  const loseNext = (which: (req: Request) => boolean): void => {
    lose = which;
  };
  return { ctx, answers, cut, loseNext };
}

/** How many entries of transaction `name` the api's stored board log holds. */
export async function commits(name: string): Promise<number> {
  const raw = await apiCtx().storage.get(BOARD_KEY);
  const snap: unknown = raw === null ? null : JSON.parse(raw);
  const log = typeof snap === "object" && snap !== null && "log" in snap && Array.isArray(snap.log) ? snap.log : [];
  return log.filter((e: unknown) => typeof e === "object" && e !== null && "name" in e && e.name === name).length;
}

/** The api's stored board head. */
export async function storedHead(): Promise<number> {
  const raw = await apiCtx().storage.get(BOARD_KEY);
  const snap: unknown = raw === null ? null : JSON.parse(raw);
  return typeof snap === "object" && snap !== null && "head" in snap && typeof snap.head === "number" ? snap.head : 0;
}
