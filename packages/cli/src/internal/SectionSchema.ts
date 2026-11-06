import { s } from "@keel/schema";

/** `keel spec <id>` / `--map`: one spec section, verbatim. */
export const SectionSchema = s.object({ kind: s.literal("spec.section"), id: s.string(), text: s.string() });
