import { type ContractGap, readContract } from "@keel/compiler/internal";
import { contractCalls } from "../internal/contractCalls.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { schemaMarks } from "../internal/schemaMarks.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { SourceFile } from "../types/SourceFile.ts";

/** The URL parts of a contract entry: a page's `params` and `search`, an API entry's `params` and `query`. */
const URL_PARTS = new Set(["params", "search", "query"]);

/** The part a message names for each gap of the static reading. */
const PART: Readonly<Record<ContractGap["part"], string>> = {
  entries: "table",
  spread: "entries",
  key: "ids",
  entry: "entry",
  method: "method",
  path: "path",
  layout: "layout",
  events: "events",
};

/**
 * E1111 (k.privacy): a `.pii()` or `s.secret` node in the `params` or `search` schema of a `contract(id, entries)`
 * entry (an API entry's `params` and `query` too), the schema read through consts, imports, re-exports, namespace
 * members, spreads and schema arguments: a path or query reaches browser history and proxy logs Keel cannot redact.
 * An action `input` is a body, never a URL. The contract is read as `readContract` reads it, as the compiler's
 * `routes.json` reader does (W1005): what it does not read is reported at it, since nothing shows it unmarked (the
 * entries or an entry not written out, a spread or computed key among them, a `method`, `path`, `layout` or `events`
 * not a literal), and the entries beside it are still read; so is a schema it cannot read. No fix.
 */
export const piiInRouteUrl: RuleDef = {
  code: "E1111",
  message: (f) =>
    str(f.data, "why") === "unread"
      ? `route ${str(f.data, "part")} not readable statically; cannot show it holds no .pii()`
      : `personal data or a secret in route ${str(f.data, "part")}; a URL reaches history and logs`,
  see: "k.privacy",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    for (const { call: n } of contractCalls(file, ast)) {
      const arg = n.arguments[1];
      if (arg === undefined) continue;
      for (const item of readContract(arg)) {
        const gaps = item.kind === "gap" ? [item] : item.gaps;
        for (const g of gaps) out.push(findingAt(file, g.start, { part: PART[g.part], why: "unread" }));
        if (item.kind === "gap") continue;
        for (const [name, p] of item.members) {
          if (!URL_PARTS.has(name)) continue;
          const verdict = schemaMarks(p.value, file, project);
          if (verdict === "clean") continue;
          out.push(findingAt(file, p.start, { part: name, why: verdict === "marked" ? "marked" : "unread" }));
        }
      }
    }
    return out;
  },
};
