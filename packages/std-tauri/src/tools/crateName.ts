/**
 * The Tauri crate name of an app (std.tauri Files) from its `package.json` `name`: the name without its scope,
 * lower-cased, each other character `-`, from its first letter; `app` when there is none.
 */
export function crateName(pkg: string): string {
  const crate = pkg
    .replace(/^@[^/]*\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/^[^a-z]+/, "");
  return crate === "" ? "app" : crate;
}
