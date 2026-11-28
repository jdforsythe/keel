/** Whether a project tree is a Keel library: its `package.json` has `"keel": "library"` (k.library-pack). */
export function isLibrary(files: ReadonlyMap<string, string>): boolean {
  try {
    const pkg: unknown = JSON.parse(files.get("package.json") ?? "null");
    return typeof pkg === "object" && pkg !== null && Reflect.get(pkg, "keel") === "library";
  } catch {
    return false;
  }
}
