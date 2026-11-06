/** Resolve the relative specifier `spec` against directory `dir` (`/` separators, no leading `./` in the result). */
export function joinPath(dir: string, spec: string): string {
  const parts = dir === "" ? [] : dir.split("/");
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}
