/**
 * The Tauri crate name of an app (k.shell Files) from its `package.json` text: the package name without its scope,
 * lower-cased, each other character `-`, from its first letter; `app` when there is none.
 */
export function crateName(packageJson: string | undefined): string {
  let pkg: unknown;
  try {
    pkg = JSON.parse(packageJson ?? "null");
  } catch {
    pkg = null;
  }
  const name: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "name") : undefined;
  const crate =
    typeof name === "string"
      ? name
          .replace(/^@[^/]*\//, "")
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "-")
          .replace(/^[^a-z]+/, "")
      : "";
  return crate === "" ? "app" : crate;
}
