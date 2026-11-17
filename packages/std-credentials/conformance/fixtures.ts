// Shared fixtures for the std.credentials and std.tokens conformance files (not a test file).
// Assumption: `Result` values are read as `{ ok: true, value }` or `{ ok: false, error: { code, data, message } }`; the helpers below
// read them by property so a test needs no cast.
// Assumption: a std config reaches a ctx through `createApp({ ctx, std })` over a `std.json` that `stdArtifact` builds from manifests.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdArtifact } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import type { Ctx, SimCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, reveal, s } from "@keel/schema";
import type { Secret } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { Digested, Hashed } from "@keel/std-credentials";
import { credentials } from "@keel/std-credentials/server";

export const SEED = 1337;
export const PKG = "@keel/std-credentials";

const SecretText = s.secret(s.string());

/** A `Secret<string>` of `text`, parsed with `s.secret(s.string())`. */
export function secretOf(text: string): Secret<string> {
  const r = SecretText.parse(text);
  if (!r.ok) throw new Error("fixture: a string does not parse as a secret");
  return r.value;
}

/** `text` as a `Hashed`; throws when it is not of the shape. */
export function hashedOf(text: string): Hashed {
  const r = Hashed.parse(text);
  if (!r.ok) throw new Error(`fixture: not a Hashed: ${text}`);
  return r.value;
}

/** `text` as a `Digested`; throws when it is not of the shape. */
export function digestedOf(text: string): Digested {
  const r = Digested.parse(text);
  if (!r.ok) throw new Error(`fixture: not a Digested: ${text}`);
  return r.value;
}

export const realCtx = (): Ctx => createCtx({ mode: "real" });
export const shellCtx = (): Ctx => createCtx({ mode: "shell" });
export const simCtx = (seed: number = SEED): SimCtx => createCtx({ mode: "sim", seed });

const isObject = (v: unknown): v is object => typeof v === "object" && v !== null;

/** True when `r` is an `ok` result. */
export function isOk(r: unknown): boolean {
  return isObject(r) && Reflect.get(r, "ok") === true;
}

/** The value of an `ok` result; throws on an `err`. */
export function okValue(r: unknown): unknown {
  if (!isObject(r) || Reflect.get(r, "ok") !== true) throw new Error("fixture: expected an ok result");
  return Reflect.get(r, "value");
}

export interface ErrorView {
  readonly code: unknown;
  readonly data: unknown;
  readonly message: unknown;
  readonly error: unknown;
}

/** The error of an `err` result; throws on an `ok`. */
export function errorOf(r: unknown): ErrorView {
  if (!isObject(r) || Reflect.get(r, "ok") !== false) throw new Error("fixture: expected an err result");
  const error: unknown = Reflect.get(r, "error");
  const e = Object(error);
  return { code: Reflect.get(e, "code"), data: Reflect.get(e, "data"), message: Reflect.get(e, "message"), error };
}

/** The `rehash` flag of an `ok` verify result. */
export function rehashOf(r: unknown): unknown {
  return Reflect.get(Object(okValue(r)), "rehash");
}

/** `verify` with a `stored` the types would refuse (a string that is not a `Hashed`). */
export async function rawVerify(ctx: Ctx, secret: Secret<string>, stored: unknown): Promise<unknown> {
  const c = credentials(ctx);
  const r: unknown = await Reflect.apply(c.verify, c, [secret, stored]);
  return r;
}

/** `check` with a row whose `digest` the types would refuse. */
export function rawCheck(ctx: Ctx, token: Secret<string>, find: (id: string) => unknown): unknown {
  const c = credentials(ctx);
  const r: unknown = Reflect.apply(c.check, c, [token, find]);
  return r;
}

/** The text of a minted token (`reveal`, as the one `*.server.ts` file that sends it does). */
export const textOf = (token: Secret<string>): string => reveal(token);

/** A ctx bound to the std config `{ [moduleId]: config }` of modules, through `createApp({ ctx, std })` over a `std.json`. */
export async function ctxWithCost<C extends Ctx>(ctx: C, modules: Readonly<Record<string, unknown>>): Promise<C> {
  const ids = Object.keys(modules);
  const files = ids.map((id) => ({
    path: `modules/${id}/module.ts`,
    source: `import { module } from "@keel/compiler"\nexport default module(${JSON.stringify({
      id,
      deps: [PKG],
      capabilities: [],
      public: { exports: [], routes: [] },
      std: { [PKG]: modules[id] },
    })})\n`,
  }));
  const { data, hash } = stdArtifact(files);
  const dir = mkdtempSync(join(tmpdir(), "keel-credentials-"));
  try {
    const std = join(dir, "std.json");
    writeFileSync(std, JSON.stringify({ data, hash }));
    const entries: Record<string, { api: true; path: string }> = {};
    for (const id of ids) entries[`${id}.noop`] = { api: true, path: `/api/${id}` };
    const routes = manifest(entries);
    const noop = action({ input: s.object({}), output: s.object({}) }, async () => ok({}));
    const handlers: Record<string, { POST: typeof noop }> = {};
    for (const id of ids) handlers[`${id}.noop`] = { POST: noop };
    routes.actions(handlers);
    await createApp({
      topology: topology({ web: { modules: ids, adapter: "node" } }),
      routes,
      ctx,
      mode: "dev",
      std,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return ctx;
}

/** A ctx bound to one module `accounts` whose std config sets `ln`. */
export const ctxWithLn = <C extends Ctx>(ctx: C, ln: number): Promise<C> => ctxWithCost(ctx, { accounts: { ln } });

/** Base64 without padding. */
export const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64").replace(/=+$/, "");
