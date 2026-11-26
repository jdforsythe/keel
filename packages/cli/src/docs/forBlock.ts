import type { OutRecord } from "../types/OutRecord.ts";
import type { DocsSource } from "./DocsSource.ts";

/**
 * `--for <block>` (k.docs Forms): a `docs.code` per code of the block (`E155x`, `E15xx`) a section cites, in code
 * order, each with the sections citing it in the order given (map order).
 */
export function forBlock(block: string, sources: readonly DocsSource[]): OutRecord[] {
  const prefix = block.replace(/x+$/, "");
  const ids = new Map<string, string[]>();
  for (const { row } of sources)
    for (const code of row.codes)
      if (code.startsWith(prefix)) {
        const list = ids.get(code) ?? [];
        if (!list.includes(row.id)) list.push(row.id);
        ids.set(code, list);
      }
  return [...ids.keys()].sort().map((code) => ({ kind: "docs.code", code, ids: ids.get(code) ?? [] }));
}
