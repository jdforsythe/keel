import { s } from "@keel/schema";

/** One inspector section as the viewer shows it: its schema's `doc()` and its value as JSON text, or its E1057. */
export const SectionView = s.object({ doc: s.string(), text: s.string(), failed: s.boolean() });
