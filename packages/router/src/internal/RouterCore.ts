import type { Ctx } from "@keel/ctx";
import type { KeelError, Result } from "@keel/schema";
import type { FormHandle } from "../types/FormHandle.ts";
import type { Href } from "../types/Href.ts";
import type { Verb } from "../types/Verb.ts";

/**
 * What kernel and stdlib components need from the router rendering them (`findRouter`): its `ctx`, `navigate` as
 * the router's own, whether the route `action` matches in the router's table declares `method` (`null` when no route
 * of the table matches it), and `submit`, which gives `null` when the handle's validation stopped it.
 */
export type RouterCore = {
  readonly ctx: Ctx;
  navigate(href: Href, opts?: { readonly replace?: boolean }): Promise<void>;
  accepts(action: Href, method: Verb): boolean | null;
  submit(req: {
    readonly action: Href;
    readonly method: Verb;
    readonly form: HTMLFormElement;
    readonly handle: FormHandle | undefined;
  }): Promise<Result<Href | null, KeelError<string, unknown>> | null>;
};
