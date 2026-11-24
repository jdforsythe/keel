import type { RouteTable } from "@keel/router";
import { pageHref } from "@keel/router/match";
import { identity } from "@keel/server";
import mount from "./identity.ts";

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

/** `POST /api/auth/sign-in/email`: sets the cookie to the posted name and answers 303 to the page the `next` search key names (`pageHref`), else `/`. */
async function handle(request: Request, _ctx: unknown, at: { readonly routes: RouteTable }): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== `${mount.path}/sign-in/email`) {
    return new Response(null, { status: 404 });
  }
  const name = new URLSearchParams(await request.text()).get("name") ?? "";
  if (name === "") return new Response(null, { status: 303, headers: { location: "/signin" } });
  const back = pageHref(at.routes, url.searchParams.get("next") ?? "");
  const headers = new Headers({ location: back.ok ? back.value : "/" });
  headers.append("set-cookie", `${COOKIE}=${encodeURIComponent(name)}; HttpOnly; SameSite=Lax; Path=/`);
  return new Response(null, { status: 303, headers });
}

export default identity({ identify, handle: { path: mount.path, fn: handle } });
