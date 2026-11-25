import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { A11yEntry } from "@keel/compiler";
import type { HarnessArtifacts } from "@keel/testing";
import { tokens } from "../tokens.ts";

const NAMES: readonly string[] = ["label", "alt", "text", "aria", "none"];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isName = (v: unknown): v is A11yEntry["name"] => typeof v === "string" && NAMES.includes(v);

/** The compiler's `.keel/a11y.json` entries, read from the app directory (the test run's cwd). */
function a11yJson(): Record<string, A11yEntry> {
  const raw: unknown = JSON.parse(readFileSync(join(process.cwd(), ".keel", "a11y.json"), "utf8"));
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : {};
  const out: Record<string, A11yEntry> = {};
  for (const [id, e] of Object.entries(data))
    if (isRecord(e) && isName(e.name) && (typeof e.role === "string" || e.role === null) && typeof e.tag === "string")
      out[id] = { name: e.name, role: e.role, tag: e.tag };
  return out;
}

/**
 * What the harness render checks compare against (k.a11y Render checks): `a11y.json` (E1702) and the app's tokens
 * (render contrast E1804 and reversed focus order E1820). Without them those checks do not run.
 */
export const artifacts: HarnessArtifacts = { "a11y.json": a11yJson(), tokens };
