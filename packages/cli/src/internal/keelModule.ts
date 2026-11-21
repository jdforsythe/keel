import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isRecord } from "./isRecord.ts";

const load = async (at: string): Promise<Readonly<Record<string, unknown>> | undefined> => {
  const mod: unknown = await import(pathToFileURL(at).href);
  return isRecord(mod) ? mod : undefined;
};

/**
 * Binary only: the namespace of a `@keel/*` entry as the project at `cwd` resolves it (its own install, so a schema its
 * files build is read by the `@keel/schema` that built it), else as `@keel/cli` resolves it; undefined when neither
 * resolves or the module throws while it evaluates.
 */
export async function keelModule(
  cwd: string,
  specifier: string,
): Promise<Readonly<Record<string, unknown>> | undefined> {
  try {
    return await load(createRequire(join(cwd, "package.json")).resolve(specifier));
  } catch {
    try {
      return await load(createRequire(import.meta.url).resolve(specifier));
    } catch {
      return undefined;
    }
  }
}
