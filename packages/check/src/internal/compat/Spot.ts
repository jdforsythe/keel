import type { SourceFile } from "../../types/SourceFile.ts";

/** A source span: where a diagnostic points and, for a field, where its schema expression ends. */
export type Spot = { readonly file: SourceFile; readonly start: number; readonly end: number };
