const STD = /^@keel\/std-[a-z0-9-]+$/;
const SCOPED = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;

/**
 * The kind of the package named `name` whose parsed `package.json` is `pkg` (k.library Kind): `library` for a scoped
 * package marked `"keel": "library"`, `std` for a `@keel/std-*` package without the mark (read as a library by its
 * name), undefined for any other package.
 */
export function libraryKind(pkg: unknown, name: string): "library" | "std" | undefined {
  const keel = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "keel") : undefined;
  if (keel === "library" && SCOPED.test(name)) return "library";
  return STD.test(name) ? "std" : undefined;
}
