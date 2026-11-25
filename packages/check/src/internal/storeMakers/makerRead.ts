import type { Argument, CallExpression } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { storeClasses } from "../storeClasses.ts";
import type { SiteRead } from "./SiteRead.ts";

/** The classes every argument of a store maker's call holds, or the first part not read and every such part. */
export function makerRead(call: CallExpression, file: SourceFile, project: readonly SourceFile[]): SiteRead {
  const classes = new Set<string>();
  let first: string | undefined;
  const parts: { readonly part: Argument; readonly file: SourceFile }[] = [];
  for (const a of call.arguments) {
    const read = storeClasses(a, file, project);
    if ("parts" in read) {
      first ??= read.unread;
      parts.push(...read.parts);
    } else for (const c of read.classes) classes.add(c);
  }
  return first === undefined ? { classes } : { unread: first, parts };
}
