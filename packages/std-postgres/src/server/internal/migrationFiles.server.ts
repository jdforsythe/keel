import { createHash } from "node:crypto";
import { raise } from "../../../unsafe/raise.ts";
import { codeError } from "../../internal/codeError.ts";
import type { Migration } from "./Migration.ts";

const KEY = /^(?:.*\/)?migrations\/(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.sql$/;

/**
 * The migrations of database `name` in order (std.postgres Migrations). Each key is `./migrations/NNNN-<kebab>.sql`,
 * numbered from 0001 without a gap or a repeat; anything else throws E2453 naming the database and the key or number.
 */
export function migrationFiles(name: string, migrations: Readonly<Record<string, string>>): readonly Migration[] {
  const out: Migration[] = [];
  for (const [key, text] of Object.entries(migrations)) {
    const m = KEY.exec(key);
    if (m === null || typeof text !== "string")
      return raise(codeError("E2453", `${name}: ${JSON.stringify(key)} is not ./migrations/NNNN-<kebab>.sql`));
    const digest = createHash("sha256").update(text).digest("hex");
    out.push({ id: Number(m[1]), name: `${m[1]}-${m[2]}`, text, digest });
  }
  out.sort((a, b) => a.id - b.id);
  for (const [i, f] of out.entries())
    if (f.id !== i + 1)
      return raise(
        codeError(
          "E2453",
          `${name}: migration ${String(i + 1).padStart(4, "0")} is missing or repeated (found ${f.name})`,
        ),
      );
  return out;
}
