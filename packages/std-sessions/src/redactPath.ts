import { defineRule } from "@keel/check";
import type { Finding, RuleDef } from "@keel/check";
import { lineCol } from "./internal/lineCol.ts";
import { moduleFile } from "./internal/moduleFile.ts";
import { parseFolder } from "./internal/parseFolder.ts";
import { parseRedactEntry } from "./internal/parseRedactEntry.ts";
import { pathMissing } from "./internal/pathMissing.ts";
import { redactLiterals } from "./internal/redactLiterals.ts";

const SUBJECTS = new Set(["tx", "store", "route", "el", "error"]);
const clip = (s: string): string => (s.length > 24 ? `${s.slice(0, 21)}...` : s);

/**
 * E2001 (std.sessions, k.check registry): a `redact`/`expose` entry of a module manifest with an unknown subject, a target of
 * another module, or a path absent from its statically resolved schema. Reports only what it proves; `fix` deletes it.
 */
export const redactPath: RuleDef = defineRule({
  code: "E2001",
  see: "std.sessions",
  message: (f) => {
    const entry = `${String(f.data?.list ?? "redact")} entry '${clip(String(f.data?.entry ?? ""))}'`;
    const why = String(f.data?.why ?? "");
    if (why === "subject") return `${entry} has unknown subject '${clip(String(f.data?.subject ?? ""))}'`;
    if (why === "module")
      return `${entry} targets module '${clip(String(f.data?.target ?? ""))}', not '${clip(String(f.data?.id ?? ""))}'`;
    if (why === "path") return `${entry} path '${clip(String(f.data?.path ?? ""))}' is not in its schema`;
    return `${entry} is not <subject>:<target>#<path>`;
  },
  explain:
    "redact/expose entry must be '<subject>:<target>#<path>': subject tx|store|route|el|error, target in this module, " +
    "path present in its schema. Fix: redact: ['tx:cart.pay#card.number'] with card.number in the payload schema.",
  check: ({ file, ast, project }) => {
    const mf = moduleFile(file.path);
    if (mf === undefined || mf.rest !== "module.ts") return [];
    const { id: declared, literals } = redactLiterals(ast);
    const id = declared ?? mf.id;
    const folder = `${mf.prefix}modules/${mf.id}/`;
    let parsed: ReturnType<typeof parseFolder> | undefined;
    const out: Finding[] = [];
    for (const lit of literals) {
      const e = parseRedactEntry(lit.value);
      let data: Record<string, string> | undefined;
      if (e === undefined) data = { why: "form" };
      else if (!SUBJECTS.has(e.subject)) data = { why: "subject", subject: e.subject };
      else if (e.target.split(".")[0] !== id) data = { why: "module", target: e.target.split(".")[0] ?? "", id };
      else {
        parsed ??= parseFolder(project, folder);
        if (pathMissing(e.subject, e.target, e.path, parsed)) data = { why: "path", path: e.path };
      }
      if (data === undefined) continue;
      out.push({
        path: file.path,
        ...lineCol(file.source, lit.start),
        data: { ...data, entry: lit.value, list: lit.list, rmStart: lit.rmStart, rmEnd: lit.rmEnd },
      });
    }
    return out;
  },
  fix: (f) => {
    const start = f.data?.rmStart;
    const end = f.data?.rmEnd;
    return typeof start === "number" && typeof end === "number" ? [{ start, end, text: "" }] : null;
  },
});
