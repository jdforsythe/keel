import type { RequestScope } from "./RequestScope.ts";
import type { Served } from "./Served.ts";

/**
 * One request as the flow sees it: `here` is the canonical path plus query (guard `next`), `runtime` is
 * true for `accept: application/json` (the client runtime gets `Result` JSON instead of HTML).
 */
export type Req = {
  readonly sv: Served;
  readonly rq: RequestScope;
  readonly raw: Request;
  readonly method: string;
  readonly here: string;
  readonly runtime: boolean;
};
