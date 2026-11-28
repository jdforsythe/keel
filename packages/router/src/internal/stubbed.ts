import { s } from "@keel/schema";
import type { Contract } from "../contract/types/Contract.ts";
import type { Action } from "../types/Action.ts";
import type { ApiGuard } from "../types/ApiGuard.ts";
import type { Loader } from "../types/Loader.ts";
import type { ServerStub } from "./ServerStub.ts";

const EMPTY = s.object({});

/**
 * What a binding holds in place of a stubbed loader, guard or action (k.boundary): a value of that kind whose `run`
 * calls the stub, so running it is the stub's E1008 and a browser never skips a guard it cannot run.
 */
export const stubbed = {
  loader: (contract: Contract, id: string, stub: ServerStub): Loader =>
    Object.freeze({ kind: "keel.loader", contract, id, output: EMPTY, run: async () => stub() }),
  guard: (stub: ServerStub): ApiGuard => Object.freeze({ kind: "keel.guard", run: async () => stub() }),
  action: (contract: Contract, id: string, stub: ServerStub): Action =>
    Object.freeze({ kind: "keel.action", contract, id, input: EMPTY, run: () => stub() }),
};
