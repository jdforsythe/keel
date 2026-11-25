import type { SourceFile } from "../../types/SourceFile.ts";
import type { ReadFn } from "./ReadFn.ts";

/** The key of `fn` in `file` in a reader's set of open reads. */
export const fnKey = (file: SourceFile, fn: ReadFn): string => `${file.path}:${fn.start}`;
