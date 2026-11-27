// Shared fixture for the E1050 and observed-read conformance files (not a test file). Public surface only: the `keel` binary over the household copy of derived-support.ts.
// Seed 1337 for every property in this suite.
// A server-only file `modules/setup/gate.guard.ts` (k.boundary) of a module only a `node` deployable lists is the one the evaluation loads; `setup.form`'s guard is `gate`, whose redirect `routes.json` holds (k.router Artifacts).
import { mkdirSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OLD, type Out, type Tree, put, sub } from "./derived-support.ts";

/**
 * Writes `source` as the head of `modules/setup/gate.guard.ts` (line 1 is its first line) and a guard whose redirect is the expression `redirect`
 * (a string: `"app.start"` unless it reads something), and binds that guard to `setup.form`.
 */
export function guardFile(t: Tree, source: string, redirect = '"app.start"'): void {
  put(
    t.dir,
    "modules/setup/gate.guard.ts",
    `${source}
import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";

export const gate = guard({ redirect: ${redirect} }, async ({ user }) =>
  user === "" ? err({ code: "keel.denied", message: "sign in first", data: null }) : ok(null),
);
`,
  );
  sub(t.dir, "modules/setup/routes.ts", 'import { signedIn } from "../members/signedIn.guard.ts";\n', "");
  sub(
    t.dir,
    "modules/setup/routes.ts",
    "import { getHousehold }",
    'import { gate } from "./gate.guard.ts";\nimport { getHousehold }',
  );
  sub(t.dir, "modules/setup/routes.ts", "guard: signedIn,", "guard: gate,");
}

/** Writes `rel` (in the project) with `value` and the old modification time, so only the bytes tell. */
export function putOld(t: Tree, rel: string, value: string): string {
  put(t.dir, rel, value);
  const at = join(t.dir, rel);
  utimesSync(at, OLD, OLD);
  return at;
}

/** The redirect `setup.form`'s guard gives while `value` is `1`: `members.signin`, else `app.start`. */
export const REDIRECT = 'MIN_TEXT.trim() === "1" ? "members.signin" : "app.start"';

/** A package `pg-like` in the copy's `node_modules`: CommonJS code that requires `net` and `events` at its top level and calls none of their functions. */
export function pgLike(t: Tree): void {
  const dir = join(t.dir, "node_modules", "pg-like");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    '{"name":"pg-like","version":"1.0.0","main":"index.cjs","types":"index.d.ts"}\n',
  );
  writeFileSync(join(dir, "index.d.ts"), "export declare class Client { connect(): unknown; }\n");
  writeFileSync(
    join(dir, "index.cjs"),
    "const net = require('net');\nconst { EventEmitter } = require('events');\nclass Client extends EventEmitter { connect() { return net.connect(5432); } }\nmodule.exports = { Client };\n",
  );
}

export type E1050 = { path: string; line: number | undefined; message: string };

/** Each E1050 record of a json run. */
export function e1050(out: Out): E1050[] {
  const found: E1050[] = [];
  for (const row of out.stdout.split("\n")) {
    if (!row.startsWith("{")) continue;
    const v: unknown = JSON.parse(row);
    if (typeof v !== "object" || v === null || Reflect.get(v, "code") !== "E1050") continue;
    const line: unknown = Reflect.get(v, "line");
    found.push({
      path: String(Reflect.get(v, "path")),
      line: typeof line === "number" ? line : undefined,
      message: String(Reflect.get(v, "message")),
    });
  }
  return found;
}

/** The `.json` entries of the derivation cache folder of the project at `dir` (none when the folder is absent). */
export function cacheEntries(dir: string): string[] {
  try {
    return readdirSync(join(dir, "node_modules", ".cache", "keel", "derived")).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
}

/** Removes the derivation cache folder of the project at `dir`, so a later look at it holds only what the next run wrote. */
export function dropCache(dir: string): void {
  rmSync(join(dir, "node_modules", ".cache", "keel", "derived"), { recursive: true, force: true });
}
