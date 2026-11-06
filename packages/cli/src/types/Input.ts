import type { Mode } from "./Mode.ts";

/**
 * The union of every operation's input fields. Each operation's `input` schema declares the subset it accepts;
 * anything outside it is E1052.
 */
export type Input = {
  readonly format?: Mode;
  readonly quiet?: boolean;
  readonly limit?: number;
  readonly verbose?: boolean;
  readonly code?: string;
  readonly paths?: string[];
  readonly id?: string;
  readonly for?: string;
  readonly map?: boolean;
  readonly url?: string;
  readonly target?: string;
  readonly props?: string;
  readonly op?: string;
  readonly args?: string[];
  readonly "dry-run"?: boolean;
  readonly kind?: "component" | "store" | "route" | "schema";
  readonly adapter?: "client" | "node" | "static";
  readonly workspace?: boolean;
  readonly file?: string;
  readonly path?: string;
  readonly openapi?: string;
  readonly to?: string;
  readonly default?: string;
  readonly diff?: boolean;
};
