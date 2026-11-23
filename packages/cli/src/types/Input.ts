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
  readonly sync?: boolean;
  readonly url?: string;
  readonly target?: string;
  readonly platform?: string;
  readonly release?: boolean;
  readonly props?: string;
  readonly op?: string;
  readonly args?: string[];
  readonly "dry-run"?: boolean;
  readonly kind?: "component" | "store" | "route" | "schema";
  readonly adapter?: "client" | "node" | "static";
  readonly workspace?: boolean;
  readonly file?: string;
  readonly api?: boolean;
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path?: string;
  readonly openapi?: string;
  readonly to?: string;
  readonly default?: string;
  readonly diff?: boolean;
  readonly write?: string;
  readonly scope?: string;
  readonly failing?: boolean;
  readonly since?: string;
  readonly "max-runs"?: number;
  readonly base?: string;
  readonly port?: number;
  readonly out?: string;
  readonly audit?: string;
  readonly verify?: string;
  readonly key?: string;
  readonly all?: boolean;
  readonly list?: boolean;
  readonly "fail-on"?: "warn";
  readonly accept?: string;
  readonly reason?: string;
};
