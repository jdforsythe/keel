import type { Raw } from "./Raw.ts";

const TOP = /^([A-Za-z][\w-]*):\s*(.*?)\s*$/;
const unquote = (s: string): string => s.trim().replace(/^(['"])(.*)\1$/, "$2");

/**
 * R1101 and R1102 in `pnpm-workspace.yaml` (k.escapes): each entry of the top-level `overrides` and
 * `patchedDependencies` maps, each name in `onlyBuiltDependencies`, and each name set `true` in `allowBuilds`.
 * Read by lines: a top-level key opens a block and its least-indented lines are its entries.
 */
export function workspaceEscapes(source: string): Raw[] {
  const out: Raw[] = [];
  const lines = source.split("\n");
  let block = "";
  let indent = -1;
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+#.*$/, "");
    if (line.trim() === "" || line.trim().startsWith("#")) return;
    const top = TOP.exec(line);
    if (top !== null && !/^\s/.test(line)) {
      block = top[1] ?? "";
      indent = -1;
      const inline = /^\[(.*)\]$/.exec(top[2] ?? "");
      if (block === "onlyBuiltDependencies" && inline !== null)
        for (const name of (inline[1] ?? "").split(",").map(unquote).filter((n) => n !== ""))
          out.push({ code: "R1102", line: i + 1, col: 1, text: name, message: `${name} allowed to build` });
      return;
    }
    const lead = line.length - line.trimStart().length;
    if (indent < 0) indent = lead;
    if (lead !== indent) return;
    const text = line.trim();
    const item = /^-\s+(.+)$/.exec(text);
    const pair = /^((?:'[^']*'|"[^"]*"|[^:\s][^:]*)):\s*(.*)$/.exec(text);
    if (block === "onlyBuiltDependencies" && item !== null) {
      const name = unquote(item[1] ?? "");
      out.push({ code: "R1102", line: i + 1, col: lead + 1, text, message: `${name} allowed to build` });
    } else if (pair !== null && (block === "overrides" || block === "patchedDependencies")) {
      const name = unquote(pair[1] ?? "");
      out.push({ code: "R1101", line: i + 1, col: lead + 1, text, message: `${block} entry ${name}` });
    } else if (pair !== null && block === "allowBuilds" && unquote(pair[2] ?? "") === "true") {
      const name = unquote(pair[1] ?? "");
      out.push({ code: "R1102", line: i + 1, col: lead + 1, text, message: `${name} allowed to build` });
    }
  });
  return out;
}
