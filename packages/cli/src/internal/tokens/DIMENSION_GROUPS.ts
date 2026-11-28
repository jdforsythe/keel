/** The group a `dimension` token goes to, by its path's first segment. */
export const DIMENSION_GROUPS: ReadonlyMap<string, string> = new Map([
  ["space", "space"],
  ["spacing", "space"],
  ["size", "size"],
  ["sizing", "size"],
  ["radius", "radius"],
  ["borderRadius", "radius"],
  ["fontSize", "fontSize"],
  ["breakpoint", "breakpoint"],
]);
