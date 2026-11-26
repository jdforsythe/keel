import type { DocsTerm } from "./DocsTerm.ts";

/**
 * The terms of `docs/GLOSSARY.md`, one per `- **<term>**: <text>` line, each with the section ids its text cites
 * that `known` accepts, once each in the order cited.
 */
export function glossaryTerms(text: string, known: (id: string) => boolean): DocsTerm[] {
  return text.split("\n").flatMap((line) => {
    const m = /^- \*\*(.+?)\*\*:[ \t]*(.*)$/.exec(line);
    if (m?.[1] === undefined) return [];
    const body = m[2] ?? "";
    const ids = [...new Set(body.match(/\b(?:k|std)\.[a-z](?:[a-z0-9-]*[a-z0-9])?/g) ?? [])].filter(known);
    return [{ term: m[1], text: body, ids }];
  });
}
