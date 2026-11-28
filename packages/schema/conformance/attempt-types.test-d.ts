// Negative type test (k.unsafe): type-checked, never run, imported by no file; its run-time half is attempt-rules.test.ts and err-keel-error.test.ts.
// Spec: k.attempt, clause "`attempt(() => 1)` does not compile, and called untyped with one argument it throws a value `isDefect(v, 'E1452')` accepts; the type of `attempt(() => (c ? 1 : err(T)), expect)` is `Result<number, typeof T | E>` for `expect` returning `E | undefined`."
// Spec: k.attempt, clause "In `modules/m/a.ts`, `err(new Error('x'))`, `err('x')` and `err({ code: 'a.b' })` are one E1458 each at the argument; `err(T)` is none; called untyped, `err('x')` throws a value `isDefect(v, 'E1458')` accepts."
// Seed 1337 (no property here).
// The folder's negative tests mark a refused call with a suppression comment; the brief forbids those, so each refusal is
// stated on the signature with `expectTypeOf`, which fails type-checking when the claim is false.
import { attempt, err, ok } from "@keel/schema";
import type { KeelError, Result } from "@keel/schema";
import { expectTypeOf } from "vitest";

type T = KeelError<"x.t", Record<string, never>>;
type E = KeelError<"x.e", { n: number }>;

export function conformanceAttemptTypes(c: boolean, T: T, expectE: (x: unknown) => E | undefined): void {
  // attempt(() => 1) does not compile: `expect` is a second required parameter
  expectTypeOf<Parameters<typeof attempt>["length"]>().toEqualTypeOf<2>();

  // the type of attempt(() => (c ? 1 : err(T)), expect) is Result<number, typeof T | E>
  const r = attempt(() => (c ? 1 : err(T)), expectE);
  expectTypeOf(r).toEqualTypeOf<Result<number, T | E>>();

  // a Result never nests: a returned Result is the call's own, a plain value is ok
  const flat = attempt(() => ok(1), expectE);
  expectTypeOf(flat).toEqualTypeOf<Result<number, E>>();
  expectTypeOf(flat).not.toEqualTypeOf<Result<Result<number, never>, E>>();

  // async fn gives a Promise of the same Result
  const p = attempt(async () => (c ? 1 : err(T)), expectE);
  expectTypeOf(p).toEqualTypeOf<Promise<Result<number, T | E>>>();

  // err refuses a non-KeelError at compile time: its parameter is a KeelError, an Error, a string and a bare object are not
  type ErrArg = Parameters<typeof err>[0];
  expectTypeOf<ErrArg>().toExtend<KeelError<string, unknown>>();
  expectTypeOf<Error>().not.toExtend<ErrArg>();
  expectTypeOf<string>().not.toExtend<ErrArg>();
  expectTypeOf<{ code: "a.b" }>().not.toExtend<ErrArg>();
  expectTypeOf<T>().toExtend<ErrArg>();

  // Result requires E extends KeelError
  expectTypeOf<Result<number, T>>().not.toBeNever();
}
