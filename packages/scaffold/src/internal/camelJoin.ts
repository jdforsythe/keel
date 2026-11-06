import { pascal } from "./pascal.ts";

/** Join lowerCamel segments into one lowerCamel name: ["items", "show"] -> "itemsShow". */
export function camelJoin(segments: readonly string[]): string {
  return segments.map((s, i) => (i === 0 ? s : pascal(s))).join("");
}
