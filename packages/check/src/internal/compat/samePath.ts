const segs = (p: string): string[] => p.split("/").filter((s) => s !== "");

/** Two path patterns name the same URLs: equal segments, a `:param` matching any `:param`. */
export function samePath(a: string, b: string): boolean {
  const x = segs(a);
  const y = segs(b);
  return (
    x.length === y.length && x.every((s, i) => s === y[i] || (s.startsWith(":") && y[i]?.startsWith(":") === true))
  );
}
