import { dirname, join } from "node:path";
import { type Result, err, ok } from "@keel/schema";

type Env = Readonly<Record<string, string | undefined>>;

type Settings = {
  /** Signs the library's session cookie: `BETTER_AUTH_SECRET`, or a fixed value when `AUTH_FIXTURE` asks for one. */
  readonly secret: string;
  /** The `node:sqlite` file holding users and sessions; `:memory:` under test. */
  readonly database: string;
  /** The public origin (`KEEL_ORIGIN`), when the deploy names it; else the library reads it from each request. */
  readonly origin: string | undefined;
  /** No library log lines: under test. */
  readonly quiet: boolean;
};

const TEST_SECRET = "golden-2-test-secret-never-used-in-production";
const DEV_SECRET = "golden-2-dev-secret-never-used-in-production";

/**
 * The sign-in library's settings from the server's environment. Only an explicit `AUTH_FIXTURE` entry gives a fixed
 * secret, never `NODE_ENV`: `test` (the vitest config sets it) a fixed secret and an in-memory database, `dev` (the
 * `dev` script sets it) a fixed secret and `.keel-dev/auth.sqlite`. Otherwise `BETTER_AUTH_SECRET` of 32 or more
 * characters is required, else `err` naming the variable and never a value; the database is
 * `AUTH_DATABASE_PATH`, else `auth.sqlite` beside the web storage file (`--localstorage-file`), else in the working
 * directory.
 */
export function authSettings(
  env: Env,
  execArgv: readonly string[],
): Result<Settings, { code: string; message: string; data: null }> {
  const origin = env.KEEL_ORIGIN;
  if (env.AUTH_FIXTURE === "test") return ok({ secret: TEST_SECRET, database: ":memory:", origin, quiet: true });
  if (env.AUTH_FIXTURE === "dev")
    return ok({ secret: DEV_SECRET, database: join(".keel-dev", "auth.sqlite"), origin, quiet: false });
  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32)
    return err({
      code: "accounts.secret",
      message: "BETTER_AUTH_SECRET is missing or under 32 characters; set it where the server runs",
      data: null,
    });
  const storage = execArgv.find((a) => a.startsWith("--localstorage-file="))?.slice("--localstorage-file=".length);
  const database =
    env.AUTH_DATABASE_PATH ?? (storage === undefined ? "auth.sqlite" : join(dirname(storage), "auth.sqlite"));
  return ok({ secret, database, origin, quiet: false });
}
