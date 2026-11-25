/**
 * `rel` resolved against `dir`, both `/`-separated project paths: `.` segments dropped, each `..` removing the segment
 * before it (a `..` with none before it stays).
 */
export function joinPath(dir: string, rel: string): string {
  const out: string[] = [];
  for (const seg of `${dir}/${rel}`.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === ".." && out.length > 0 && out[out.length - 1] !== "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}
