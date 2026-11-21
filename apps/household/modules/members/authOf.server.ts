import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Ctx, KeyValueStorage } from "@keel/ctx";
import { type Result, attempt, err } from "@keel/schema";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import mount from "../../identity.ts";
import { authSettings } from "./authSettings.server.ts";

type Settings = {
  readonly secret: string;
  readonly database: string;
  readonly origin: string | undefined;
  readonly quiet: boolean;
};

/** The library over its own `node:sqlite` database, mounted at the identity mount's path. */
const build = (o: Settings) =>
  betterAuth({
    database: new DatabaseSync(o.database),
    secret: o.secret,
    basePath: mount.path,
    ...(o.origin === undefined ? {} : { baseURL: o.origin }),
    emailAndPassword: { enabled: true, autoSignIn: false },
    logger: { disabled: o.quiet, level: "error" },
    telemetry: { enabled: false },
  });

type Auth = ReturnType<typeof build>;
type Opened = Result<Auth, { readonly code: string; readonly message: string; readonly data: unknown }>;

/** One library instance per storage the app runs on: a sim ctx's tests get a database of their own. */
const opened = new WeakMap<KeyValueStorage, Promise<Opened>>();

async function open(): Promise<Opened> {
  const settings = authSettings(process.env, process.execArgv);
  if (!settings.ok) return err(settings.error);
  const o = settings.value;
  return attempt(async () => {
    if (o.database !== ":memory:") mkdirSync(dirname(o.database), { recursive: true });
    const auth = build(o);
    await (await getMigrations(auth.options)).runMigrations();
    return auth;
  });
}

/**
 * The sign-in library (Better Auth) for `ctx`'s storage, opened once: its database file is made when missing and its
 * tables by the library's own migration, at the first request. Accounts, passwords and sessions live there, never in
 * `ctx.storage` or the app's Postgres; Keel only mounts the library (`identity.server.ts`).
 */
export function authOf(ctx: Ctx): Promise<Opened> {
  const known = opened.get(ctx.storage);
  if (known !== undefined) return known;
  const made = open();
  opened.set(ctx.storage, made);
  return made;
}
