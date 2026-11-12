import type { Artifacts } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";

/**
 * Options of `resumeDocument`: the route table whose components resume the document's islands (by route id), the
 * ctx (default: a sim ctx, as `render`) and the compiler's `a11y.json` for E1702.
 */
export interface ResumeDocumentOptions<M extends Readonly<Record<string, RouteDef>>> {
  readonly routes: Manifest<M>;
  readonly ctx?: Ctx;
  readonly artifacts?: Pick<Artifacts, "a11y.json">;
}
