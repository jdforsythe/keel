/** The app module a path belongs to (`modules/<id>/...`), or null. */
export function moduleOf(path: string): string | null {
  const m = /^modules\/([^/]+)\//.exec(path);
  return m?.[1] ?? null;
}
