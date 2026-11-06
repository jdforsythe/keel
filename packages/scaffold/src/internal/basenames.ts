import { isGenerated } from "./isGenerated.ts";

/** Paths in the tree whose file name is `base`, sorted; generated locations included only when asked. */
export function basenames(files: ReadonlyMap<string, string>, base: string, withGenerated = false): string[] {
  const out: string[] = [];
  for (const p of files.keys())
    if ((p === base || p.endsWith(`/${base}`)) && (withGenerated || !isGenerated(p))) out.push(p);
  return out.sort();
}
