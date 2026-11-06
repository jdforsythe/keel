/** Sorted ids of the app modules in a tree: every `modules/<id>/module.ts`. */
export function moduleIds(files: ReadonlyMap<string, string>): string[] {
  const ids: string[] = [];
  for (const p of files.keys()) {
    const m = /^modules\/([^/]+)\/module\.ts$/.exec(p);
    if (m?.[1] !== undefined) ids.push(m[1]);
  }
  return ids.sort();
}
