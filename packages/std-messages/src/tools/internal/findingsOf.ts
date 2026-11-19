import type { Finding, SourceFile } from "@keel/check";
import type { Hit } from "./Hit.ts";
import { lineCol } from "./lineCol.ts";

/** Hits as findings on `file`; the message and any edit travel in `data`. */
export function findingsOf(file: SourceFile, hits: readonly Hit[]): Finding[] {
  return hits.map((h) => ({
    path: file.path,
    ...lineCol(file.source, h.at),
    data:
      h.edit === undefined ? { msg: h.msg } : { msg: h.msg, start: h.edit.start, end: h.edit.end, text: h.edit.text },
  }));
}
