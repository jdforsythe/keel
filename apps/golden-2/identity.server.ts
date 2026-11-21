import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import { identity } from "@keel/server";
import { NoRows, sql } from "@keel/std-postgres";
import mount from "./identity.ts";
import type { AccountError } from "./modules/accounts/AccountError.schema.ts";
import { AccountsLocale } from "./modules/accounts/AccountsLocale.schema.ts";
import { SignedInUser } from "./modules/accounts/SignedInUser.schema.ts";
import { accounts } from "./modules/accounts/accounts.contract.ts";
import { accountsDb } from "./modules/accounts/accountsDb.server.ts";
import { authOf } from "./modules/accounts/authOf.server.ts";
import { authSettings } from "./modules/accounts/authSettings.server.ts";
import { bearerUser } from "./modules/accounts/bearerUser.server.ts";

// Fail closed: a server without the library's secret does not start.
const settings = authSettings(process.env, process.execArgv);
if (!settings.ok) {
  process.stdout.write(`${settings.error.code} ${settings.error.message}\n`);
  process.exit(1);
}

/** The library, or a rejection that `createApp` answers 500 `keel.unexpected`. */
async function library(ctx: Ctx) {
  const auth = await authOf(ctx);
  return auth.ok ? auth.value : Promise.reject(new Error(auth.error.code));
}

/**
 * Who made the request: the user an `authorization` API token acts for when the header is present, else the user of
 * the library's session cookie; `''` for no one. A present `authorization` header decides alone: an invalid token is no
 * one, and the cookie is not tried in its place.
 */
async function identify(args: { readonly request: Request }, ctx: Ctx): Promise<string> {
  const header = args.request.headers.get("authorization");
  if (header !== null) return bearerUser(header, ctx);
  const session = await (await library(ctx)).api.getSession({ headers: args.request.headers });
  return session?.user.id ?? "";
}

/**
 * After a sign-in the library accepted, the user's id and email are upserted into the `profiles` table, so `/api/me`
 * answers without calling the library. A save that fails rejects: `createApp` answers 500.
 */
async function remember(path: string, res: Response, ctx: Ctx): Promise<Response> {
  if (path !== `${mount.path}/sign-in/email` || !res.ok) return res;
  const json = await attempt(() => res.clone().json());
  const signed = SignedInUser.parse(json.ok ? json.value : null);
  if (!signed.ok) return Promise.reject(new Error("sign-in answer without a user"));
  const { id, email } = signed.value.user;
  const saved = await accountsDb(ctx).run(
    sql(NoRows)`insert into profiles (user_id, email) values (${id}, ${email})
                on conflict (user_id) do update set email = excluded.email`,
  );
  return saved.ok ? res : Promise.reject(new Error(saved.error.code));
}

/** A post a page's `<Form>` made natively, as opposed to a JSON call to the library's API. */
const isFormPost = (r: Request): boolean =>
  r.method === "POST" && (r.headers.get("content-type") ?? "").startsWith("application/x-www-form-urlencoded");

/** The search key the page shows for a refused post. */
const refusal = (res: Response): AccountError => (res.status === 401 ? "credentials" : "invalid");

/**
 * The library's endpoints. A JSON call passes through unchanged. A page's form post is sent to the library as the
 * JSON body its endpoints take (the form's fields, nothing added) and answered with a 303 carrying the library's
 * `set-cookie`: to the sign-in page on success, back to the posting page with `?error=` on a refusal. The page's
 * locale comes in the post's `locale` search key; the typed values never go into a URL. A sign-in the library accepts
 * is remembered as a profile either way.
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
  const parsed = AccountsLocale.parse(url.searchParams.get("locale"));
  const locale = parsed.ok ? parsed.value : "en-US";
  const page = url.pathname === `${mount.path}/sign-up/email` ? "accounts.signup" : "accounts.signin";
  const to = res.ok
    ? accounts.href("accounts.signin", { locale })
    : accounts.href(page, { locale }, { error: refusal(res) });
  const answer = new Headers({ location: to });
  for (const cookie of res.headers.getSetCookie()) answer.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers: answer });
}

export default identity({ identify, handle: { path: mount.path, fn: handle } });
