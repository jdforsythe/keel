/** A template id's fixed head (`` `shopping.toggle.${item.id}` `` gives `shopping.toggle.`). */
const TEMPLATE = /`([A-Za-z][\w-]*(?:\.[\w-]+)*\.)\$\{/g;

/** A template id built on a prop (`` `${props.id}.chart` `` gives the tail `.chart`), a library component's own. */
const TAIL = /`\$\{[\w.]+\}((?:\.[\w-]+)+)`/g;

/**
 * The fixed heads (`shop.row.`) and tails (`.chart`, written `.chart` with a leading dot) of the template ids a project's
 * or its libraries' source writes, which `.keel/ids.json` cannot list.
 */
export function idHeads(sources: readonly string[]): string[] {
  const heads = new Set<string>();
  for (const src of sources) {
    for (const m of src.matchAll(TEMPLATE)) if (m[1] !== undefined) heads.add(m[1]);
    for (const m of src.matchAll(TAIL)) if (m[1] !== undefined) heads.add(m[1]);
  }
  return [...heads].sort();
}
