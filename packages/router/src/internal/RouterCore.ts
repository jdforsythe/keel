import type { KeelError, Result } from "@keel/schema";
import type { FormHandle } from "../types/FormHandle.ts";
import type { Href } from "../types/Href.ts";
import type { Verb } from "../types/Verb.ts";
import type { Rec } from "./Rec.ts";
import type { Table } from "./Table.ts";

/** What `Form` needs from the router rendering it. `submit` gives `null` when the handle's validation stopped it. */
export type RouterCore = {
  readonly table: Table;
  submit(req: {
    readonly action: string;
    readonly method: Verb;
    readonly params: Rec;
    readonly form: HTMLFormElement;
    readonly handle: FormHandle | undefined;
  }): Promise<Result<Href | null, KeelError<string, unknown>> | null>;
};
