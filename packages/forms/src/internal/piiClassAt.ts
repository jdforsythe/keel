import { type ObjectSchema, type PiiClass, piiPaths } from "@keel/schema";

/** The class of the marked leaf at field path `segs` (an array index matches `*`), or undefined (k.privacy). */
export function piiClassAt(schema: ObjectSchema<unknown>, segs: readonly string[]): PiiClass | undefined {
  return piiPaths(schema).find((p) => {
    const parts = p.path.split(".");
    return parts.length === segs.length && parts.every((part, i) => part === "*" || part === segs[i]);
  })?.class;
}
