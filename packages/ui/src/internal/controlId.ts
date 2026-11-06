import { fnv1a } from "./fnv1a.ts";

/** Ids handed out during the current synchronous render, per document; cleared at the next microtask. */
const issued = new Map<Document, Set<string>>();
let clearing = false;

/**
 * The id of a labelled control: the explicit `id` when given; else `k-<kind>-<label slug>`, suffixed `-2`,
 * `-3`, ... until no element of `doc` and no control created earlier in the same render has it.
 * Never random: equal render order gives equal ids.
 */
export function controlId(kind: string, label: string, id: string | undefined, doc: Document): string {
  if (id !== undefined) return id;
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = `k-${kind}-${slug === "" ? fnv1a(label) : slug}`;
  const taken = issued.get(doc) ?? new Set<string>();
  issued.set(doc, taken);
  if (!clearing) {
    clearing = true;
    queueMicrotask(() => {
      issued.clear();
      clearing = false;
    });
  }
  let out = base;
  for (let n = 2; taken.has(out) || doc.getElementById(out) !== null; n++) out = `${base}-${n}`;
  taken.add(out);
  return out;
}
