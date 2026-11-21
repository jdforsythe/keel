import type { Ctx } from "@keel/ctx";
import type { RouteTable } from "@keel/router";
import type { HarnessArtifacts } from "./HarnessArtifacts.ts";
import type { RoutesImport } from "./RoutesImport.ts";

/**
 * Options of `resumeDocument`: the route table whose components resume the document's islands (by route id), or an
 * import of the module whose default export it is, which resumes in a module graph of its own; the ctx (default: a sim
 * ctx, as `render`) and the compiler's `a11y.json` for E1702.
 */
export interface ResumeDocumentOptions {
  readonly routes: RouteTable | RoutesImport;
  readonly ctx?: Ctx;
  readonly artifacts?: HarnessArtifacts;
}
