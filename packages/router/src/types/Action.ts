import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema, Result } from "@keel/schema";
import type { Contract } from "../contract/types/Contract.ts";
import type { ActionInput } from "./ActionInput.ts";
import type { Href } from "./Href.ts";

type Out = Result<Href | null, KeelError<string, unknown>>;

/**
 * A page's action declared with `action(contract, id, { input, stores? }, fn)` for page `Id` (k.contract Handlers),
 * bound in its entry by verb. `ok(href)` navigates, `ok(null)` revalidates; it declares no `output` (k.api Output).
 */
export type Action<Id extends string = string> = {
  readonly kind: "keel.action";
  readonly contract: Contract;
  readonly id: Id;
  readonly input: ObjectSchema<unknown>;
  readonly output?: undefined;
  readonly stores?: (ctx: Ctx) => unknown;
  run(input: unknown, at: ActionInput, ctx: Ctx): Out | Promise<Out>;
};
