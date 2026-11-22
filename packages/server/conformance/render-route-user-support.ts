// Shared fixture for the RFC 0185 `renderRoute` suites (k.user 11 to 13, k.mount 9, k.return 6); not a test file. Seed 1337 for every property.
// One module `u` on one `node` deployable `web`. Pages are TSX through `compilePage`, so they resume cleanly; a control is driven by `fire(id, { type: 'click' })`.
//   `u.page` (`/p`): buttons `u.who` (`api.who({})`), `u.whoAs` (`api.who({ user: 'u2' })`), `u.bump` (a write), `u.watch` (an event stream), a `Form`
//   (`u.note`, `u.save`) POSTing the page's action, and a sign-out `Form` (`u.signout`) to the identity mount. Texts `u.out` (the user `api.who` answered) and `u.live` (`user:n`).
//   `u.signin` (`/signin`): a `Form` (`u.signin.go`) to the identity mount's `/in`.
// `identify` always answers `''` and records `{ caller, cookie }`. The identity mount's `handle` answers `/in` 303 `/p` with `set-cookie: s=<control.value>; HttpOnly` and `/out`
// 303 `/p` with `s=; Max-Age=0`. Server-side surfaces record `[user, caller]`. ASSUMPTIONS (the spec names no shape): `h.settle()` and `h.route()` as in the RFC's examples;
// a contract call from a page reaches the page's origin through `ctx.net`.
import { type Ctx, createCtx } from "@keel/ctx";
import * as forms from "@keel/forms";
import * as reactive from "@keel/reactive";
import { Form, action, guard, identityMount, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import * as schema from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { service } from "@keel/services";
import { MODULES, compilePage } from "./claim-support.ts";

export { Form };
export const SEED = 1337;
export const mount = identityMount("/api/auth");

export const simCtx = (seed = SEED): Ctx => createCtx({ mode: "sim", seed });
export const codeOf = (e: unknown): unknown =>
  typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined;
export const rejection = (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (x: unknown) => x,
  );
/** The `name=value` pairs of a `cookie` header. */
export const pairs = (cookie: string | null | undefined): string[] =>
  cookie === null || cookie === undefined || cookie === "" ? [] : cookie.split(/;\s*/);

type Who = readonly [user: string, caller: string];
export const rec = {
  identified: [] as { caller: string; cookie: string | null }[],
  handled: [] as { path: string; cookie: string | null }[],
  guard: [] as Who[],
  loader: [] as Who[],
  who: [] as Who[],
  action: [] as Who[],
  bump: [] as Who[],
  live: [] as Who[],
};
/** `value` is what `/in` sets `s` to; `n` the write counter the event stream yields; `waiters` the open streams' wake-ups. */
export const control = { value: "1", n: 0, waiters: [] as (() => void)[] };
export const reset = (): void => {
  for (const list of Object.values(rec)) list.length = 0;
  control.value = "1";
  control.n = 0;
  control.waiters = [];
};

const Who = s.object({ user: s.string(), caller: s.string() });
const Live = s.object({ user: s.string(), n: s.int() });
const Empty = s.object({});
const Note = s.object({ note: s.string({ min: 1 }) });

const uc = contract("u", {
  "u.login": { path: "/login" },
  "u.signin": { path: "/signin" },
  "u.page": { path: "/p" },
  "u.who": { method: "GET", path: "/api/who", output: Who },
  "u.bump": { method: "POST", path: "/api/bump", body: Empty, output: Empty },
  "u.watch": { method: "GET", path: "/api/watch", events: true, output: Live },
});
const api = service({ contract: uc });

const PAGE = `import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { Form } from "@keel/router";
import { form } from "@keel/forms";
import { s } from "@keel/schema";
import { Box, Button, Input, Text } from "@keel/ui";
import mount from "identity";
import { api } from "api";
const Note = s.object({ note: s.string({ min: 1 }) });
const Empty = s.object({});
export default function Page(_props: unknown, ctx: Ctx) {
  const who = signal("");
  const live = signal("");
  const f = form(Note);
  const out = form(Empty);
  const ask = async () => { const r = await api.who({}, ctx); who.set(r.ok ? r.value.user : "error"); };
  const askAs = async () => { const r = await api.who({ user: "u2" }, ctx); who.set(r.ok ? r.value.user : "error"); };
  const bump = async () => { await api.bump({ body: {} }, ctx); };
  const watch = async () => { for await (const r of api.watch({}, ctx)) { if (r.ok) live.set(r.value.user + ":" + r.value.n); } };
  return <Box id="u.root">
    <Text id="u.out">{who.get()}</Text>
    <Text id="u.live">{live.get()}</Text>
    <Button id="u.who" onClick={ask}>who</Button>
    <Button id="u.whoAs" onClick={askAs}>who as u2</Button>
    <Button id="u.bump" onClick={bump}>bump</Button>
    <Button id="u.watch" onClick={watch}>watch</Button>
    <Form method="POST" action="/p" form={f}>
      <Input id="u.note" field={f.field("note")} label="Note" />
      <Button id="u.save" type="submit">save</Button>
    </Form>
    <Form method="POST" action={mount.href("/out")} form={out}>
      <Button id="u.signout" type="submit">sign out</Button>
    </Form>
  </Box>
}
`;
const SIGN_IN = `import { Form } from "@keel/router";
import { form } from "@keel/forms";
import { s } from "@keel/schema";
import { Box, Button } from "@keel/ui";
import mount from "identity";
const Empty = s.object({});
export default function SignIn() {
  const f = form(Empty);
  return <Box id="u.signin.root">
    <Form method="POST" action={mount.href("/in")} form={f}>
      <Button id="u.signin.go" type="submit">sign in</Button>
    </Form>
  </Box>
}
`;
const modules = {
  ...MODULES,
  "@keel/forms": forms,
  "@keel/schema": schema,
  "@keel/reactive": reactive,
  identity: { __esModule: true, default: mount },
  api: { api },
};
const page = compilePage("u.page", PAGE, modules);
const signin = compilePage("u.signin", SIGN_IN, modules);
const view = (): Node => document.createElement("p");

export const routes = manifest(uc, {
  "u.login": { component: view },
  "u.signin": { component: signin },
  "u.page": {
    component: page,
    loader: loader(uc, "u.page", { output: Empty }, async ({ user, caller }) => {
      rec.loader.push([user, caller]);
      return ok({});
    }),
    POST: action(uc, "u.page", { input: Note }, async (_input, { user, caller }) => {
      rec.action.push([user, caller]);
      return ok(uc.href("u.page"));
    }),
  },
  "u.who": {
    guard: guard({ redirect: "u.login" }, async ({ user, caller }) => {
      rec.guard.push([user, caller]);
      return ok(null);
    }),
    loader: loader(uc, "u.who", {}, async ({ user, caller }) => {
      rec.who.push([user, caller]);
      return ok({ user, caller });
    }),
  },
  "u.bump": {
    action: action(uc, "u.bump", {}, async (_input, { user, caller }) => {
      rec.bump.push([user, caller]);
      control.n++;
      for (const wake of control.waiters.splice(0)) wake();
      return ok({});
    }),
  },
  "u.watch": {
    loader: loader(uc, "u.watch", {}, async function* (args: { user: string; caller: string; signal: AbortSignal }) {
      rec.live.push([args.user, args.caller]);
      let sent = -1;
      while (!args.signal.aborted) {
        if (sent !== control.n) {
          sent = control.n;
          yield ok({ user: args.user, n: sent });
        }
        await new Promise<void>((resolve) => {
          control.waiters.push(resolve);
          args.signal.addEventListener("abort", () => resolve(), { once: true });
        });
      }
    }),
  },
});

/** A `node` deployable serving `u` on a sim ctx of its own, with an identity source whose `identify` answers `''` and a mount at `/api/auth`. */
export async function boot(ctx: Ctx = simCtx()) {
  const app = await createApp({
    topology: topology({ web: { modules: ["u"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
    identity: identity({
      identify: async ({ request, caller }) => {
        rec.identified.push({ caller, cookie: request.headers.get("cookie") });
        return "";
      },
      handle: {
        path: mount.path,
        fn: (request) => {
          const path = new URL(request.url).pathname;
          rec.handled.push({ path, cookie: request.headers.get("cookie") });
          const set = path.endsWith("/out") ? "s=; Max-Age=0" : `s=${control.value}; HttpOnly`;
          return new Response(null, { status: 303, headers: { location: "/p", "set-cookie": set } });
        },
      },
    }),
  });
  return { app, ctx };
}
