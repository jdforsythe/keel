/** A `files` entry as a test of a package-relative path: the entry itself, anything under it, or its glob. */
const matcher = (entry: string): ((p: string) => boolean) => {
  const e = entry.replace(/^\.\//, "").replace(/\/+$/, "");
  if (!/[*?]/.test(e)) return (p) => p === e || p.startsWith(`${e}/`);
  const glob = e
    .split(/(\*\*\/?|\*|\?)/)
    .map((t) =>
      t === "**" || t === "**/"
        ? ".*"
        : t === "*"
          ? "[^/]*"
          : t === "?"
            ? "[^/]"
            : t.replace(/[.+^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
  const re = new RegExp(`^${glob}(?:/.*)?$`);
  return (p) => re.test(p);
};

/** Whether `files` (a `package.json` `files` list) selects the package-relative path `p`, `!` entries excluding. */
export function filesSelect(files: readonly string[], p: string): boolean {
  let hit = false;
  for (const f of files) {
    if (f.startsWith("!")) {
      if (hit && matcher(f.slice(1))(p)) hit = false;
    } else if (!hit && matcher(f)(p)) hit = true;
  }
  return hit;
}
