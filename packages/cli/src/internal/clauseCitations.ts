import type { Diag } from "./Diag.ts";
import { clauseKey } from "./clauseKey.ts";
import { makeDiag } from "./makeDiag.ts";
import { nearestClause } from "./nearestClause.ts";
import { normClause } from "./normClause.ts";
import { specCitations } from "./specCitations.ts";

type Clause = { readonly id: string; readonly n: number; readonly text: string };

/** A quote's first six words, `\"` written `"`, with `...` when it holds more. */
const firstWords = (quote: string): string => {
  const words = quote.replaceAll('\\"', '"').trim().split(/\s+/);
  return `${words.slice(0, 6).join(" ")}${words.length > 6 ? " ..." : ""}`;
};

/**
 * The clauses each conformance file cites (k.ledger-items Citation), as items `<section>#<key>` by file path, and one
 * E1732 per `// Spec:` header line not of the citation form, naming no section, or whose quote's normal form is no
 * bullet's of its section. The message holds the quote's first six words and the nearest bullet `<section>#<n>`
 * (`nearestClause`), when the line names a section with bullets.
 */
export function clauseCitations(
  files: readonly { readonly path: string; readonly head: readonly { line: number; text: string }[] }[],
  clauses: readonly Clause[],
): { cited: Map<string, Set<string>>; diags: Diag[] } {
  const bySection = new Map<string, Clause[]>();
  for (const c of clauses) bySection.set(c.id, [...(bySection.get(c.id) ?? []), c]);
  const cited = new Map<string, Set<string>>();
  const diags: Diag[] = [];
  for (const f of files) {
    const items = new Set<string>();
    for (const c of specCitations(f.head)) {
      const bullets = c.section === undefined ? [] : (bySection.get(c.section) ?? []);
      const norm = c.quote === undefined ? undefined : normClause(c.quote);
      const hit = c.formed && norm !== undefined ? bullets.find((b) => normClause(b.text) === norm) : undefined;
      if (hit !== undefined) {
        items.add(`${hit.id}#${clauseKey(hit.text)}`);
        continue;
      }
      const near = c.quote === undefined ? undefined : nearestClause(c.quote, bullets);
      const quoted = c.quote === undefined ? "" : `: "${firstWords(c.quote)}"`;
      const what = !c.formed
        ? "not the citation form"
        : bullets.length === 0
          ? `names no section with clauses (${c.section ?? ""})`
          : "cites no clause";
      diags.push(
        makeDiag("E1732", `${what}${near === undefined ? "" : `, nearest ${near.id}#${near.n}`}${quoted}`, {
          path: f.path,
          line: c.line,
          col: 1,
          see: "k.ledger-items",
        }),
      );
    }
    cited.set(f.path, items);
  }
  return { cited, diags };
}
