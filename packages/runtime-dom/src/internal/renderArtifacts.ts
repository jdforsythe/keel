import type { RenderArtifacts } from "../types/RenderArtifacts.ts";
import { cx } from "./cx.ts";

/** The artifacts the mount rendering now was given (`MountOptions.artifacts`), or undefined (none given, a resume, outside a render). */
export function renderArtifacts(): RenderArtifacts | undefined {
  return cx.owner?.root.artifacts;
}
