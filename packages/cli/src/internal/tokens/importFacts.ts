import type { Program } from "oxc-parser";
import type { ImportList } from "./ImportList.ts";

/** The imports of `program`. */
export function importFacts(program: Program): ImportList {
  const from = new Map<string, string>();
  let lastEnd = 0;
  let firstStart = -1;
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration") continue;
    lastEnd = st.end;
    if (firstStart < 0) firstStart = st.start;
    for (const sp of st.specifiers)
      if (sp.type === "ImportSpecifier")
        from.set(sp.local.name, `${st.source.value}#${sp.imported.type === "Identifier" ? sp.imported.name : ""}`);
  }
  return { from, lastEnd, firstStart: Math.max(firstStart, 0) };
}
