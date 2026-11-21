import { agentFiles } from "@keel/scaffold/agents";
import type { SourceFile } from "../types/SourceFile.ts";
import { readDocs } from "./readDocs.ts";

/** The agent files `keel scaffold project` adds to a new project (k.scaffold Agent files): path -> text. */
export function agentWrites(files: readonly SourceFile[]): Map<string, string> {
  const r = agentFiles(new Map(), readDocs(files).skills);
  return new Map(r.ok ? r.value.flatMap((f): [string, string][] => (f.want === null ? [] : [[f.path, f.want]])) : []);
}
