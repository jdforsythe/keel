/** `rel` (`./x`, `../x`) resolved against `dir` (`""` or ending in `/`); root-relative with `/` separators. */
export function joinPath(dir: string, rel: string): string {
  const out = dir.split("/").filter((p) => p !== "");
  for (const part of rel.split("/")) {
    if (part === "..") out.pop();
    else if (part !== "." && part !== "") out.push(part);
  }
  return out.join("/");
}
