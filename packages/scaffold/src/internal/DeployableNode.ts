import type { ArrayExpression, ObjectPropertyKind } from "oxc-parser";

/** One deployable of `topology.ts` with the nodes an edit needs: its property and its `modules` array literal. */
export type DeployableNode = {
  readonly name: string;
  readonly adapter: "node" | "static" | "client";
  readonly modules: readonly string[];
  readonly prop: ObjectPropertyKind;
  readonly list: ArrayExpression;
};
