// Shared fixtures for the std.tokens conformance files (not a test file).
// Assumption: `Result` values are read as `{ ok: true, value }` or `{ ok: false, error: { code, data, message } }`; the helpers below
// read them by property so a test needs no cast.
import { createCtx } from "@keel/ctx";
import type { Ctx, SimCtx } from "@keel/ctx";
import { reveal, s } from "@keel/schema";
import type { Secret } from "@keel/schema";
import { Digested } from "@keel/std-tokens";
import { tokens } from "@keel/std-tokens/server";

export const SEED = 1337;

const SecretText = s.secret(s.string());

/** A `Secret<string>` of `text`, parsed with `s.secret(s.string())`. */
export function secretOf(text: string): Secret<string> {
  const r = SecretText.parse(text);
  if (!r.ok) throw new Error("fixture: a string does not parse as a secret");
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

/** `check` with a row whose `digest` the types would refuse. */
export function rawCheck(ctx: Ctx, token: Secret<string>, find: (id: string) => unknown): unknown {
  const c = tokens(ctx);
  const r: unknown = Reflect.apply(c.check, c, [token, find]);
  return r;
}

/** The text of a minted token (`reveal`, as the one `*.server.ts` file that sends it does). */
export const textOf = (token: Secret<string>): string => reveal(token);
