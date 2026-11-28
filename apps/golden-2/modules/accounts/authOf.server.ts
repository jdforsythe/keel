import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Ctx, KeyValueStorage } from "@keel/ctx";
import { type Result, attempt, err, type s } from "@keel/schema";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import mount from "../../identity.ts";
import { AuthUnavailable } from "./AuthUnavailable.schema.ts";
import type { MissingSecret } from "./MissingSecret.schema.ts";
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
type Opened = Result<Auth, s.infer<typeof MissingSecret> | s.infer<typeof AuthUnavailable>>;

/** One library instance per storage the app runs on: a sim ctx's tests get a database of their own. */
const opened = new WeakMap<KeyValueStorage, Promise<Opened>>();

/** The system codes of a database file that cannot be made or opened. */
const FILE_ERRORS: ReadonlySet<string> = new Set(["ENOENT", "EACCES", "EPERM", "EROFS", "ENOTDIR", "EEXIST", "EISDIR"]);

/** True for a thrown value that is a SQLite library error or one of the file system codes above. */
const refused = (x: unknown): boolean => {
  const code = x instanceof Error ? Reflect.get(x, "code") : undefined;
  return typeof code === "string" && (code.startsWith("ERR_SQLITE") || FILE_ERRORS.has(code));
};

/** Which kind of refusal a thrown value is: the library's, or the file's. */
const reasonOf = (x: unknown): "sqlite" | "file" =>
  x instanceof Error && String(Reflect.get(x, "code")).startsWith("ERR_SQLITE") ? "sqlite" : "file";

async function open(): Promise<Opened> {
  const settings = authSettings(process.env, process.execArgv);
  if (!settings.ok) return err(settings.error);
  const o = settings.value;
  return attempt(
    async () => {
      if (o.database !== ":memory:") mkdirSync(dirname(o.database), { recursive: true });
      const auth = build(o);
      await (await getMigrations(auth.options)).runMigrations();
      return auth;
    },
    (x) => (refused(x) ? AuthUnavailable.make({ reason: reasonOf(x) }) : undefined),
  );
}

/**
 * The sign-in library (Better Auth) for `ctx`'s storage, opened once: its database file is created when missing and
 * its tables by the library's own migration, at the first request. Users, passwords and sessions live there, not in
 * `ctx.storage`; its ids, tokens and timestamps come from its own clock and randomness, outside the sim ctx.
 */
export function authOf(ctx: Ctx): Promise<Opened> {
  const known = opened.get(ctx.storage);
  if (known !== undefined) return known;
  const made = open();
  opened.set(ctx.storage, made);
  return made;
}
