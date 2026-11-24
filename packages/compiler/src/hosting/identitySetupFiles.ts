import fs from "node:fs";
import path from "node:path";

/**
 * The project's `identity.ts` as a vitest setup file, when the project has one (k.guards Client): evaluated before each
 * test file, as the built entry imports it, so a `renderRoute` router reads `/__keel/user` exactly when the built app
 * does. Empty without `identity.ts`.
 */
export function identitySetupFiles(root: string): string[] {
  const file = path.join(path.resolve(root), "identity.ts");
  return fs.existsSync(file) ? [file] : [];
}
