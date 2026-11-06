import { relSpec } from "./relSpec.ts";

/**
 * A specifier from `fromFile` to `toFile` written in the same extension style as `original`, which named
 * `oldTarget`: full extension, none, or `.js`.
 */
export function restyleSpec(original: string, oldTarget: string, fromFile: string, toFile: string): string {
  const full = relSpec(fromFile, toFile);
  const oldBase = oldTarget.split("/").pop() ?? oldTarget;
  const last = original.split("/").pop() ?? original;
  if (last === oldBase) return full;
  const bare = full.replace(/\.[cm]?[jt]sx?$/, "");
  if (/\.[cm]?jsx?$/.test(last)) return `${bare}${last.slice(last.lastIndexOf("."))}`;
  return bare;
}
