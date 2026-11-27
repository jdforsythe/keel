import type { DocsArea } from "./DocsArea.ts";
import { codesIn } from "./codesIn.ts";
import { sectionHead } from "./sectionHead.ts";
import { sectionPath } from "./sectionPath.ts";
import { tableRows } from "./tableRows.ts";

/**
 * The areas of the Keel repo (k.docs The Keel repo): a row `| id | title |` of `spec/00-map.md` per area, a row
 * `| id | holds |` of `spec/areas/<area>.md` per section, title and status from the section's first two lines.
 */
export function repoAreas(files: ReadonlyMap<string, string>): DocsArea[] {
  return tableRows(files.get("spec/00-map.md") ?? "").map(([id = "", title = ""]) => ({
    id,
    title,
    sections: tableRows(files.get(`spec/areas/${id}.md`) ?? "").map(([sid = "", holds = ""]) => {
      const path = sectionPath(files, sid);
      const text = path === undefined ? "" : (files.get(path) ?? "");
      return { id: sid, ...sectionHead(text, sid), package: "", holds, codes: codesIn(text) };
    }),
  }));
}
