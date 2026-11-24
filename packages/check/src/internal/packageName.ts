import path from "node:path";
import { isRecord } from "./compat/isRecord.ts";

/**
 * The `name` of the nearest `package.json` at or above the folder of `fileName`, each read through `read` (the type
 * pass's recording host, or the disk); `null` when none names one.
 */
export function packageName(fileName: string, read: (file: string) => string | undefined): string | null {
  let dir = path.dirname(fileName);
  for (;;) {
    const text = read(path.join(dir, "package.json"));
    if (text !== undefined) {
      try {
        const v: unknown = JSON.parse(text);
        if (isRecord(v) && typeof v.name === "string") return v.name;
      } catch {
        // Not JSON: look further up, as a package without a name is no package.
      }
    }
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
