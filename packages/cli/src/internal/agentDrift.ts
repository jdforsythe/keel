import type { SourceFile } from "../types/SourceFile.ts";
import type { Diag } from "./Diag.ts";

/**
 * W1356 for the agent files (k.scaffold Agent files), loading `@keel/cli/docs` only when `AGENTS.md` holds a Keel
 * marker line, so a project without the block pays nothing.
 */
export async function agentDrift(files: readonly SourceFile[]): Promise<Diag[]> {
  const agents = files.find((f) => f.path === "AGENTS.md")?.source;
  if (agents === undefined || !agents.includes("<!-- keel:")) return [];
  const { agentWarnings } = await import("@keel/cli/docs");
  return agentWarnings(files);
}
