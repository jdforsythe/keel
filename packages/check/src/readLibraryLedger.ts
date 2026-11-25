import { type Infer, s } from "@keel/schema";
import { LEDGER_HEAD } from "./internal/LEDGER_HEAD.ts";

const HEAD = s.object(LEDGER_HEAD);
/** The order E1162 names a failing key in (k.ledger File). */
const ORDER = ["version", "unsafe", "hostElements", "exports"];

const parse = (text: string): unknown => {
  try {
    const v: unknown = JSON.parse(text);
    return v;
  } catch {
    return undefined;
  }
};

/**
 * A library's `.keel/ledger.json` as the app reads it (k.library Ledger): `text` undefined is `missing`; text that is
 * not a JSON object (empty, not JSON, an array, `null`, a number, a string, a boolean) is `object`; one whose
 * `version`, `unsafe`, `hostElements` or `exports` fails k.ledger File's shape is `shape` at the first such key in
 * File's order. Other keys are not judged: the app reads none of them.
 */
export function readLibraryLedger(
  text: string | undefined,
):
  | { readonly ok: true; readonly value: Infer<typeof HEAD> }
  | { readonly ok: false; readonly fault: "missing" | "object" | "shape"; readonly key?: string } {
  if (text === undefined) return { ok: false, fault: "missing" };
  const value = parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, fault: "object" };
  const read = HEAD.parse(value);
  if (read.ok) return { ok: true, value: read.value };
  const keys = read.error.data.issues.map((i) => String(i.path[0] ?? ""));
  return { ok: false, fault: "shape", key: ORDER.find((k) => keys.includes(k)) ?? "version" };
}
