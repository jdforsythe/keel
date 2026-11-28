import type { Ctx } from "@keel/ctx";
import type { RenderArtifacts } from "@keel/runtime-dom";
import { rendered } from "@keel/runtime-dom/internal";

/**
 * Keep `doc` as the document `appearance(ctx)` acts on, with `artifacts`, those the mount rendering the control was
 * given (`MountOptions.artifacts`); given none, a record a render made before (a harness render, a served document, a
 * built entry with `choice` themes) stays. Called by `SchemeSelect` and `ThemeSelect`, so an app that renders neither
 * carries no record of it.
 */
export function keepDocument(ctx: Ctx | undefined, artifacts: RenderArtifacts | undefined, doc: Document): void {
  if (ctx === undefined) return;
  if (artifacts !== undefined) rendered.set(ctx, { document: doc, artifacts });
  else if (!rendered.has(ctx)) rendered.set(ctx, { document: doc, artifacts: {} });
}
