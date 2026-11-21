import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

let found: { readonly version: string | undefined } | undefined;

/**
 * The version of the `z3-solver` that `@keel/testing/prove` loads (its `package.json`, resolved from `@keel/testing`),
 * or undefined when it is not installed. Read once per process.
 */
export function z3Version(): string | undefined {
  if (found === undefined) {
    let version: string | undefined;
    try {
      const testing = createRequire(import.meta.url).resolve("@keel/testing");
      const pkg: unknown = JSON.parse(readFileSync(createRequire(testing).resolve("z3-solver/package.json"), "utf8"));
      const v = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "version") : undefined;
      version = typeof v === "string" ? v : undefined;
    } catch {
      version = undefined;
    }
    found = { version };
  }
  return found.version;
}
