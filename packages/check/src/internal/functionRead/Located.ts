import type { SourceFile } from "../../types/SourceFile.ts";
import type { ReadFn } from "./ReadFn.ts";

/** A function and the file that holds it. */
export type Located = { readonly fn: ReadFn; readonly file: SourceFile };
