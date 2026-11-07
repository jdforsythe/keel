// Shared file walking and source scrubbing for tooling scripts.
import fs from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", "dist", "coverage", "reports", ".turbo", ".git", ".worktrees"]);
export const CODE_EXT = /\.(?:ts|tsx|mts|cts|mjs|js|jsx)$/;

/** Recursively list files under `dir` (absolute), skipping build output and any dir in `skipDirs` (absolute). */
export function walk(dir, skipDirs = []) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // `.tmp-*` dirs are per-test scratch (mkdtemp under test/ or conformance/); a killed run can leave them behind.
      if (SKIP.has(e.name) || e.name.startsWith(".tmp-") || e.name.startsWith(".stryker-tmp") || skipDirs.includes(p)) continue;
      out.push(...walk(p, skipDirs));
    } else out.push(p);
  }
  return out.sort();
}

/**
 * Scrub source into two same-shaped line arrays:
 *  code: comments blanked, string/template contents emptied
 *  text: comments blanked, strings kept
 * Single/double quoted strings end at end of line, so a stray quote in a regex stays contained.
 */
export function scrub(src) {
  const code = [];
  const text = [];
  let inBlock = false;
  let inTpl = false;
  for (const line of src.split("\n")) {
    let c = "";
    let t = "";
    let q = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const two = line.slice(i, i + 2);
      if (inBlock) {
        if (two === "*/") {
          inBlock = false;
          i++;
          c += "  ";
          t += "  ";
        } else {
          c += " ";
          t += " ";
        }
      } else if (q || inTpl) {
        const close = inTpl ? "`" : q;
        if (ch === "\\") {
          i++;
          t += line.slice(i - 1, i + 1);
          continue;
        }
        if (ch === close) {
          q = "";
          inTpl = false;
          c += ch;
          t += ch;
        } else t += ch;
      } else if (two === "//") {
        c += " ".repeat(line.length - i);
        t += " ".repeat(line.length - i);
        break;
      } else if (two === "/*") {
        inBlock = true;
        i++;
        c += "  ";
        t += "  ";
      } else if (ch === "'" || ch === '"') {
        q = ch;
        c += ch;
        t += ch;
      } else if (ch === "`") {
        inTpl = true;
        c += ch;
        t += ch;
      } else {
        c += ch;
        t += ch;
      }
    }
    code.push(c);
    text.push(t);
  }
  return { code, text };
}

export const rel = (root, p) => path.relative(root, p).split(path.sep).join("/");
