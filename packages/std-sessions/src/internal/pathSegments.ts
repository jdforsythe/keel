/**
 * The segments of a redact or expose path (std.sessions, rfc:0070 amendment 0214): split on `.`; a segment that is
 * exactly `*` is `null`, which matches any one segment (an array index, a record key or an object field); `\.`, `\*`
 * and `\\` are a literal `.`, `*` and `\`, so a key containing a dot is addressable (`headers.x\.trace`).
 */
export function pathSegments(path: string): (string | null)[] {
  const out: (string | null)[] = [];
  let seg = "";
  let escaped = false;
  for (let i = 0; i < path.length; i++) {
    const c = path[i] ?? "";
    if (c === "\\" && i + 1 < path.length) {
      seg += path[++i] ?? "";
      escaped = true;
    } else if (c === ".") {
      out.push(seg === "*" && !escaped ? null : seg);
      seg = "";
      escaped = false;
    } else seg += c;
  }
  out.push(seg === "*" && !escaped ? null : seg);
  return out;
}
