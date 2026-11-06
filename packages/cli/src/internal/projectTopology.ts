import { parseTopology } from "@keel/compiler";
import type { Topology } from "@keel/compiler";
import type { SourceFile } from "../types/SourceFile.ts";

/** The parsed root `topology.ts` of `project`, or undefined when the project has none. */
export function projectTopology(project: readonly SourceFile[]): Topology | undefined {
  const manifest = project.find((f) => f.path === "topology.ts");
  return manifest === undefined ? undefined : parseTopology(manifest.source).topology;
}
