import type { KeelError, Result } from "@keel/schema";
import type { FormHandle } from "../types/FormHandle.ts";
import type { Href } from "../types/Href.ts";
import type { Verb } from "../types/Verb.ts";

/**
 * What `Form` needs from the router rendering it: whether the route `action` matches in the router's
 * table declares `method`, and `submit`, which gives `null` when the handle's validation stopped it.
 */
export type RouterCore = {
  accepts(action: Href, method: Verb): boolean;
  submit(req: {
    readonly action: Href;
    readonly method: Verb;
    readonly form: HTMLFormElement;
    readonly handle: FormHandle | undefined;
  }): Promise<Result<Href | null, KeelError<string, unknown>> | null>;
};
