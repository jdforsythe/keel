import type { Ctx } from "@keel/ctx";
import { pathToString } from "@keel/schema";
import type { InspectSection } from "./InspectSection.ts";
import { inspectors } from "./inspectors.ts";

const MAX = 60;
const clip = (s: string): string => (s.length > MAX ? `${s.slice(0, MAX - 3)}...` : s);

/**
 * Read every registered inspector section with `ctx` (k.inspect Inspector hooks): `{ doc, value }` with the value encoded
 * by its schema, or `{ doc, error }` when `read` throws or its value fails the schema. `diags` holds one E1057 per
 * failed section, for the serving process's dev log; `error` is its code and message.
 */
export function inspectorSections(ctx: Ctx): {
  sections: Record<string, InspectSection>;
  diags: { code: "E1057"; message: string }[];
} {
  const sections: Record<string, InspectSection> = {};
  const diags: { code: "E1057"; message: string }[] = [];
  for (const [id, def] of inspectors) {
    const doc = def.schema.doc();
    let why: string;
    try {
      const parsed = def.schema.parse(def.read(ctx));
      if (parsed.ok) {
        sections[id] = { doc, value: def.schema.encode(parsed.value) };
        continue;
      }
      const issue = parsed.error.data.issues[0];
      why =
        issue === undefined
          ? "fails its schema"
          : `fails its schema at ${pathToString(issue.path) || "."} (${issue.rule})`;
    } catch (e) {
      why = `read threw: ${clip(e instanceof Error ? e.message : String(e))}`;
    }
    const message = `inspector section ${id} ${why}`;
    sections[id] = { doc, error: `E1057 ${message}` };
    diags.push({ code: "E1057", message });
  }
  return { sections, diags };
}
