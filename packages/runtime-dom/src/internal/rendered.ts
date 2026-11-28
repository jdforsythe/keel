import type { Ctx } from "@keel/ctx";
import type { RenderArtifacts } from "../types/RenderArtifacts.ts";

/**
 * The document and the artifacts of the latest render given each ctx (a `mount` given `artifacts`, a harness render,
 * a served document), read by capabilities that act on the page a ctx renders (k.schemes Choice: `appearance(ctx)`).
 */
export const rendered: WeakMap<Ctx, { readonly document: Document; readonly artifacts: RenderArtifacts }> =
  new WeakMap();
