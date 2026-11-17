import type { Schema, SchemaError } from "@keel/schema";
import type { Diag } from "./Diag.ts";
import { shownPath } from "./shownPath.ts";
import { unexpected } from "./unexpected.ts";

/**
 * A loader's or action's data that fails its `output` schema (E1554, k.server): the `diag` naming the first refused
 * path (`shownPath`: a record key is `*`), never the value, and the `keel.unexpected` error the request answers.
 */
export function outputRefused(kind: "loader" | "action", id: string, output: Schema<unknown>, e: SchemaError) {
  const at = e.data.issues[0];
  const message = `${kind} ${id} data fails its output schema${at === undefined ? "" : ` at ${shownPath(output.node, at.path) || "(root)"}`}`;
  const diag: Diag = { code: "E1554", message };
  return { diag, error: unexpected(`E1554 ${message}`) };
}
