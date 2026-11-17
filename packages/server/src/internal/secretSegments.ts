import type { Located } from "@keel/router/internal";
import { secretKey } from "./secretKey.ts";

/** A segment as the router compares it to a static one: decoded, or as it came when it does not decode. */
const decoded = (part: string): string => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

/**
 * The `req` path marker of a route table (k.privacy Server log): given a request's pathname, each segment that stands
 * where a route's secret `params` field stands is `[secret]` whole, whatever the client sent there: any escapes, an
 * escape that does not decode, a value its schema refuses. A route is lined up with the path segment by segment, by
 * count (trailing slashes aside, kept as they came) and by its static segments, each compared decoded where it decodes;
 * a route led by a param (a prefix param) is also lined up without its first segment. Every route that lines up marks
 * its own, so the marks never depend on which route the router picked. Only routes with a secret param are kept, so a
 * table without one returns each path as it came.
 */
export function secretSegments(table: readonly Located[]): (path: string) => string {
  const held = table.flatMap((r) => {
    const node = r.def.params?.node;
    if (node === undefined) return [];
    const secret = r.segments.map((g) => g.kind === "param" && secretKey(node, g.name));
    return secret.includes(true) ? [{ segments: r.segments, secret }] : [];
  });
  if (held.length === 0) return (path) => path;
  return (path) => {
    const body = path.startsWith("/") ? path.slice(1) : path;
    const trimmed = body.replace(/\/+$/, "");
    if (trimmed === "") return path;
    const parts = trimmed.split("/");
    const marked = new Set<number>();
    for (const r of held)
      for (const off of r.segments[0]?.kind === "param" ? [0, 1] : [0]) {
        if (r.segments.length - off !== parts.length) continue;
        const fits = parts.every((p, j) => {
          const g = r.segments[j + off];
          return g !== undefined && (g.kind === "param" || g.text === decoded(p));
        });
        if (fits) for (let j = 0; j < parts.length; j++) if (r.secret[j + off] === true) marked.add(j);
      }
    if (marked.size === 0) return path;
    return `/${parts.map((p, j) => (marked.has(j) ? "[secret]" : p)).join("/")}${body.slice(trimmed.length)}`;
  };
}
