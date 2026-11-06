import { fnv1a } from "./fnv1a.ts";

/**
 * The id of a labelled control: the explicit `id`, else derived from kind and label text
 * (`k-input-full-name`). Deterministic, never random; equal labels give equal ids (pass `id`).
 */
export function controlId(kind: string, label: string, id: string | undefined): string {
  if (id !== undefined) return id;
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `k-${kind}-${slug === "" ? fnv1a(label) : slug}`;
}
