import type { SourceFile } from "../types/SourceFile.ts";
import type { Parsed } from "./Parsed.ts";

/** A code file with its parse, as the project-level passes see it. */
export type Checked = { readonly file: SourceFile; readonly parsed: Parsed };
