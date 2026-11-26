import type { OutRecord } from "../types/OutRecord.ts";
import type { DocsSource } from "./DocsSource.ts";
import type { DocsTerm } from "./DocsTerm.ts";
import { spanCount } from "./spanCount.ts";

const TEXT_MAX = 160;
const HITS_MAX = 5;

/**
 * `--for <name>` (k.docs Forms): the `docs.term` of the glossary term equal to the name ignoring case, then a
 * `docs.hit` per section holding the name in a code span, at most five, by count, most first, then the order given.
 */
export function forName(name: string, sources: readonly DocsSource[], terms: readonly DocsTerm[]): OutRecord[] {
  const key = name.toLowerCase();
  const term = terms.find((t) => t.term.toLowerCase() === key);
  const hits = sources
    .map((s, i) => ({ s, i, count: spanCount(s.text, name) }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .slice(0, HITS_MAX)
    .map(({ s, count }) => ({
      kind: "docs.hit",
      name,
      id: s.row.id,
      title: s.row.title,
      package: s.row.package,
      count,
    }));
  const head =
    term === undefined
      ? []
      : [{ kind: "docs.term", term: term.term, text: term.text.slice(0, TEXT_MAX), ids: [...term.ids] }];
  return [...head, ...hits];
}
