import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { renderRoute } from "@keel/testing";
import { membersDb } from "../modules/members/membersDb.server.ts";
import { Copy } from "../modules/shopping/Copy.schema.ts";
import { served, signIn } from "./serve.ts";

const UserRow = s.object({ userId: s.string() });
export const GRACE = "grace@example.com";

/** One household with two members: Ada (`served`'s member) and Grace, each signed in with a session cookie. */
export async function household(seed: number) {
  const app = await served(seed);
  const grace = await signIn(app.raw, GRACE, "Grace Hopper");
  const rows = await membersDb(app.ctx).query(sql(UserRow)`select user_id as "userId" from members`);
  const graceId = (rows.ok ? rows.value : []).map((r) => r.userId).find((id) => id !== app.user) ?? "";
  const ada = await signIn(app.raw);
  return { ...app, adaCookie: ada, graceCookie: grace, graceId };
}

/**
 * The list page signed in as `user` (`h.user` is Ada, `h.graceId` Grace), in a browser of its own: the route table is
 * imported into a client module graph of the harness's own, so two members' pages keep their own client stores and
 * widgets while they share the server (k.user Testing).
 */
export const listPage = (h: Awaited<ReturnType<typeof household>>, user: string) =>
  renderRoute("shopping.list", { routes: () => import("./webRoutes.ts"), params: {}, ctx: h.ctx, app: h.app, user });

/** The client copy of the list a page holds (`shopping.copy`, k.testing `state()`). */
export const copyOf = (page: { state(): Readonly<Record<string, unknown>> }) => {
  const r = Copy.parse(page.state()["shopping.copy"]);
  if (!r.ok) throw new Error(`no shopping.copy on the page: ${r.error.message}`);
  return r.value;
};

/** An open event stream of the list channel with `cookie` (`''`: a visitor); `next()` reads its next event. */
export async function stream(h: Awaited<ReturnType<typeof household>>, cookie: string) {
  const res = await h.raw(
    new Request("http://localhost/api/items/events", {
      headers: { accept: "text/event-stream", ...(cookie === "" ? {} : { cookie }) },
    }),
  );
  const body = res.body;
  if (body === null) throw new Error("the stream has no body");
  const reader = body.getReader();
  const text = new TextDecoder();
  let buffered = "";
  const next = async (): Promise<unknown> => {
    for (;;) {
      const line = buffered.split("\n").find((l) => l.startsWith("data:"));
      if (line !== undefined) {
        buffered = buffered.slice(buffered.indexOf(line) + line.length + 1);
        return JSON.parse(line.slice(5));
      }
      const chunk = await reader.read();
      if (chunk.done) return null;
      buffered += text.decode(chunk.value);
    }
  };
  return { res, next, close: () => reader.cancel() };
}
