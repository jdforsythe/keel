// Fixtures for the k.user conformance files (not a test file). Seed for every property: 1337.
// The rig serves one module `app` from one `node` deployable and records, per surface, the `user` each one got.
// Requests are runtime (JSON) requests or event streams over http, so the caller cookie is `keel-caller`.
import { createCtx } from "@keel/ctx";
import type { Ctx, SimCtx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { deferred } from "./fixtures.ts";
import { liveLoader } from "./topology-fixtures.ts";

export const SEED = 1337;
export const BASE = "http://localhost";
export const SECRET = "conformance-secret-user-0123456789abcdef0123456789abcdef";

export interface IdentifyArgs {
  readonly request: Request;
  readonly caller: string;
}
export type Identify = (args: IdentifyArgs, ctx: Ctx) => Promise<string>;
export type Handler = (request: Request, ctx: Ctx) => Promise<Response> | Response;

/** A promise typed as an `identify` answer whatever JSON `value` is (the kernel must refuse what is not a string). */
export function answers(value: unknown): Promise<string> {
  return Promise.resolve(JSON.parse(JSON.stringify(value)));
}

export interface Seen {
  guard: string[];
  loader: string[];
  action: string[];
  api: string[];
  live: string[];
  /** In order: `identify`, `guard`, `loader`, `action`, `api`, `live`. */
  order: string[];
}

export interface RigOptions {
  /** No `identify`: the app has no identity source. */
  readonly identify?: Identify;
  readonly handle?: { readonly path: string; readonly fn: Handler };
  readonly days?: number;
  readonly secret?: string;
  readonly maxBodyBytes?: number;
  readonly log?: boolean;
}

const Who = s.object({ user: s.string(), caller: s.string() });
const Input = s.object({ user: s.string().optional() });
const SearchUser = s.object({ user: s.string().optional() });
const Denied = s.error("keel.denied", s.object({}));
const view = () => document.createElement("p");

export async function rig(o: RigOptions = {}) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: SEED });
  const seen: Seen = { guard: [], loader: [], action: [], api: [], live: [], order: [] };
  const identified: IdentifyArgs[] = [];
  const lines: string[] = [];
  const gate = guard({ redirect: "app.login" }, async ({ user }) => {
    seen.guard.push(user);
    seen.order.push("guard");
    return ok(null);
  });
  const appContract = contract("app", {
    "app.login": { path: "/login" },
    "app.who": { path: "/who", search: SearchUser },
    "app.api": { method: "GET", path: "/api/who", output: Who },
    "app.live": { method: "GET", path: "/api/live", events: true, output: Who },
  });
  const read = loader(appContract, "app.who", { output: Who }, async ({ user, caller }) => {
    seen.loader.push(user);
    seen.order.push("loader");
    return ok({ user, caller });
  });
  const write = action(appContract, "app.who", { input: Input }, async (_input, { user }) => {
    seen.action.push(user);
    seen.order.push("action");
    return ok(null);
  });
  const readApi = loader(appContract, "app.api", {}, async ({ user, caller }) => {
    seen.api.push(user);
    seen.order.push("api");
    return ok({ user, caller });
  });
  const release = deferred();
  const live = liveLoader(
    appContract,
    "app.live",
    async function* (args: { user: string; caller: string; signal: AbortSignal }) {
      seen.live.push(args.user);
      seen.order.push("live");
      yield ok({ user: args.user, caller: args.caller });
      await Promise.race([
        release.promise,
        new Promise<void>((resolve) => args.signal.addEventListener("abort", () => resolve())),
      ]);
      if (!args.signal.aborted) yield ok({ user: args.user, caller: args.caller });
    },
  );
  const routes = manifest(appContract, {
    "app.login": { component: view },
    "app.who": { component: view, loader: read, guard: gate, POST: write },
    "app.api": { loader: readApi },
    "app.live": { loader: live },
  });
  const identify = o.identify;
  const source =
    identify === undefined
      ? {}
      : {
          identity: identity({
            identify: async (a: IdentifyArgs, c: Ctx) => {
              identified.push(a);
              seen.order.push("identify");
              return identify(a, c);
            },
            ...(o.handle === undefined ? {} : { handle: o.handle }),
          }),
        };
  const app = await createApp({
    topology: topology({
      web: { modules: ["app"], adapter: "node", ...(o.days === undefined ? {} : { caller: { days: o.days } }) },
    }),
    routes,
    ctx,
    mode: "production",
    secret: o.secret ?? SECRET,
    ...(o.maxBodyBytes === undefined ? {} : { maxBodyBytes: o.maxBodyBytes }),
    ...(o.log === true ? { log: { format: "json" as const, write: (l: string) => void lines.push(l) } } : {}),
    ...source,
  });
  const get = (path: string, headers: Record<string, string> = {}): Promise<Response> =>
    app.fetch(new Request(`${BASE}${path}`, { headers: { accept: "application/json", ...headers } }));
  const post = (path: string, body: unknown = {}, headers: Record<string, string> = {}): Promise<Response> =>
    app.fetch(
      new Request(`${BASE}${path}`, {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
        headers: { accept: "application/json", "content-type": "application/json", origin: BASE, ...headers },
      }),
    );
  const stream = (path: string, signal?: AbortSignal): Promise<Response> =>
    app.fetch(
      new Request(`${BASE}${path}`, {
        headers: { accept: "text/event-stream" },
        ...(signal === undefined ? {} : { signal }),
      }),
    );
  return { app, ctx, seen, identified, lines, get, post, stream, release };
}

export const cookieOf = (res: Response, name: string): string | undefined =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));

/** Whether a `Promise` settled, after microtask turns and no timers. */
export async function settled(p: Promise<unknown>): Promise<boolean> {
  let done = false;
  void p.then(
    () => {
      done = true;
    },
    () => {
      done = true;
    },
  );
  for (let i = 0; i < 50; i++) await Promise.resolve();
  return done;
}
