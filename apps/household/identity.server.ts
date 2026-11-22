import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import { identity } from "@keel/server";
import { NoRows, sql } from "@keel/std-postgres";
import mount from "./identity.ts";
import { app } from "./modules/app/app.contract.ts";
import type { SignError } from "./modules/members/SignError.schema.ts";
import { SignedInUser } from "./modules/members/SignedInUser.schema.ts";
import { authOf } from "./modules/members/authOf.server.ts";
import { authSettings } from "./modules/members/authSettings.server.ts";
import { bearerUser } from "./modules/members/bearerUser.server.ts";
import { members } from "./modules/members/members.contract.ts";
import { membersDb } from "./modules/members/membersDb.server.ts";

// Fail closed: a server without the sign-in library's secret does not start.
const settings = authSettings(process.env, process.execArgv);
if (!settings.ok) {
  process.stdout.write(`${settings.error.code} ${settings.error.message}\n`);
  process.exit(1);
}

/** The library, or a rejection that the server answers 500 `keel.unexpected`. */
async function library(ctx: Ctx) {
  const auth = await authOf(ctx);
  return auth.ok ? auth.value : Promise.reject(new Error(auth.error.code));
}

/**
 * Who made the request: the member an `authorization` API token acts for when that header is present, else the member
 * of the library's session cookie; `''` for no one. A present `authorization` header decides alone: an invalid,
 * expired or revoked token is no one, and the cookie is not tried in its place.
 */
async function identify(args: { readonly request: Request }, ctx: Ctx): Promise<string> {
  const header = args.request.headers.get("authorization");
  if (header !== null) return bearerUser(header, ctx);
  const session = await (await library(ctx)).api.getSession({ headers: args.request.headers });
  return session?.user.id ?? "";
}

/**
 * After a sign-in the library accepted, the member's id, email and sign-up name are kept in the `members` table, so
 * the profile page reads them without calling the library. A later sign-in updates the email only: the name is the
 * member's to change on the profile page. A save that fails rejects, answered 500.
 */
async function remember(path: string, res: Response, ctx: Ctx): Promise<Response> {
  if (path !== `${mount.path}/sign-in/email` || !res.ok) return res;
  const json = await attempt(() => res.clone().json());
  const signed = SignedInUser.parse(json.ok ? json.value : null);
  if (!signed.ok) return Promise.reject(new Error("sign-in answer without a user"));
  const { id, email, name } = signed.value.user;
  const saved = await membersDb(ctx).run(
    sql(NoRows)`insert into members (user_id, email, name) values (${id}, ${email}, ${name})
                on conflict (user_id) do update set email = excluded.email`,
  );
  return saved.ok ? res : Promise.reject(new Error(saved.error.code));
}

/** A post a page's `<Form>` made natively, as opposed to a JSON call to the library's API. */
const isFormPost = (r: Request): boolean =>
  r.method === "POST" && (r.headers.get("content-type") ?? "").startsWith("application/x-www-form-urlencoded");

/** The search key the page shows for a refused post. */
const refusal = (res: Response): SignError => (res.status === 401 ? "credentials" : "invalid");

/** `next` when it is a path on this origin (one leading `/`, no scheme or host), else none. */
function local(next: string | null): string | undefined {
  if (next === null) return undefined;
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : undefined;
}

/**
 * The library's endpoints. A JSON call passes through unchanged. A page's form post is sent to the library as the JSON
 * body its endpoints take (the form's fields, nothing added) and answered with a 303 carrying the library's
 * `set-cookie`: a sign-in to the page the guard sent the member from (the post's `next` search key) or the start page,
 * a sign-up or a sign-out to the sign-in page, and a refusal back to the posting page with `?error=`. The typed values
 * never go into a URL.
 */
async function handle(request: Request, ctx: Ctx): Promise<Response> {
  const auth = await library(ctx);
  const url = new URL(request.url);
  if (!isFormPost(request)) return remember(url.pathname, await auth.handler(request), ctx);
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  const fields = Object.fromEntries(new URLSearchParams(await request.text()));
  const sent = new Request(new URL(url.pathname, url.origin), {
    method: "POST",
    headers,
    body: JSON.stringify(fields),
  });
  const res = await remember(url.pathname, await auth.handler(sent), ctx);
  const next = local(url.searchParams.get("next"));
  const kept = next === undefined ? {} : { next };
  const signUp = url.pathname === `${mount.path}/sign-up/email`;
  const signIn = url.pathname === `${mount.path}/sign-in/email`;
  const to = !res.ok
    ? members.href(signUp ? "members.signup" : "members.signin", {}, { error: refusal(res), ...kept })
    : signIn
      ? (next ?? app.href("app.start"))
      : members.href("members.signin", {}, kept);
  const answer = new Headers({ location: to });
  for (const cookie of res.headers.getSetCookie()) answer.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers: answer });
}

export default identity({ identify, handle: { path: mount.path, fn: handle } });
