import type { SourceFile } from "../../types/SourceFile.ts";
import type { ReadFn } from "../functionRead/ReadFn.ts";

/** The key of a function: its file and start. */
export const fnKeyOf = (file: SourceFile, fn: ReadFn): string => `${file.path}:${fn.start}`;
