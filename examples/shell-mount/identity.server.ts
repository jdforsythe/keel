import { type RouteTable, routeTable } from "@keel/router";
import { pageHref } from "@keel/router/match";
import { defect } from "@keel/schema";
import { identity } from "@keel/server";
import mount from "./identity.ts";
import { routes as web } from "./modules/notes/routes.ts";

// A stand-in for an auth library, so the example runs alone: the name typed on the sign-in page becomes the user.
// A real app hands `identify` and `handle` to its library (keel-server, Identity).
const COOKIE = "demo-user";

/** The name the `demo-user` cookie holds, `''` for none. */
function identify(args: { readonly request: Request }): Promise<string> {
  const pair = (args.request.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));
  return Promise.resolve(pair === undefined ? "" : decodeURIComponent(pair.slice(COOKIE.length + 1)));
}

let joined: { readonly of: RouteTable; readonly table: RouteTable } | undefined;

/** The table of `at` joined with the `web` deployable's, built once for the table it was given. */
function joinedTable(at: RouteTable): RouteTable {
  if (joined === undefined || joined.of !== at) joined = { of: at, table: routeTable(at, web) };
  return joined.table;
}

/** `POST /api/auth/sign-in/email`: sets the cookie to the posted name and answers 303 to the page the `next` search key names (`pageHref`), else `/`. */
async function handle(request: Request, _ctx: unknown, at: { readonly routes: RouteTable }): Promise<Response> {
  const url = URL.parse(request.url) ?? defect("a request has an address");
  if (request.method !== "POST" || url.pathname !== `${mount.path}/sign-in/email`) {
    return new Response(null, { status: 404 });
  }
  const name = new URLSearchParams(await request.text()).get("name") ?? "";
  if (name === "") return new Response(null, { status: 303, headers: { location: "/signin" } });
  // The `api` deployable serves no page: the pages a sign-in returns to are the `web` deployable's, so they join its table.
  const back = pageHref(joinedTable(at.routes), url.searchParams.get("next") ?? "");
  const headers = new Headers({ location: back.ok ? back.value : "/" });
  headers.append("set-cookie", `${COOKIE}=${encodeURIComponent(name)}; HttpOnly; SameSite=Lax; Path=/`);
  return new Response(null, { status: 303, headers });
}

export default identity({ identify, handle: { path: mount.path, fn: handle } });
