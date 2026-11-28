import type { Schema } from "@keel/schema";
import type { Chart } from "@keel/std-statecharts";
import type { StepSpec } from "./StepSpec.ts";
import type { WaitSpec } from "./WaitSpec.ts";

/**
 * The declaration `workflow` takes (std.workflows): the chart, steps and waits by state name, how long a final instance
 * is kept (`keepMs`), how many instances may be not final (`limit`), and the default `attempts` and `timeoutMs` of a step.
 */
export type WorkflowSpec<
  D,
  Ev extends Readonly<Record<string, Schema<unknown>>>,
  S extends string,
  G extends string,
  A extends string,
> = {
  readonly chart: Chart<D, Ev, S, G, A>;
  readonly steps?: { readonly [K in S]?: StepSpec<D, Ev> };
  readonly waits?: { readonly [K in S]?: WaitSpec<keyof Ev & string> };
  readonly keepMs?: number;
  readonly limit?: number;
  readonly attempts?: number;
  readonly timeoutMs?: number;
};
