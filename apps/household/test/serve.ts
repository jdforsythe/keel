import { type SimCtx, createCtx } from "@keel/ctx";
import { routeTable } from "@keel/router";
import { s } from "@keel/schema";
import { createApp } from "@keel/server";
import { sql } from "@keel/std-postgres";
import source from "../identity.server.ts";
import mount from "../identity.ts";
import { routes as app } from "../modules/app/routes.ts";
import { membersApi } from "../modules/members/membersApi.ts";
import { membersDb } from "../modules/members/membersDb.server.ts";
import { routes as members } from "../modules/members/routes.ts";
import { routes as receipts } from "../modules/receipts/routes.ts";
import { routes as setup } from "../modules/setup/routes.ts";
import { routes as shopping } from "../modules/shopping/routes.ts";
import topology from "../topology.ts";

/** The `web` deployable's route table, as its generated entry joins it. */
export const webRoutes = routeTable(app, members, receipts, setup, shopping);

export const NAME = "Ada Lovelace";
export const EMAIL = "ada@example.com";
export const PASSWORD = "analytical engine";

const UserRow = s.object({ userId: s.string() });

type Fetch = (r: Request) => Promise<Response>;

/** The cookie pairs a response sets, as a `cookie` header sends them back. */
const cookiesOf = (res: Response): string =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0] ?? "")
    .filter((c) => !c.endsWith("="))
    .join("; ");

/** A native form post of `fields` to `path`, same-origin, as a page's `<Form>` sends it. */
export const formPost = (path: string, fields: Record<string, string>, cookie = ""): Request =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-site": "same-origin",
      ...(cookie === "" ? {} : { cookie }),
    },
    body: new URLSearchParams(fields).toString(),
  });

/** Sign up and sign in `email` through the identity mount; resolves the session cookie, `''` when refused. */
export async function signIn(fetch: Fetch, email = EMAIL, name = NAME): Promise<string> {
  await fetch(formPost(mount.href("/sign-up/email"), { name, email, password: PASSWORD }));
  return cookiesOf(await fetch(formPost(mount.href("/sign-in/email"), { email, password: PASSWORD })));
}

/**
 * A sim ctx whose net answers every request with the `web` deployable served over that same ctx, so a page under
 * `renderRoute` and the API share one `ctx.storage` and one database. Unless `signedIn` is false, one member has
 * signed up and signed in through the identity mount, and minted an API token through the members API: `fetch` sends
 * that token with every request that carries no `cookie` or `authorization` of its own, and `user` is the member's id
 * for `renderRoute`. A token, not the session cookie: under happy-dom a `Response` drops `set-cookie`. `sent` lists
 * `METHOD /path` of what reached the net, and `lines` every line the server logged.
 */
export async function served(
  seed = 1,
  signedIn = true,
): Promise<{
  ctx: SimCtx;
  sent: string[];
  lines: string[];
  fetch: Fetch;
  raw: Fetch;
  user: string;
  token: string;
}> {
  const ctx = createCtx({ mode: "sim", seed });
  const lines: string[] = [];
  const web = await createApp({
    topology,
    routes: webRoutes,
    ctx,
    deployable: "web",
    identity: source,
    log: { format: "json", write: (line: string) => lines.push(line) },
  });
  const raw: Fetch = (req) => web.fetch(req);
  if (signedIn) await signIn(raw);
  const rows = await membersDb(ctx).query(sql(UserRow)`select user_id as "userId" from members`);
  const user = rows.ok ? (rows.value[0]?.userId ?? "") : "";
  const minted = user === "" ? null : await membersApi.mint({ body: { days: 30 }, user }, ctx);
  const token = minted?.ok === true ? minted.value.token : "";
  const sent: string[] = [];
  const fetch: Fetch = (req) => {
    sent.push(`${req.method} ${new URL(req.url).pathname}`);
    if (token === "" || req.headers.has("cookie") || req.headers.has("authorization")) return web.fetch(req);
    const headers = new Headers(req.headers);
    headers.set("authorization", `Bearer ${token}`);
    return web.fetch(new Request(req, { headers }));
  };
  ctx.net.route("http://localhost/api/*", fetch);
  ctx.net.route("http://members.keel.invalid/*", fetch);
  ctx.net.route("http://setup.keel.invalid/*", fetch);
  ctx.net.route("http://shopping.keel.invalid/*", fetch);
  return { ctx, sent, lines, fetch, raw, user, token };
}

/** A JSON request as a services client sends it. */
export const asJson = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Request =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
