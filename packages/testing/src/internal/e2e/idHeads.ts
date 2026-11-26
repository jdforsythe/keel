/** A template id's fixed head (`` `shopping.toggle.${item.id}` `` gives `shopping.toggle.`). */
const TEMPLATE = /`([A-Za-z][\w-]*(?:\.[\w-]+)*\.)\$\{/g;

/** The heads of the template ids a project's source writes, which `.keel/ids.json` cannot list. */
export function idHeads(sources: readonly string[]): string[] {
  const heads = new Set<string>();
  for (const src of sources) for (const m of src.matchAll(TEMPLATE)) if (m[1] !== undefined) heads.add(m[1]);
  return [...heads].sort();
}
