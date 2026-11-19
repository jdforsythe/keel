import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isRecord } from "./isRecord.ts";

/** Binary only: the namespace of the project file `rel` under `cwd`, imported once by Node, or undefined when it throws. */
export async function projectFileModule(
  cwd: string,
  rel: string,
): Promise<Readonly<Record<string, unknown>> | undefined> {
  try {
    const mod: unknown = await import(pathToFileURL(join(cwd, rel)).href);
    return isRecord(mod) ? mod : undefined;
  } catch {
    return undefined;
  }
}
