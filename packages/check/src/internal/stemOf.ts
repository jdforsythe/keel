/** File name without directories and everything from its first dot (`addItem.server.ts` -> `addItem`). */
export function stemOf(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.indexOf(".");
  return dot <= 0 ? base : base.slice(0, dot);
}
