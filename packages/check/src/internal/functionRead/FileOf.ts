import type { SourceFile } from "../../types/SourceFile.ts";

/** The file `spec` names from `from` among the files being read, or undefined. */
export type FileOf = (from: SourceFile, spec: string) => SourceFile | undefined;
