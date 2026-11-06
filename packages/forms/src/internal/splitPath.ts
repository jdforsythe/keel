/** Split a dotted field path into segments: `items.0.name` gives `['items', '0', 'name']`. */
export function splitPath(path: string): readonly string[] {
  return path === "" ? [] : path.split(".");
}
