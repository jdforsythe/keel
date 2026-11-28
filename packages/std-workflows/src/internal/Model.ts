import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";
import type { StepSpec } from "../StepSpec.ts";
import type { WaitSpec } from "../WaitSpec.ts";
import type { LooseStores } from "./LooseStores.ts";

/** A checked workflow declaration with its defaults applied, as its jobs and scan read it. */
export type Model<S extends string, D> = {
  readonly id: string;
  readonly steps: ReadonlyMap<string, StepSpec<D, Readonly<Record<string, Schema<unknown>>>>>;
  readonly waits: ReadonlyMap<string, WaitSpec<string>>;
  readonly finals: ReadonlySet<string>;
  readonly keepMs: number;
  readonly attempts: number;
  readonly timeoutMs: number;
  readonly open: (ctx: Ctx) => LooseStores<S, D>;
};
