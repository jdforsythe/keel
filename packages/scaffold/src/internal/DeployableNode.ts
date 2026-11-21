import type { ArrayExpression, ObjectPropertyKind } from "oxc-parser";
import type { DeployTopology } from "../types/DeployTopology.ts";

/**
 * One deployable of `topology.ts` with the nodes an edit needs: its property and its `modules` array literal; `servedBy`,
 * a literal `servedBy` (k.hosting), else undefined; `storage` (k.deploy) and `shells` (k.shell) when written as literals.
 */
export type DeployableNode = {
  readonly name: string;
  readonly adapter: "node" | "static" | "client";
  readonly modules: readonly string[];
  readonly servedBy: string | undefined;
  readonly storage: DeployTopology[string]["storage"];
  readonly shells: DeployTopology[string]["shells"];
  readonly prop: ObjectPropertyKind;
  readonly list: ArrayExpression;
};
