import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result, Schema } from "@keel/schema";
import type { Contract } from "../contract/types/Contract.ts";
import type { ActionInput } from "./ActionInput.ts";

type Out<O> = Result<O, KeelError<string, unknown>>;

/**
 * An API write entry's action declared with `action(contract, id, { stores? }, fn)` for entry `Id` (k.contract
 * Handlers): `input` is the entry's `body` (the closed empty object without one) and `output` its `output`, which the
 * server parses before saving the stores (k.api Output).
 */
export type ApiAction<Id extends string = string, O = unknown> = {
  readonly kind: "keel.action";
  readonly contract: Contract;
  readonly id: Id;
  readonly input: ObjectSchema<unknown>;
  readonly output: Schema<O, boolean>;
  readonly stores?: (ctx: Ctx) => unknown;
  run(input: unknown, at: ActionInput, ctx: Ctx): Out<O> | Promise<Out<O>>;
};
