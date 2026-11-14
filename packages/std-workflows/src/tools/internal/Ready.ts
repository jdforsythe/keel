import type { literalShape } from "@keel/std-statecharts/tools/internal";
import type { Flow } from "./Flow.ts";

/** A flow whose chart was read: the flow, the chart's literal shape and the source of the flow's file. */
export type Ready = {
  readonly flow: Flow;
  readonly shape: NonNullable<ReturnType<typeof literalShape>["shape"]>;
  readonly source: string;
};
